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
    let totalStaked = await simpleStaking.totalStaked();
    expect(totalStaked.toString()).to.be.equal(
      web3.utils.toWei("100", "ether")
    );
    let stakedcDaiBalance = await cDAI.balanceOf(simpleStaking.address);
    expect(stakedcDaiBalance.toString()).to.be.equal(
      web3.utils.toWei("9900", "mwei") //8 decimals precision (99 cdai)
    );
  });

  it("should not be able to stake 0 dai", async () => {
    await helpers.assertVMException(simpleStaking
                                    .stakeDAI(web3.utils.toWei("0", "ether"), {
                                      from: staker
                                    }), "You need to stake a positive token amount");
  });

  it("should be able to stake dai when the allowed dai amount is higher than the staked amount", async () => {
    dai.mint(staker, web3.utils.toWei("100", "ether"));
    dai.approve(simpleStaking.address, web3.utils.toWei("200", "ether"), {
      from: staker
    });

    let balanceBefore = await simpleStaking.stakers(staker);
    let stakedcDaiBalanceBefore = await cDAI.balanceOf(simpleStaking.address);

    await simpleStaking
      .stakeDAI(web3.utils.toWei("100", "ether"), {
        from: staker
      })
      .catch(console.log);
    
    let balanceAfter = await simpleStaking.stakers(staker);
    expect((balanceAfter.stakedDAI - balanceBefore.stakedDAI).toString()).to.be.equal(
      web3.utils.toWei("100", "ether") //100 dai
    );

    let stakedcDaiBalanceAfter = await cDAI.balanceOf(simpleStaking.address);
    expect((stakedcDaiBalanceAfter - stakedcDaiBalanceBefore).toString()).to.be.equal(
      web3.utils.toWei("9900", "mwei") //8 decimals precision (99 cdai)
    );
  });

  it("should not be able to stake when approved dai amount is too low", async () => {
    let lowWeiAmount = web3.utils.toWei("99", "ether");
    let weiAmount = web3.utils.toWei("100", "ether");

    dai.mint(staker, weiAmount);
    dai.approve(simpleStaking.address, lowWeiAmount, {
      from: staker
    });
  
    await helpers.assertVMException(simpleStaking
      .stakeDAI(weiAmount, {
        from: staker
      }), "You need to approve DAI transfer first");
  });

  it("should not be able to stake when staker dai balance is too low", async () => {
    let currentBalance = await dai.balanceOf(staker);
    let weiAmount = web3.utils.toWei("100", "ether");
    let approvedAmount = (currentBalance.valueOf() + weiAmount);
    
    dai.approve(simpleStaking.address, approvedAmount, {
      from: staker
    });
  
    await helpers.assertVMException(simpleStaking
                                    .stakeDAI(approvedAmount, {
                                      from: staker
                                    }));
  });

  it("should emit a DAIStaked event", async () => {
    const weiAmount = web3.utils.toWei("100", "ether");
    dai.mint(staker, weiAmount);
    dai.approve(simpleStaking.address, weiAmount, {
      from: staker
    });

    const transaction = await simpleStaking
                      .stakeDAI(weiAmount, {
                        from: staker
                      })
                      .catch(console.log);

    assert(transaction.logs[0].event === 'DAIStaked');
    assert.equal(transaction.logs[0].args.daiValue.valueOf(), weiAmount);
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
    let stakedcDaiBalanceBefore = await cDAI.balanceOf(simpleStaking.address); // simpleStaking cDAI balance
    let stakerDaiBalanceBefore = await dai.balanceOf(staker); // staker DAI balance
    let balanceBefore = await simpleStaking.stakers(staker); // user staked balance in GoodStaking
    let totalStakedBefore = await simpleStaking.totalStaked(); // total staked in GoodStaking
    const transaction = await simpleStaking.withdrawStake({
                          from: staker
                        });
    let stakedcDaiBalanceAfter = await cDAI.balanceOf(simpleStaking.address);  // simpleStaking cDAI balance
    let stakerDaiBalanceAfter = await dai.balanceOf(staker); // staker DAI balance
    let balanceAfter = await simpleStaking.stakers(staker);  // user staked balance in GoodStaking
    let totalStakedAfter = await simpleStaking.totalStaked(); // total staked in GoodStaking
    expect(stakedcDaiBalanceAfter.lt(stakedcDaiBalanceBefore)).to.be.true;
    expect(stakerDaiBalanceAfter.gt(stakerDaiBalanceBefore)).to.be.true;
    expect(balanceBefore.stakedDAI.toString()).to.be.equal((stakerDaiBalanceAfter - stakerDaiBalanceBefore).toString());
    expect((totalStakedBefore - totalStakedAfter).toString()).to.be.equal(balanceBefore.stakedDAI.toString());
    expect(balanceAfter.stakedDAI.toString()).to.be.equal("0");
    expect(stakedcDaiBalanceAfter.toString()).to.not.be.equal("0"); //precision loss, so it wont be exactly 0
    expect(transaction.logs[0].event).to.be.equal("DAIStakeWithdraw");
    expect(transaction.logs[0].args.staker).to.be.equal(staker);
    expect(transaction.logs[0].args.daiValue.toString()).to.be.equal((stakerDaiBalanceAfter - stakerDaiBalanceBefore).toString());
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

  it("should not be able to change the reserve cDAI balance in case of an error", async () => {
    let stakedcDaiBalanceBefore = await cDAI.balanceOf(simpleStaking.address);
    await simpleStaking
      .withdrawStake({
        from: founder
      })
      .catch(e => e);
    let stakedcDaiBalanceAfter = await cDAI.balanceOf(simpleStaking.address);
    expect(stakedcDaiBalanceAfter.toString()).to.be.equal(stakedcDaiBalanceBefore.toString());
  });
});
