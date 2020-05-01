const MarketMaker = artifacts.require("GoodMarketMaker");

const GoodDollar = artifacts.require("GoodDollar");
const Bancor = artifacts.require("BancorFormula");

const Identity = artifacts.require("IdentityMock");
const Formula = artifacts.require("FeeFormula");
const avatarMock = artifacts.require("AvatarMock");
const UBIMock = artifacts.require("UBISchemeMock");
const ControllerMock = artifacts.require("ControllerMock");
const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

const MAX_INACTIVE_DAYS = 3;
const ONE_DAY = 86400;

export const increaseTime = async function(duration) {
  const id = await Date.now();

  await web3.currentProvider.send({
    jsonrpc: "2.0",
    method: 'evm_increaseTime',
    params: [duration],
    id: id + 1 
  }, () => {});

  await web3.currentProvider.send({
    jsonrpc: "2.0",
    method: "evm_mine",
    id: id + 1 
  }, () => {});
};

contract(
  "UBIScheme",
  ([founder, claimer1, claimer2, claimer3, claimer4, fisherman]) => {
    let goodDollar, identity, formula, avatar, ubi, controller;

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
    });

  it("should not accept 0 inactive days in the constructor", async () => {
    let error = await UBIMock.new(avatar.address, identity.address, 10, 0, 100, 0).catch(e => e);
    expect(error.message).to.have.string("Max inactive days cannot be zero");
  });

  it("should deploy the ubi", async () => {
    const now = new Date();
    const startUBI = (now.getTime() / 1000 - 1).toFixed(0);
    now.setFullYear(now.getFullYear() + 1);
    const endUBI = (now.getTime() / 1000).toFixed(0);
    ubi = await UBIMock.new(avatar.address, identity.address, 10, startUBI, endUBI, MAX_INACTIVE_DAYS);
    let isActive = await ubi.isActive();
    expect(isActive).to.be.false;
  });

  it("should not be able to execute claiming when start has not been executed yet", async () => {
    let error = await ubi.claim().catch(e => e);
    expect(error.message).to.have.string("is not active");
  });
  
  it("should not be able to execute fish when start has not been executed yet", async () => {
    let error = await ubi.fish(NULL_ADDRESS).catch(e => e);
    expect(error.message).to.have.string("is not active");
  });
  
  it("should not be able to execute fish when start has not been executed yet", async () => {
    let error = await ubi.fishMulti([NULL_ADDRESS]).catch(e => e);
    expect(error.message).to.have.string("is not active");
  });
  
  it("should not be able to execute fish when start has not been executed yet", async () => {
    let error = await ubi.distribute(0,1).catch(e => e);
    expect(error.message).to.have.string("is not active");
  });
  
  it("should start the ubi", async () => {
    await ubi.start();
    let isActive = await ubi.isActive();
    expect(isActive).to.be.true;
  });

  it("should not be able to execute claiming when the caller is not whitelisted", async () => {
    let error = await ubi.claim().catch(e => e);
    expect(error.message).to.have.string("is not whitelisted");
  });

  it("should insert a new user to the pending list on first time execute claim", async () => {
    await identity.addWhitelisted(claimer1);
    await identity.addWhitelisted(claimer2);
    let tx = await ubi.claim({ from: claimer1 });
    let transaction =await ubi.claim({ from: claimer2 });
    let activeUsersCount = await ubi.activeUsersCount();
    let claimer1Balance = await goodDollar.balanceOf(claimer1);
    expect(claimer1Balance.toNumber()).to.be.equal(0);
    expect(activeUsersCount.toNumber()).to.be.equal(2);
    expect(transaction.logs[1].event).to.be.equal("AddedToPending");
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

  it("should returns a valid distribution calculation when the current balance is lower than the number of daily claimers including the pending users", async () => {
    await goodDollar.mint(avatar.address, "1");
    await increaseTime(ONE_DAY);
    await ubi.claim({ from: claimer1 });  // claimer 1 is now active while claimer2 is pending
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
    await ubi.claim({ from: claimer1 });
    await ubi.claim({ from: claimer2 });
    await increaseTime(ONE_DAY);
    await goodDollar.mint(avatar.address, "1");
    await ubi.claim({ from: claimer1 });
    let avatarBalance = await goodDollar.balanceOf(avatar.address);
    let claimer1Balance = await goodDollar.balanceOf(claimer1);
    expect(avatarBalance.toString()).to.be.equal("0");
    expect(claimer1Balance.toString()).to.be.equal("1");
  });

  it("should auto claim for given today pending users when execute distribute", async () => {
    await identity.addWhitelisted(claimer3);
    await goodDollar.mint(avatar.address, "10");
    await ubi.claim({ from: claimer3 });
    await increaseTime(ONE_DAY);
    let claimer3BalanceBefore = await goodDollar.balanceOf(claimer3);
    await ubi.distribute(0,3);
    let claimer3BalanceAfter = await goodDollar.balanceOf(claimer3);
    let dailyUbi = await ubi.dailyUbi();
    expect(claimer3BalanceAfter.toNumber() - claimer3BalanceBefore.toNumber()).to.be.equal(dailyUbi.toNumber());
  });

  it("should be able to claim for second time for a new user", async () => {
    let claimer3BalanceBefore = await goodDollar.balanceOf(claimer3);
    await ubi.claim({ from: claimer3 });
    let claimer3BalanceAfter = await goodDollar.balanceOf(claimer3);
    let dailyUbi = await ubi.dailyUbi();
    expect(claimer3BalanceAfter.toNumber() - claimer3BalanceBefore.toNumber()).to.be.equal(dailyUbi.toNumber());
  });

  it("should not auto claim for given users which are not in today pending list when execute distribute", async () => {
    await identity.addWhitelisted(claimer4);
    let claimer3BalanceBefore = await goodDollar.balanceOf(claimer3);
    let claimer4BalanceBefore = await goodDollar.balanceOf(claimer4);
    await ubi.distribute(0,10);
    let claimer3BalanceAfter = await goodDollar.balanceOf(claimer3);
    let claimer4BalanceAfter = await goodDollar.balanceOf(claimer4);
    expect(claimer3BalanceAfter.toNumber()).to.be.equal(claimer3BalanceBefore.toNumber());
    expect(claimer4BalanceAfter.toNumber()).to.be.equal(claimer4BalanceBefore.toNumber());
  });

  it("should not be able to execute claim after the user received tokens because of distribute had been executed", async () => {
    await ubi.claim({ from: claimer4 });
    await increaseTime(2*ONE_DAY);
    let claimer4BalanceBefore = await goodDollar.balanceOf(claimer4);
    await ubi.distribute(0,10);
    let claimer4BalanceAfter = await goodDollar.balanceOf(claimer4);
    let dailyUbi = await ubi.dailyUbi();
    let transaction = await ubi.claim({ from: claimer4 }).catch(e => e);
    expect(claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber()).to.be.equal(dailyUbi.toNumber());
    expect(transaction.logs[0].event).to.be.equal("AlreadyClaimed");
  });

  it("should not be able to fish an active user", async () => {
    let isActiveUser = await ubi.isActiveUser(claimer4);
    let error = await ubi.fish(claimer4, { from: fisherman }).catch(e => e);
    expect(isActiveUser).to.be.true;
    expect(error.message).to.have.string("is not an inactive use");
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
    expect(claimer4Balance2.toNumber() - claimer4Balance1.toNumber()).to.be.equal(dailyUbi.toNumber());
    expect(claimer4Balance3.toNumber() - claimer4Balance1.toNumber()).to.be.equal(dailyUbi.toNumber());
  });

  it("should not reclaim when execute distribute for a user who already claimed on the same day", async () => {
    await goodDollar.mint(avatar.address, "20");
    await increaseTime(ONE_DAY);
    let claimer4Balance1 = await goodDollar.balanceOf(claimer4);
    await ubi.claim({ from: claimer4 })
    let claimer4Balance2 = await goodDollar.balanceOf(claimer4);
    await ubi.distribute(0,20);
    let dailyUbi = await ubi.dailyUbi();
    let claimer4Balance3 = await goodDollar.balanceOf(claimer4);
    expect(claimer4Balance2.toNumber() - claimer4Balance1.toNumber()).to.be.equal(dailyUbi.toNumber());
    expect(claimer4Balance2.toNumber() - claimer4Balance1.toNumber()).to.be.equal(claimer4Balance3.toNumber() - claimer4Balance1.toNumber());
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
    expect(tx.logs[1].event).to.be.equal("UBIFished");
    expect(claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber()).to.be.equal(dailyUbi.toNumber());
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
    expect(claimer4BalanceAfter.toNumber()).to.be.equal(claimer4BalanceBefore.toNumber());
  });

  it("should be able to fish multiple user", async () => {
    await goodDollar.mint(avatar.address, "20");
    await increaseTime(MAX_INACTIVE_DAYS * ONE_DAY);
    let claimer4BalanceBefore = await goodDollar.balanceOf(claimer4);
    let tx = await ubi.fishMulti([claimer2, claimer3], { from: claimer4 });
    let claimer4BalanceAfter = await goodDollar.balanceOf(claimer4);
    let dailyUbi = await ubi.dailyUbi();
    expect(tx.logs[1].event).to.be.equal("UBIFished");
    expect(claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber()).to.be.equal(2 * dailyUbi.toNumber());
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
    expect(claimer4BalanceAfter.toNumber()).to.be.equal(claimer4BalanceBefore.toNumber());
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
    expect(tx.logs[1].event).to.be.equal("UBIFished");
    expect(claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber()).to.be.equal(dailyUbi.toNumber());
  });

  it("should be able to fish user that had been pending but then removed from the whitelist", async () => {
    await goodDollar.mint(avatar.address, "20");
    await identity.addWhitelisted(claimer2);
    await ubi.claim({ from: claimer2 }); // pending user
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
    expect(tx.logs[1].event).to.be.equal("UBIFished");
    expect(claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber()).to.be.equal(dailyUbi.toNumber());
  });

  it("should be able to insert to the pending list user that already removed and added again to the whitelist", async () => {
    let isFishedBefore = await ubi.fishedUsersAddresses(claimer2);
    let activeUsersCountBefore = await ubi.activeUsersCount();
    await identity.addWhitelisted(claimer2);
    await ubi.claim({ from: claimer2 });
    let isFishedAfter = await ubi.fishedUsersAddresses(claimer2);
    let activeUsersCountAfter = await ubi.activeUsersCount();
    expect(isFishedBefore).to.be.true;
    expect(isFishedAfter).to.be.false;
    expect(activeUsersCountAfter.toNumber() - activeUsersCountBefore.toNumber()).to.be.equal(1);
  });

  it("should be able to auto claim by a user that already removed and added again to the whitelist", async () => {
    await goodDollar.mint(avatar.address, "20");
    await increaseTime(ONE_DAY);
    let claimer4Balance1 = await goodDollar.balanceOf(claimer2);
    let transaction = await ubi.distribute(6, 7);
    let claimer4Balance2 = await goodDollar.balanceOf(claimer2);
    let dailyUbi = await ubi.dailyUbi();
    expect(claimer4Balance2.toNumber() - claimer4Balance1.toNumber()).to.be.equal(dailyUbi.toNumber());
    expect(transaction.logs[2].event).to.be.equal("UBIDistributed");
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
    expect(((ubiBalance.add(avatarBalance)).div(activeUsersCount)).toNumber()).to.be.equal(claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber());
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
    expect(((ubiBalance.add(avatarBalance)).div(activeUsersCount)).toNumber()).to.be.equal(claimer4BalanceAfter.toNumber() - claimer4BalanceBefore.toNumber());
    expect(((ubiBalance.add(avatarBalance)).div(activeUsersCount)).toNumber()).to.be.equal(dailyUbi.toNumber());
  });
  
  it("should not be able to iterate over more than the allowed number of accounts in fishMulti", async () => {
    let error = await ubi.fishMulti([claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,
                                      claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,
                                      claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,claimer1,
                                      ]).catch(e => e);
    expect(error.message).to.have.string('exceeds of gas limitations');
  });
});
