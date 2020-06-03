const MarketMaker = artifacts.require("GoodMarketMaker");

const GoodDollar = artifacts.require("GoodDollar");
const Bancor = artifacts.require("BancorFormula");

const Identity = artifacts.require("IdentityMock");
const Formula = artifacts.require("FeeFormula");
const avatarMock = artifacts.require("AvatarMock");
const UBIMock = artifacts.require("UBISchemeMock");
const ControllerMock = artifacts.require("ControllerMock");
const FirstClaimPool = artifacts.require("FirstClaimPool");
const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

const MAX_INACTIVE_DAYS = 3;
const ONE_DAY = 86400;

export const increaseTime = async function(duration) {
  const id = await Date.now();

  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [duration],
      id: id + 1
    },
    () => {}
  );

  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_mine",
      id: id + 1
    },
    () => {}
  );
};

contract(
  "UBIScheme",
  ([founder, claimer1, claimer2, claimer3, claimer4, fisherman, claimer5, claimer6]) => {
    let goodDollar, identity, formula, avatar, ubi, controller, firstClaimPool;

    before(async () => {
      formula = await Formula.new(0);
      identity = await Identity.new();
      goodDollar = await GoodDollar.new(
        "GoodDollar",
        "GDD",
        "0",
        formula.address,
        identity.address,
        NULL_ADDRESS
      );
      avatar = await avatarMock.new("", goodDollar.address, NULL_ADDRESS);
      controller = await ControllerMock.new(avatar.address);
      await avatar.transferOwnership(controller.address);
      firstClaimPool = await FirstClaimPool.new(100, avatar.address, identity.address);
      await firstClaimPool.start();
    });

    it("should not accept 0 inactive days in the constructor", async () => {
      let error = await UBIMock.new(
        avatar.address,
        identity.address,
        firstClaimPool.address,
        0,
        100,
        0
      ).catch(e => e);
      expect(error.message).to.have.string("Max inactive days cannot be zero");
    });

    it("should deploy the ubi", async () => {
      const now = new Date();
      const startUBI = (now.getTime() / 1000 - 1).toFixed(0);
      now.setDate(now.getDate() + 30);
      const endUBI = (now.getTime() / 1000).toFixed(0);
      ubi = await UBIMock.new(
        avatar.address,
        identity.address,
        firstClaimPool.address,
        startUBI,
        endUBI,
        MAX_INACTIVE_DAYS
      );
      let isActive = await ubi.isActive();
      expect(isActive).to.be.false;
    });

    it("should not be able to set the claim amount if the sender is not the avatar", async () => {
      let error = await firstClaimPool.setClaimAmount(200).catch(e => e);
      expect(error.message).to.have.string("only Avatar");
    });

    it("should not be able to set the ubi scheme if the sender is not the avatar", async () => {
      let error = await firstClaimPool.setUBIScheme(ubi.address).catch(e => e);
      expect(error.message).to.have.string("only Avatar");
    });

    it("should set the ubi scheme by avatar", async () => {
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "setUBIScheme",
          type: "function",
          inputs: [
            {
              type: "address",
              name: "_ubi"
            }
          ]
        },
        [founder]
      );
      await controller.genericCall(
        firstClaimPool.address,
        encodedCall,
        avatar.address,
        0
      );
      const newUbi = await firstClaimPool.ubi();
      expect(newUbi.toString()).to.be.equal(founder);
    });

    it("should not be able to execute claiming when start has not been executed yet", async () => {
      let error = await ubi.claim().catch(e => e);
      expect(error.message).to.have.string("is not active");
    });

    it("should not be able to execute fish when start has not been executed yet", async () => {
      let error = await ubi.fish(NULL_ADDRESS).catch(e => e);
      expect(error.message).to.have.string("is not active");
    });

    it("should not be able to execute fishMulti when start has not been executed yet", async () => {
      let error = await ubi.fishMulti([NULL_ADDRESS]).catch(e => e);
      expect(error.message).to.have.string("is not active");
    });

    it("should start the ubi", async () => {
      await ubi.start();
      let isActive = await ubi.isActive();
      const newUbi = await firstClaimPool.ubi();
      expect(newUbi.toString()).to.be.equal(ubi.address);
      expect(isActive).to.be.true;
    });

    it("should not be able to execute claiming when the caller is not whitelisted", async () => {
      let error = await ubi.claim().catch(e => e);
      expect(error.message).to.have.string("is not whitelisted");
    });

    it("should award a new user with 0 on first time execute claim if the first claim contract has no balance", async () => {
      await identity.addWhitelisted(claimer1);
      let tx = await ubi.claim({ from: claimer1 });
      let claimer1Balance = await goodDollar.balanceOf(claimer1);
      expect(claimer1Balance.toNumber()).to.be.equal(0);
      const emittedEvents = tx.logs.map(e => e.event);
      expect(emittedEvents).to.include.members(["ActivatedUser", "UBIClaimed"]);
    });

    it("should award a new user with the award amount on first time execute claim", async () => {
      await goodDollar.mint(firstClaimPool.address, "10000000");
      await identity.addWhitelisted(claimer2);
      let transaction = await ubi.claim({ from: claimer2 });
      let activeUsersCount = await ubi.activeUsersCount();
      let claimer2Balance = await goodDollar.balanceOf(claimer2);
      expect(claimer2Balance.toNumber()).to.be.equal(100);
      expect(activeUsersCount.toNumber()).to.be.equal(2);
      const activatedUserEventExists = transaction.logs.some(
        e => e.event === "ActivatedUser"
      );
      expect(activatedUserEventExists).to.be.true;
    });

    it("should not be able to fish a new user", async () => {
      let error = await ubi.fish(claimer1, { from: fisherman }).catch(e => e);
      expect(error.message).to.have.string("is not an inactive user");
    });

    it("should not initiate the scheme balance and distribution formula when a new user execute claim", async () => {
      let balance = await goodDollar.balanceOf(ubi.address);
      let dailyUbi = await ubi.dailyUbi();
      expect(balance.toString()).to.be.equal("0");
      expect(dailyUbi.toString()).to.be.equal("0");
    });

    it("should returns a valid distribution calculation when the current balance is lower than the number of daily claimers", async () => {
      // there is 0.01 gd and 2 claimers
      await goodDollar.mint(avatar.address, "1");
      await increaseTime(ONE_DAY);
      await ubi.claim({ from: claimer1 });
      await ubi.claim({ from: claimer2 });
      let ubiBalance = await goodDollar.balanceOf(ubi.address);
      await increaseTime(ONE_DAY);
      let dailyUbi = await ubi.dailyUbi();
      let claimer1Balance = await goodDollar.balanceOf(claimer1);
      expect(ubiBalance.toString()).to.be.equal("1");
      expect(dailyUbi.toString()).to.be.equal("0");
      expect(claimer1Balance.toString()).to.be.equal("0");
    });

    it("should calculate the daily distribution and withdraw balance from the dao when an active user executes claim", async () => {
      await increaseTime(ONE_DAY);
      await goodDollar.mint(avatar.address, "1");
      //ubi will have 2GD in pool so daily ubi is now also 1
      await ubi.claim({ from: claimer1 });
      await ubi.claim({ from: claimer2 });
      await increaseTime(ONE_DAY);
      await goodDollar.mint(avatar.address, "1");
      //daily ubi is 0 since only 1 GD is in pool and can't be divided
      await ubi.claim({ from: claimer1 });
      let avatarBalance = await goodDollar.balanceOf(avatar.address);
      let claimer1Balance = await goodDollar.balanceOf(claimer1);
      expect(avatarBalance.toString()).to.be.equal("0");
      expect(claimer1Balance.toString()).to.be.equal("1"); //so just 1 GD from first day claimed in this test
    });

    it("should return the reward value for entitlement user", async () => {
      let amount = await ubi.checkEntitlement({ from: claimer4 });
      let claimAmount = await firstClaimPool.claimAmount();
      expect(amount.toString()).to.be.equal(claimAmount.toString());
    });

    it("should not be able to fish an active user", async () => {
      await identity.addWhitelisted(claimer3);
      await identity.addWhitelisted(claimer4);
      await ubi.claim({ from: claimer3 });
      await ubi.claim({ from: claimer4 });
      let isActiveUser = await ubi.isActiveUser(claimer4);
      let error = await ubi.fish(claimer4, { from: fisherman }).catch(e => e);
      expect(isActiveUser).to.be.true;
      expect(error.message).to.have.string("is not an inactive use");
    });

    it("should return the daily ubi for entitlement user", async () => {
      let amount = await ubi.checkEntitlement({ from: claimer4 });
      let dailyUbi = await ubi.dailyUbi();
      expect(amount.toString()).to.be.equal(dailyUbi.toString());
    });

    it("should not be able to execute claim twice a day", async () => {
      await goodDollar.mint(avatar.address, "20");
      await increaseTime(ONE_DAY);
      let claimer4Balance1 = await goodDollar.balanceOf(claimer4);
      await ubi.claim({ from: claimer4 });
      let claimer4Balance2 = await goodDollar.balanceOf(claimer4);
      let dailyUbi = await ubi.dailyUbi();
      await ubi.claim({ from: claimer4 });
      let claimer4Balance3 = await goodDollar.balanceOf(claimer4);
      expect(claimer4Balance2.toNumber() - claimer4Balance1.toNumber()).to.be.equal(
        dailyUbi.toNumber()
      );
      expect(claimer4Balance3.toNumber() - claimer4Balance1.toNumber()).to.be.equal(
        dailyUbi.toNumber()
      );
    });

    it("should return 0 for entitlement if the user has already claimed for today", async () => {
      let amount = await ubi.checkEntitlement({ from: claimer4 });
      expect(amount.toString()).to.be.equal("0");
    });

    it("should be able to fish inactive user", async () => {
      await goodDollar.mint(avatar.address, "20");
      await increaseTime(MAX_INACTIVE_DAYS * ONE_DAY);
      let claimer4BalanceBefore = await goodDollar.balanceOf(claimer4);
      let isFishedBefore = await ubi.fishedUsersAddresses(claimer1);
      let tx = await ubi.fish(claimer1, { from: claimer4 });
      let isFishedAfter = await ubi.fishedUsersAddresses(claimer1);
      let claimer4BalanceAfter = await goodDollar.balanceOf(claimer4);
      let dailyUbi = await ubi.dailyUbi();
      expect(isFishedBefore).to.be.false;
      expect(isFishedAfter).to.be.true;
      expect(tx.logs[1].event).to.be.equal("InactiveUserFished");
      expect(
        claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber()
      ).to.be.equal(dailyUbi.toNumber());
    });

    it("should not be able to fish the same user twice", async () => {
      await goodDollar.mint(avatar.address, "20");
      await increaseTime(MAX_INACTIVE_DAYS * ONE_DAY);
      let claimer4BalanceBefore = await goodDollar.balanceOf(claimer4);
      let isFishedBefore = await ubi.fishedUsersAddresses(claimer1);
      let error = await ubi.fish(claimer1, { from: claimer4 }).catch(e => e);
      let isFishedAfter = await ubi.fishedUsersAddresses(claimer1);
      let claimer4BalanceAfter = await goodDollar.balanceOf(claimer4);
      expect(error.message).to.have.string("already fished");
      expect(isFishedBefore).to.be.true;
      expect(isFishedAfter).to.be.true;
      expect(claimer4BalanceAfter.toNumber()).to.be.equal(
        claimer4BalanceBefore.toNumber()
      );
    });

    it("should be able to fish multiple user", async () => {
      await goodDollar.mint(avatar.address, "20");
      await increaseTime(MAX_INACTIVE_DAYS * ONE_DAY);
      let claimer4BalanceBefore = await goodDollar.balanceOf(claimer4);
      let tx = await ubi.fishMulti([claimer2, claimer3], { from: claimer4 });
      let claimer4BalanceAfter = await goodDollar.balanceOf(claimer4);
      let dailyUbi = await ubi.dailyUbi();
      expect(tx.logs[1].event).to.be.equal("InactiveUserFished");
      expect(
        claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber()
      ).to.be.equal(2 * dailyUbi.toNumber());
    });

    it("should not be able to remove active user that no longer whitelisted", async () => {
      await goodDollar.mint(avatar.address, "20");
      await ubi.claim({ from: claimer2 }); // makes sure that the user is active
      await identity.removeWhitelisted(claimer2);
      let claimer4BalanceBefore = await goodDollar.balanceOf(claimer4);
      let isFishedBefore = await ubi.fishedUsersAddresses(claimer2);
      let error = await ubi.fish(claimer2, { from: claimer4 }).catch(e => e);
      let isFishedAfter = await ubi.fishedUsersAddresses(claimer2);
      let claimer4BalanceAfter = await goodDollar.balanceOf(claimer4);
      expect(error.message).to.have.string("is not an inactive user");
      expect(isFishedBefore).to.be.false;
      expect(isFishedAfter).to.be.false;
      expect(claimer4BalanceAfter.toNumber()).to.be.equal(
        claimer4BalanceBefore.toNumber()
      );
    });

    it("should be able to remove an inactive user that no longer whitelisted", async () => {
      await goodDollar.mint(avatar.address, "20");
      await increaseTime(MAX_INACTIVE_DAYS * ONE_DAY);
      let claimer4BalanceBefore = await goodDollar.balanceOf(claimer4);
      let isFishedBefore = await ubi.fishedUsersAddresses(claimer2);
      let tx = await ubi.fish(claimer2, { from: claimer4 });
      let isFishedAfter = await ubi.fishedUsersAddresses(claimer2);
      let claimer4BalanceAfter = await goodDollar.balanceOf(claimer4);
      let dailyUbi = await ubi.dailyUbi();
      expect(isFishedBefore).to.be.false;
      expect(isFishedAfter).to.be.true;
      expect(tx.logs[1].event).to.be.equal("InactiveUserFished");
      expect(
        claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber()
      ).to.be.equal(dailyUbi.toNumber());
    });

    it("should be able to fish user that removed from the whitelist", async () => {
      await goodDollar.mint(avatar.address, "20");
      await identity.addWhitelisted(claimer2);
      await ubi.claim({ from: claimer2 });
      await increaseTime(MAX_INACTIVE_DAYS * ONE_DAY);
      await identity.removeWhitelisted(claimer2);
      let claimer4BalanceBefore = await goodDollar.balanceOf(claimer4);
      let isFishedBefore = await ubi.fishedUsersAddresses(claimer2);
      let tx = await ubi.fish(claimer2, { from: claimer4 });
      let isFishedAfter = await ubi.fishedUsersAddresses(claimer2);
      let claimer4BalanceAfter = await goodDollar.balanceOf(claimer4);
      let dailyUbi = await ubi.dailyUbi();
      expect(isFishedBefore).to.be.false;
      expect(isFishedAfter).to.be.true;
      expect(tx.logs[1].event).to.be.equal("InactiveUserFished");
      expect(
        claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber()
      ).to.be.equal(dailyUbi.toNumber());
    });

    it("should recieves a claim reward on claim after removed and added again to the whitelist", async () => {
      let isFishedBefore = await ubi.fishedUsersAddresses(claimer2);
      let activeUsersCountBefore = await ubi.activeUsersCount();
      await identity.addWhitelisted(claimer2);
      let claimerBalanceBefore = await goodDollar.balanceOf(claimer2);
      await ubi.claim({ from: claimer2 });
      let claimerBalanceAfter = await goodDollar.balanceOf(claimer2);
      let isFishedAfter = await ubi.fishedUsersAddresses(claimer2);
      let activeUsersCountAfter = await ubi.activeUsersCount();
      expect(isFishedBefore).to.be.true;
      expect(isFishedAfter).to.be.false;
      expect(
        activeUsersCountAfter.toNumber() - activeUsersCountBefore.toNumber()
      ).to.be.equal(1);
      expect(
        claimerBalanceAfter.toNumber() - claimerBalanceBefore.toNumber()
      ).to.be.equal(100);
    });

    it("distribute formula should return correct value", async () => {
      await goodDollar.mint(avatar.address, "20");
      await increaseTime(ONE_DAY);
      let ubiBalance = await goodDollar.balanceOf(ubi.address);
      let avatarBalance = await goodDollar.balanceOf(avatar.address);
      let activeUsersCount = await ubi.activeUsersCount();
      let claimer4BalanceBefore = await goodDollar.balanceOf(claimer2);
      await ubi.claim({ from: claimer2 });
      let claimer4BalanceAfter = await goodDollar.balanceOf(claimer2);
      expect(
        ubiBalance
          .add(avatarBalance)
          .div(activeUsersCount)
          .toNumber()
      ).to.be.equal(claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber());
    });

    it("distribute formula should return correct value while gd has transferred directly to the ubi", async () => {
      await goodDollar.mint(ubi.address, "200");
      await increaseTime(ONE_DAY);
      let ubiBalance = await goodDollar.balanceOf(ubi.address);
      let avatarBalance = await goodDollar.balanceOf(avatar.address);
      let activeUsersCount = await ubi.activeUsersCount();
      let claimer4BalanceBefore = await goodDollar.balanceOf(claimer2);
      await ubi.claim({ from: claimer2 });
      let claimer4BalanceAfter = await goodDollar.balanceOf(claimer2);
      let dailyUbi = await ubi.dailyUbi();
      expect(
        ubiBalance
          .add(avatarBalance)
          .div(activeUsersCount)
          .toNumber()
      ).to.be.equal(claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber());
      expect(
        ubiBalance
          .add(avatarBalance)
          .div(activeUsersCount)
          .toNumber()
      ).to.be.equal(dailyUbi.toNumber());
    });

    it("should calcualte the correct distribution formula and transfer the correct amount when the ubi has a large amount of tokens", async () => {
      await increaseTime(ONE_DAY);
      await goodDollar.mint(avatar.address, "948439324829"); // checking claim with a random number
      await increaseTime(ONE_DAY);
      await identity.authenticate(claimer1);
      // first claim
      await ubi.claim({ from: claimer1 });
      await increaseTime(ONE_DAY);
      let claimer1Balance1 = await goodDollar.balanceOf(claimer1);
      // regular claim
      await ubi.claim({ from: claimer1 });
      let claimer1Balance2 = await goodDollar.balanceOf(claimer1);
      // there are 3 claimers and the total ubi balance after the minting include the previous balance and
      // the 948439324829 minting tokens. that divides into 3
      expect(claimer1Balance2.sub(claimer1Balance1).toString()).to.be.equal("316146441647");
    });

    it("should be able to iterate over all accounts if enough gas in fishMulti", async () => {
      //should not reach fishin first user because atleast 150k gas is required
      let tx = await ubi
        .fishMulti([claimer5, claimer6, claimer1], { from: fisherman, gas: 100000 })
        .then(_ => true)
        .catch(_ => console.log({ e }));
      expect(tx).to.be.true;
      //should loop over all users when enough gas without exceptions
      let res = await ubi
        .fishMulti([claimer5, claimer6, claimer1], { gas: 1000000 })
        .then(_ => true)
        .catch(e => console.log({ e }));
      expect(res).to.be.true;
    });

    it("should return the reward value for entitlement user", async () => {
      await increaseTime(ONE_DAY);
      await ubi.claim({ from: claimer1 });
      await increaseTime(ONE_DAY);
      let amount = await ubi.checkEntitlement({ from: claimer1 });
      let balance2 = await goodDollar.balanceOf(ubi.address);
      let activeUsersCount = await ubi.activeUsersCount();
      expect(amount.toString()).to.be.equal((balance2).div(activeUsersCount).toString());
    });

    it("should set the ubi claim amount by avatar", async () => {
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "setClaimAmount",
          type: "function",
          inputs: [
            {
              type: "uint256",
              name: "_claimAmount"
            }
          ]
        },
        [200]
      );
      await controller.genericCall(
        firstClaimPool.address,
        encodedCall,
        avatar.address,
        0
      );
      const claimAmount = await firstClaimPool.claimAmount();
      expect(claimAmount.toString()).to.be.equal("200");
    });

    it("should set if withdraw from the dao or not", async () => {
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "setShouldWithdrawFromDAO",
          type: "function",
          inputs: [
            {
              type: "bool",
              name: "_shouldWithdraw"
            }
          ]
        },
        [true]
      );
      await controller.genericCall(
        ubi.address,
        encodedCall,
        avatar.address,
        0
      );
      const shouldWithdrawFromDAO = await ubi.shouldWithdrawFromDAO();
      expect(shouldWithdrawFromDAO).to.be.equal(true);
    });

    it("should not be able to destroy the ubi contract if not avatar", async () => {
      await increaseTime(10 * ONE_DAY);
      let avatarBalanceBefore = await goodDollar.balanceOf(avatar.address);
      let contractBalanceBefore = await goodDollar.balanceOf(ubi.address);
      let error = await ubi.end().catch(e => e);
      expect(error.message).to.have.string("only Avatar can call this method");
      let avatarBalanceAfter = await goodDollar.balanceOf(avatar.address);
      let contractBalanceAfter = await goodDollar.balanceOf(ubi.address);
      let isActive = await ubi.isActive();
      expect((avatarBalanceAfter - avatarBalanceBefore).toString()).to.be.equal("0");
      expect(contractBalanceAfter.toString()).to.be.equal(
        contractBalanceBefore.toString()
      );
      expect(isActive.toString()).to.be.equal("true");
    });

    it("should destroy the ubi contract and transfer funds to the avatar", async () => {
      let avatarBalanceBefore = await goodDollar.balanceOf(avatar.address);
      let contractBalanceBefore = await goodDollar.balanceOf(ubi.address);
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "end",
          type: "function",
          inputs: []
        },
        []
      );
      await controller.genericCall(ubi.address, encodedCall, avatar.address, 0);
      let avatarBalanceAfter = await goodDollar.balanceOf(avatar.address);
      let contractBalanceAfter = await goodDollar.balanceOf(ubi.address);
      let code = await web3.eth.getCode(ubi.address);
      expect((avatarBalanceAfter - avatarBalanceBefore).toString()).to.be.equal(
        contractBalanceBefore.toString()
      );
      expect(contractBalanceAfter.toString()).to.be.equal("0");
      expect(code.toString()).to.be.equal("0x");
    });

    it("should be able to destroy an empty pool contract", async () => {
      let firstClaimPool1 = await FirstClaimPool.new(100, avatar.address, identity.address);
      await firstClaimPool1.start();
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "end",
          type: "function",
          inputs: []
        },
        []
      );
      await controller.genericCall(
        firstClaimPool1.address,
        encodedCall,
        avatar.address,
        0
      );
      let code = await web3.eth.getCode(firstClaimPool1.address);
      expect(code.toString()).to.be.equal("0x");
    });

    it("should not be able to destroy the first claim pool contract if not avatar", async () => {
      let avatarBalanceBefore = await goodDollar.balanceOf(avatar.address);
      let contractBalanceBefore = await goodDollar.balanceOf(firstClaimPool.address);
      let error = await firstClaimPool.end().catch(e => e);
      expect(error.message).to.have.string("only Avatar can call this method");
      let avatarBalanceAfter = await goodDollar.balanceOf(avatar.address);
      let contractBalanceAfter = await goodDollar.balanceOf(firstClaimPool.address);
      let isActive = await firstClaimPool.isActive();
      expect((avatarBalanceAfter - avatarBalanceBefore).toString()).to.be.equal("0");
      expect(contractBalanceAfter.toString()).to.be.equal(
        contractBalanceBefore.toString()
      );
      expect(isActive.toString()).to.be.equal("true");
    });

    it("should destroy the first claim pool contract and transfer funds to the avatar", async () => {
      let avatarBalanceBefore = await goodDollar.balanceOf(avatar.address);
      let contractBalanceBefore = await goodDollar.balanceOf(firstClaimPool.address);
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "end",
          type: "function",
          inputs: []
        },
        []
      );
      await controller.genericCall(
        firstClaimPool.address,
        encodedCall,
        avatar.address,
        0
      );
      let avatarBalanceAfter = await goodDollar.balanceOf(avatar.address);
      let contractBalanceAfter = await goodDollar.balanceOf(firstClaimPool.address);
      let code = await web3.eth.getCode(firstClaimPool.address);
      expect((avatarBalanceAfter - avatarBalanceBefore).toString()).to.be.equal(
        contractBalanceBefore.toString()
      );
      expect(contractBalanceAfter.toString()).to.be.equal("0");
      expect(code.toString()).to.be.equal("0x");
    });
  }
);
