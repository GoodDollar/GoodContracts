const GoodCompoundStaking = artifacts.require("GoodCompoundStaking");
const GoodDollar = artifacts.require("GoodDollar");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");
const Identity = artifacts.require("Identity");
const Avatar = artifacts.require("Avatar");

const fse = require("fs-extra");

const BN = web3.utils.BN;
export const BLOCK_INTERVAL = 2;

// kovan network addresses
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
export const DAI_ADDRESS = "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa";
export const cDAI_ADDRESS = "0xe7bc397dbd069fc7d0109c0636d06888bb50668c";

contract("SimpleDAIStaking - kovan e2e test", ([founder, staker]) => {
  let dai;
  let cDAI;
  let simpleStaking, avatar, identity;

  before(async function() {
    let network = process.env.NETWORK;
    if (network !== "kovan") {
      this.skip();
    }
    dai = await DAIMock.at(DAI_ADDRESS);
    cDAI = await cDAIMock.at(cDAI_ADDRESS);
    avatar = await Avatar.deployed();
    (identity = await Identity), deployed();
    simpleStaking = await GoodCompoundStaking.new(
      DAI_ADDRESS,
      cDAI_ADDRESS,
      founder,
      BLOCK_INTERVAL,
      avatar.address,
      identity.address
    );
  });

  it("should be able to stake dai, withdraw gains if exists, and withdraw the staked tokens", async () => {
    await dai.approve(simpleStaking.address, web3.utils.toWei("500", "gwei"), {
      from: staker
    });
    let balanceBefore = (await simpleStaking.getStakerData(staker));
    let totalStakedBefore = (await simpleStaking.interestData()).globalTotalStaked;
    await simpleStaking
      .stake(web3.utils.toWei("500", "gwei"), 100, {
        from: staker
      })
      .catch(console.log);
    let balanceAfter = (await simpleStaking.getStakerData(staker));
    expect((balanceAfter[0] - balanceBefore[0]).toString()).to.be.equal(
      web3.utils.toWei("500", "gwei")
    );
    let totalStakedAfter = (await simpleStaking.interestData()).globalTotalStaked;
    expect((totalStakedAfter - totalStakedBefore).toString()).to.be.equal(
      web3.utils.toWei("500", "gwei")
    );
    const gains = await simpleStaking.currentUBIInterest();
    const cdaiGains = gains["0"];
    const fundBalanceBefore = await cDAI.balanceOf(founder);
    await simpleStaking.collectUBIInterest(founder);
    const fundBalanceAfter = await cDAI.balanceOf(founder);
    const fundDaiWorth = await simpleStaking.currentTokenWorth();
    expect(cdaiGains.toString()).to.be.equal(
      (fundBalanceAfter - fundBalanceBefore).toString()
    );
    let stakedcDaiBalanceBefore = await cDAI.balanceOf(simpleStaking.address);
    let stakerDaiBalanceBefore = await dai.balanceOf(staker);
    const transaction = await simpleStaking.withdrawStake(totalStakedAfter, {
      from: staker
    });
    let stakedcDaiBalanceAfter = await cDAI.balanceOf(simpleStaking.address);
    let stakerDaiBalanceAfter = await dai.balanceOf(staker);
    let balanceAfterWithdraw = (await simpleStaking.getStakerData(staker));
    expect(stakedcDaiBalanceAfter.lt(stakedcDaiBalanceBefore)).to.be.true;
    expect(stakerDaiBalanceAfter.gt(stakerDaiBalanceBefore)).to.be.true;
    expect(balanceAfter.toString()).to.be.equal(
      (stakerDaiBalanceAfter - stakerDaiBalanceBefore).toString()
    );
    expect(balanceAfterWithdraw[0].toString()).to.be.equal("0");
    expect(transaction.logs[0].event).to.be.equal("StakeWithdraw");
    console.log("finish");
  });
});
