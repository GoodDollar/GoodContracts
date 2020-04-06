const SimpleDAIStaking = artifacts.require("SimpleDAIStaking");
const GoodDollar = artifacts.require("GoodDollar");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");

const fse = require("fs-extra");

const BN = web3.utils.BN;
export const BLOCK_INTERVAL = 2;

// kovan network addresses
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
export const DAI_ADDRESS  = "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa";
export const cDAI_ADDRESS = "0xe7bc397dbd069fc7d0109c0636d06888bb50668c";

contract("SimpleDAIStaking - staking with DAI mocks", ([founder, staker]) => {
  let dai;
  let cDAI;
  let simpleStaking;

  before(async () => {
    dai = await DAIMock.at(DAI_ADDRESS);
    cDAI = await cDAIMock.at(cDAI_ADDRESS);
    simpleStaking = await SimpleDAIStaking.new(
      DAI_ADDRESS,
      cDAI_ADDRESS,
      NULL_ADDRESS,
      founder,
      BLOCK_INTERVAL
    );
  });

  it("should be able to stake dai, withdraw gains if exists, and withdraw the staked tokens", async () => {
    await dai.approve(simpleStaking.address, web3.utils.toWei("500", "gwei"), {
      from: staker
    });
    let balanceBefore = (await simpleStaking.stakers(staker)).stakedDAI;
    let totalStakedBefore = await simpleStaking.totalStaked();
    await simpleStaking
      .stakeDAI(web3.utils.toWei("500", "gwei"), {
        from: staker
      })
      .catch(console.log);
    let balanceAfter = (await simpleStaking.stakers(staker)).stakedDAI;
    expect((balanceAfter - balanceBefore).toString()).to.be.equal(
      web3.utils.toWei("500", "gwei")
    );
    let totalStakedAfter = await simpleStaking.totalStaked();
    expect((totalStakedAfter - totalStakedBefore).toString()).to.be.equal(
      web3.utils.toWei("500", "gwei")
    );
    const gains = await simpleStaking.currentUBIInterest();
    const cdaiGains = gains["0"];
    const fundBalanceBefore = await cDAI.balanceOf(founder);
    await simpleStaking.collectUBIInterest(founder);
    const fundBalanceAfter = await cDAI.balanceOf(founder);
    const fundDaiWorth = await simpleStaking.currentDAIWorth();
    expect(cdaiGains.toString()).to.be.equal((fundBalanceAfter - fundBalanceBefore).toString());
    let stakedcDaiBalanceBefore = await cDAI.balanceOf(simpleStaking.address);
    let stakerDaiBalanceBefore = await dai.balanceOf(staker);
    const transaction = await simpleStaking.withdrawStake({
                          from: staker
                        })
    let stakedcDaiBalanceAfter = await cDAI.balanceOf(simpleStaking.address);
    let stakerDaiBalanceAfter = await dai.balanceOf(staker);
    let balanceAfterWithdraw = (await simpleStaking.stakers(staker)).stakedDAI;
    expect(stakedcDaiBalanceAfter.lt(stakedcDaiBalanceBefore)).to.be.true;
    expect(stakerDaiBalanceAfter.gt(stakerDaiBalanceBefore)).to.be.true;
    expect(balanceAfter.toString()).to.be.equal((stakerDaiBalanceAfter - stakerDaiBalanceBefore).toString());
    expect(balanceAfterWithdraw.toString()).to.be.equal("0");
    expect(transaction.logs[0].event).to.be.equal("DAIStakeWithdraw");
    console.log('finish');
  });
});
