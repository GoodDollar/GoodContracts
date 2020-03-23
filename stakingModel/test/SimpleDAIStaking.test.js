import * as helpers from "../../test/helpers";

const SimpleDAIStaking = artifacts.require("SimpleDAIStaking");
const GoodDollar = artifacts.require("GoodDollar");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");

const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("SimpleDAIStaking - staking with DAI mocks", ([founder, staker]) => {
  let dai;
  let cDAI;
  let simpleStaking;

  before(async () => {
    dai = await DAIMock.new();
    cDAI = await cDAIMock.new(dai.address);
    dai.mint(cDAI.address, web3.utils.toWei("100000000", "ether"));
    simpleStaking = await SimpleDAIStaking.new(
      dai.address,
      cDAI.address,
      NULL_ADDRESS,
      founder
    );
  });

  it("should mock cdai exchange rate 1e28 precision", async () => {
    let rate = await cDAI.exchangeRateStored();
    expect(rate.toString()).to.be.equal("10101010101010101010101010101");
  });
  it("should mint new dai", async () => {
    let balance = await dai.balanceOf(founder);
    expect(balance.toString()).to.be.equal("0");
    await dai.mint(staker, web3.utils.toWei("100", "ether"));
    balance = await dai.balanceOf(staker);
    expect(balance.toString()).to.be.at.equal(web3.utils.toWei("100", "ether"));
  });

  it("should mint new cdai", async () => {
    let balance = await dai.balanceOf(staker);
    expect(balance.toString()).to.be.at.equal(web3.utils.toWei("100", "ether"));
    dai.approve(cDAI.address, web3.utils.toWei("100", "ether"), {
      from: staker
    });
    await cDAI.mint(web3.utils.toWei("100", "ether"), { from: staker });
    balance = await dai.balanceOf(staker);
    expect(balance.toString()).to.be.equal("0");
    let cdaiBalance = await cDAI.balanceOf(staker);
    expect(cdaiBalance.toString()).to.be.equal(
      web3.utils.toWei("9900", "mwei")
    );
  });

  it("should redeem cdai", async () => {
    let cdaiBalance = await cDAI.balanceOf(staker);
    await cDAI.redeem(cdaiBalance.toString(), { from: staker });
    let balance = await dai.balanceOf(staker);
    expect(balance.toString()).to.be.equal(web3.utils.toWei("100", "ether"));
    dai.transfer(dai.address, balance.toString(), { from: staker });
  });

  it("should be able to stake dai", async () => {
    dai.mint(staker, web3.utils.toWei("100", "ether"));
    dai.approve(simpleStaking.address, web3.utils.toWei("100", "ether"), {
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
    let stakedcDaiBalance = await cDAI.balanceOf(simpleStaking.address);
    expect(stakedcDaiBalance.toString()).to.be.equal(
      web3.utils.toWei("9900", "mwei") //8 decimals precision (99 cdai)
    );
  });

  it("should convert user staked DAI to the equal value of cDAI owned by the staking contract", async () => {
    let stakedDaiBalanceBefore = await dai.balanceOf(simpleStaking.address);
    dai.mint(staker, web3.utils.toWei("100", "ether"));
    dai.approve(simpleStaking.address, web3.utils.toWei("100", "ether"), {
      from: staker
    });
    await simpleStaking
      .stakeDAI(web3.utils.toWei("100", "ether"), {
        from: staker
      })
      .catch(console.log);
    let stakedcDaiBalance = await cDAI.balanceOf(simpleStaking.address);
    expect(stakedcDaiBalance.toString()).to.be.equal(
      web3.utils.toWei("19800", "mwei") //8 decimals precision (99 cdai)
    );
    let stakedDaiBalanceAfter = await dai.balanceOf(simpleStaking.address);
    expect(stakedDaiBalanceAfter.toString()).to.be.equal(stakedDaiBalanceBefore.toString());
  });

  it("should not mint the converted cDAI to the staker", async () => {
    let stakercDaiBalanceBefore = await cDAI.balanceOf(staker);
    dai.mint(staker, web3.utils.toWei("100", "ether"));
    dai.approve(simpleStaking.address, web3.utils.toWei("100", "ether"), {
      from: staker
    });
    await simpleStaking
      .stakeDAI(web3.utils.toWei("100", "ether"), {
        from: staker
      })
      .catch(console.log);
    let stakercDaiBalanceAfter = await cDAI.balanceOf(staker);
    expect(stakercDaiBalanceAfter.toString()).to.be.equal(stakercDaiBalanceBefore.toString());
  });

  it("should not change the staker DAI balance if the conversion failed", async () => {
    let fakeDai = await DAIMock.new();
    let fakecDAI = await cDAIMock.new(fakeDai.address);
    fakeDai.mint(fakecDAI.address, web3.utils.toWei("100000000", "ether"));
    let fakeSimpleStaking = await SimpleDAIStaking.new(
        dai.address,
        fakecDAI.address,
        NULL_ADDRESS,
        founder
      ); // staking should failed
    dai.mint(staker, web3.utils.toWei("100", "ether"));
    dai.approve(fakeSimpleStaking.address, web3.utils.toWei("100", "ether"), {
      from: staker
    });
    let stakerDaiBalanceBefore = await dai.balanceOf(staker);
    await helpers.assertVMException(fakeSimpleStaking
      .stakeDAI(web3.utils.toWei("100", "ether"), {
        from: staker
      }));
    let stakerDaiBalanceAfter = await dai.balanceOf(staker);
    expect(stakerDaiBalanceAfter.toString()).to.be.equal(stakerDaiBalanceBefore.toString());
  });

  it("should not change the totalStaked if the conversion failed", async () => {
    let fakeDai = await DAIMock.new();
    let fakecDAI = await cDAIMock.new(fakeDai.address);
    fakeDai.mint(fakecDAI.address, web3.utils.toWei("100000000", "ether"));
    let fakeSimpleStaking = await SimpleDAIStaking.new(
        dai.address,
        fakecDAI.address,
        NULL_ADDRESS,
        founder
      ); // staking should failed
    dai.mint(staker, web3.utils.toWei("100", "ether"));
    dai.approve(fakeSimpleStaking.address, web3.utils.toWei("100", "ether"), {
      from: staker
    });
    let totalStakedBefore = await fakeSimpleStaking.totalStaked();
    await helpers.assertVMException(fakeSimpleStaking
      .stakeDAI(web3.utils.toWei("100", "ether"), {
        from: staker
      }));
    let totalStakedAfter = await fakeSimpleStaking.totalStaked();
    expect(totalStakedAfter.toString()).to.be.equal(totalStakedBefore.toString());
  });

  it("should not update the staker list if the conversion failed", async () => {
    let fakeDai = await DAIMock.new();
    let fakecDAI = await cDAIMock.new(fakeDai.address);
    fakeDai.mint(fakecDAI.address, web3.utils.toWei("100000000", "ether"));
    let fakeSimpleStaking = await SimpleDAIStaking.new(
        dai.address,
        fakecDAI.address,
        NULL_ADDRESS,
        founder
      ); // staking should failed
    dai.mint(staker, web3.utils.toWei("100", "ether"));
    dai.approve(fakeSimpleStaking.address, web3.utils.toWei("100", "ether"), {
      from: staker
    });
    await helpers.assertVMException(fakeSimpleStaking
      .stakeDAI(web3.utils.toWei("100", "ether"), {
        from: staker
      }));
    let balance = await fakeSimpleStaking.stakers(staker);
    expect(balance.stakedDAI.toString()).to.be.equal(
      web3.utils.toWei("0", "ether") //100 dai
    );
  });

  it("should mock cdai updated exchange rate", async () => {
    let res = await cDAI.exchangeRateCurrent();
    let rate = await cDAI.exchangeRateStored();
    expect(rate.toString()).to.be.equal("10201010101010101010101010101");
  });

  it("should report interest gains", async () => {
    const gains = await simpleStaking.currentUBIInterest();
    const cdaiGains = gains["0"];
    const precisionLossDai = gains["2"];
    expect(cdaiGains.toString()).to.be.equal("97049212"); //8 decimals precision
    expect(precisionLossDai.toString()).to.be.equal("8092929292"); //10 decimals precision lost
  });

  it("should withdraw interest to owner", async () => {
    const gains = await simpleStaking.currentUBIInterest();
    const cdaiGains = gains["0"];
    const precisionLossDai = gains["2"].toString(); //last 10 decimals since cdai is only 8 decimals while dai is 18
    const res = await simpleStaking.collectUBIInterest();
    const fundBalance = await cDAI.balanceOf(founder);
    const fundDaiWorth = await simpleStaking.currentDAIWorth();

    expect(cdaiGains.toString()).to.be.equal(fundBalance.toString());
    expect(fundDaiWorth.toString()).to.be.equal(
      //10 gwei = 10 decimals + precisionLoss = 20 decimals = 100 ether of DAI
      web3.utils.toWei("10", "gwei") + precisionLossDai
    );
  });

  it("should not withdraw again in less than 23 hours", async () => {
    const error = await simpleStaking.collectUBIInterest().catch(e => e);
    expect(error.message).to.have.string(
      "Need to wait at least 23 hours between collections"
    );
  });

  it("should be able to withdraw stake by staker", async () => {
    await simpleStaking.withdrawStake({
      from: staker
    });
    let daiBalance = await dai.balanceOf(staker);
    expect(daiBalance.toString()).to.be.equal(web3.utils.toWei("100", "ether"));
    let stakedcDaiBalance = await cDAI.balanceOf(simpleStaking.address);
    expect(stakedcDaiBalance.toString()).to.not.be.equal("0"); //precision loss, so it wont be exactly 0
  });

  it("should not be able to double withdraw stake", async () => {
    dai.mint(staker, web3.utils.toWei("100", "ether"));
    dai.approve(simpleStaking.address, web3.utils.toWei("100", "ether"), {
      from: staker
    });
    simpleStaking.stakeDAI(web3.utils.toWei("100", "ether"), {
      from: staker
    });
    simpleStaking
      .withdrawStake({
        from: staker
      })
      .catch(e => console.log({ e }));
    const error = await simpleStaking
      .withdrawStake({
        from: staker
      })
      .catch(e => e);
    expect(error.message).to.have.string("No DAI staked");
  });

  it("should not be able to withdraw if not a staker", async () => {
    const error = await simpleStaking
      .withdrawStake({
        from: founder
      })
      .catch(e => e);
    expect(error.message).to.have.string("No DAI staked");
  });
});
