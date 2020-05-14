const SimpleDAIStaking = artifacts.require("SimpleDAIStaking");
const GoodReserve = artifacts.require("GoodReserveCDai");
const MarketMaker = artifacts.require("GoodMarketMaker");
const GoodFundsManager = artifacts.require("GoodFundManager");
const GoodDollar = artifacts.require("GoodDollar");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");
const Identity = artifacts.require("IdentityMock");
const Formula = artifacts.require("FeeFormula");
const avatarMock = artifacts.require("AvatarMock");
const ControllerMock = artifacts.require("ControllerMock");
const ContributionCalculation = artifacts.require("ContributionCalculation");

const BN = web3.utils.BN;
export const BLOCK_INTERVAL = 0;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

contract(
  "GoodFundManager - transfer interest from the staking contract to the reserve contract",
  ([founder, staker]) => {
    let dai,
      cDAI,
      marketMaker,
      goodReserve,
      simpleStaking,
      goodFundManager,
      goodDollar,
      identity,
      formula,
      avatar,
      controller,
      contribution;

    before(async () => {
      dai = await DAIMock.new();
      cDAI = await cDAIMock.new(dai.address);
      dai.mint(cDAI.address, web3.utils.toWei("100000000", "ether"));
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
      goodFundManager = await GoodFundsManager.new(
        cDAI.address,
        avatar.address,
        identity.address,
        BLOCK_INTERVAL
      );
      await goodFundManager.start();
      simpleStaking = await SimpleDAIStaking.new(
        dai.address,
        cDAI.address,
        goodFundManager.address,
        BLOCK_INTERVAL
      );
      marketMaker = await MarketMaker.new(
        goodDollar.address,
        999388834642296,
        1e15,
        avatar.address
      );
      contribution = await ContributionCalculation.new(avatar.address, 0, 1e15);
      goodReserve = await GoodReserve.new(
        dai.address,
        cDAI.address,
        goodDollar.address,
        goodFundManager.address,
        avatar.address,
        identity.address,
        marketMaker.address,
        contribution.address,
        BLOCK_INTERVAL
      );
      await goodReserve.start();
      await marketMaker.initializeToken(
        cDAI.address,
        "100", //1gd
        "10000", //0.0001 cDai
        "1000000" //100% rr
      );
      await marketMaker.transferOwnership(goodReserve.address);
      goodDollar.addMinter(goodReserve.address);
    });

    it("should not transfer before reserve has been set", async () => {
      let error = await goodFundManager
        .transferInterest(simpleStaking.address)
        .catch(e => e);
      expect(error.message).to.have.string("reserve has not initialized");
    });

    it("should not be able to set the reserve if the sender is not the dao", async () => {
      let error = await goodFundManager.setReserve(goodReserve.address).catch(e => e);
      expect(error.message).to.have.string("only Avatar can call this method");
    });

    it("should set the reserve in the fund manager", async () => {
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "setReserve",
          type: "function",
          inputs: [
            {
              type: "address",
              name: "_reserve"
            }
          ]
        },
        [goodReserve.address]
      );
      await controller.genericCall(
        goodFundManager.address,
        encodedCall,
        avatar.address,
        0
      );
      let reserve = await goodFundManager.reserve();
      expect(reserve).to.be.equal(goodReserve.address);
    });

    it("should be able to stake dai", async () => {
      await dai.mint(staker, web3.utils.toWei("100", "ether"));
      await dai.approve(simpleStaking.address, web3.utils.toWei("100", "ether"), {
        from: staker
      });
      await simpleStaking
        .stakeDAI(web3.utils.toWei("100", "ether"), {
          from: staker
        })
        .catch(console.log);
      let balance = await simpleStaking.stakers(staker);
      expect(balance.stakedDAI.toString()).to.be.equal(
        web3.utils.toWei("100", "ether") //100 dai
      );
      let totalStaked = await simpleStaking.totalStaked();
      expect(totalStaked.toString()).to.be.equal(web3.utils.toWei("100", "ether"));
      let stakedcDaiBalance = await cDAI.balanceOf(simpleStaking.address);
      expect(stakedcDaiBalance.toString()).to.be.equal(
        web3.utils.toWei("9900", "mwei") //8 decimals precision (99 cdai because of the exchange rate dai <> cdai)
      );
    });

    it("should transfer ubi interest to the reserve and recieves minted gd back to the staking contract", async () => {
      await cDAI.exchangeRateCurrent();
      const gdPriceBefore = await marketMaker.currentPrice(cDAI.address);
      let gains = await simpleStaking.currentUBIInterest();
      let cdaiGains = gains["0"];
      let reserveCDaiBalanceBefore = await cDAI.balanceOf(goodReserve.address);
      let tx = await goodFundManager.transferInterest(simpleStaking.address);
      let reserveCDaiBalanceAfter = await cDAI.balanceOf(goodReserve.address);
      let stakingGDBalance = await goodDollar.balanceOf(simpleStaking.address);
      const gdPriceAfter = await marketMaker.currentPrice(cDAI.address);
      expect(stakingGDBalance.toString()).to.be.equal("970492");
      expect(
        reserveCDaiBalanceAfter.sub(reserveCDaiBalanceBefore).toString()
      ).to.be.equal(cdaiGains.toString());
      expect(gdPriceAfter.toString()).to.be.equal(gdPriceBefore.toString());
      expect(tx.logs[0].event).to.be.equal("FundsTransferred");
    });

    it("should set block interval by avatar", async () => {
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "setBlockInterval",
          type: "function",
          inputs: [
            {
              type: "uint256",
              name: "_blockInterval"
            }
          ]
        },
        [100]
      );
      await controller.genericCall(
        goodFundManager.address,
        encodedCall,
        avatar.address,
        0
      );
      const newBI = await goodFundManager.blockInterval();
      expect(newBI.toString()).to.be.equal("100");
    });

    it("should not mint UBI if not in the interval", async () => {
      const error = await goodFundManager
        .transferInterest(simpleStaking.address)
        .catch(e => e);
      expect(error.message).to.have.string("wait for the next interval");
    });

    it("should not be able to destroy the contract if the caller is not the dao", async () => {
      let error = await goodFundManager.end(avatar.address).catch(e => e);
      expect(error.message).to.have.string("only Avatar can call this method");
    });

    it("should destroy the contract and transfer funds to the given destination", async () => {
      let avatarCDAIBalanceBefore = await cDAI.balanceOf(avatar.address);
      let fundmanagerCDAIBalanceBefore = await cDAI.balanceOf(goodFundManager.address);
      let avatarGDBalanceBefore = await goodDollar.balanceOf(avatar.address);
      let fundmanagerGDBalanceBefore = await goodDollar.balanceOf(
        goodFundManager.address
      );
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "end",
          type: "function",
          inputs: [
            {
              type: "address",
              name: "_avatar"
            }
          ]
        },
        [avatar.address]
      );
      await controller.genericCall(
        goodFundManager.address,
        encodedCall,
        avatar.address,
        0
      );
      let avatarCDAIBalanceAfter = await cDAI.balanceOf(avatar.address);
      let fundmanagerCDAIBalanceAfter = await cDAI.balanceOf(goodFundManager.address);
      let avatarGDBalanceAfter = await goodDollar.balanceOf(avatar.address);
      let fundmanagerGDBalanceAfter = await goodDollar.balanceOf(goodFundManager.address);
      let code = await web3.eth.getCode(goodFundManager.address);
      expect((avatarCDAIBalanceAfter - avatarCDAIBalanceBefore).toString()).to.be.equal(
        fundmanagerCDAIBalanceBefore.toString()
      );
      expect(fundmanagerCDAIBalanceAfter.toString()).to.be.equal("0");
      expect((avatarGDBalanceAfter - avatarGDBalanceBefore).toString()).to.be.equal(
        fundmanagerGDBalanceBefore.toString()
      );
      expect(fundmanagerGDBalanceAfter.toString()).to.be.equal("0");
      expect(code.toString()).to.be.equal("0x");
    });
  }
);
