const GoodCompoundStaking = artifacts.require("GoodCompoundStaking");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");

const fse = require("fs-extra");

const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NETWORK = "test";

contract("SimpleDAIStaking - `test` network e2e tests", ([founder, staker]) => {
  let dai;
  let cDAI;
  let simpleStaking;

  before(async function() {
    let network = process.env.NETWORK;
    if (network === "tdd") {
      this.skip();
    }
    const file = await fse.readFile("releases/deployment.json", "utf8");
    const deployment = await JSON.parse(file);
    const addresses = deployment[NETWORK];
    const DAI_ADDRESS = addresses["DAI"];
    const cDAI_ADDRESS = addresses["cDAI"];
    const STAKING_ADDRESS = addresses["DAIStaking"];
    dai = await DAIMock.at(DAI_ADDRESS);
    cDAI = await cDAIMock.at(cDAI_ADDRESS);
    simpleStaking = await GoodCompoundStaking.at(STAKING_ADDRESS);
  });

  it("should be able to stake dai", async () => {
    await dai.mint(staker, web3.utils.toWei("100", "ether"));
    await dai.approve(simpleStaking.address, web3.utils.toWei("100", "ether"), {
      from: staker
    });
    await simpleStaking
      .stake(web3.utils.toWei("100", "ether"), {
        from: staker
      })
      .catch(console.log);
    let balance = await simpleStaking.stakers(staker);
    expect(balance.stakedToken.toString()).to.be.equal(
      web3.utils.toWei("100", "ether") //100 dai
    );
    let totalStaked = await simpleStaking.totalStaked();
    expect(totalStaked.toString()).to.be.equal(web3.utils.toWei("100", "ether"));
    let stakedcDaiBalance = await cDAI.balanceOf(simpleStaking.address);
    expect(stakedcDaiBalance.toString()).to.be.equal(
      web3.utils.toWei("9900", "mwei") //8 decimals precision (99 cdai because of the exchange rate dai <> cdai)
    );
  });

  it("should be able to withdraw stake by staker", async () => {
    let stakerDaiBalanceBefore = await dai.balanceOf(staker); // staker DAI balance
    let balanceBefore = await simpleStaking.stakers(staker); // user staked balance in GoodStaking
    await simpleStaking.withdrawStake({
      from: staker
    });
    let stakerDaiBalanceAfter = await dai.balanceOf(staker); // staker DAI balance
    expect(balanceBefore.stakedToken.toString()).to.be.equal(
      (stakerDaiBalanceAfter - stakerDaiBalanceBefore).toString()
    );
  });
});
