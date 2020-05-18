const SimpleDAIStaking = artifacts.require("SimpleDAIStaking");
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
    const file = await fse.readFile("releases/deployment.json", "utf8");
    const deployment = await JSON.parse(file);
    const addresses = deployment[NETWORK];
    const DAI_ADDRESS = addresses["DAI"];
    const cDAI_ADDRESS = addresses["cDAI"];
    const STAKING_ADDRESS = addresses["DAIStaking"];
    dai = await DAIMock.at(DAI_ADDRESS);
    cDAI = await cDAIMock.at(cDAI_ADDRESS);
    simpleStaking = await SimpleDAIStaking.at(STAKING_ADDRESS);
  });

  it("should mint new dai", async () => {
    let balance = await dai.balanceOf(founder);
    expect(balance.toString()).to.be.equal("0");
    await dai.mint(staker, web3.utils.toWei("100", "ether"));
    balance = await dai.balanceOf(staker);
    expect(balance.toString()).to.be.at.equal(web3.utils.toWei("100", "ether"));
  });

  it("should mint new cdai", async () => {
    await dai.approve(cDAI.address, web3.utils.toWei("100", "ether"), {
      from: staker
    });
    await cDAI.mint(web3.utils.toWei("100", "ether"), { from: staker });
    let balance = await dai.balanceOf(staker);
    expect(balance.toString()).to.be.equal("0");
    let cdaiBalance = await cDAI.balanceOf(staker);
    expect(cdaiBalance.toString()).to.be.equal(web3.utils.toWei("9900", "mwei"));
  });

  it("should redeem cdai", async () => {
    let cdaiBalance = await cDAI.balanceOf(staker);
    await cDAI.redeem(cdaiBalance.toString(), { from: staker });
    let balance = await dai.balanceOf(staker);
    expect(balance.toString()).to.be.equal(web3.utils.toWei("100", "ether"));
    dai.transfer(dai.address, balance.toString(), { from: staker });
  });

  it("should be able to withdraw stake by staker", async () => {
    let stakerDaiBalanceBefore = await dai.balanceOf(staker); // staker DAI balance
    let balanceBefore = await simpleStaking.stakers(staker); // user staked balance in GoodStaking
    await simpleStaking.withdrawStake({
      from: staker
    });
    let stakerDaiBalanceAfter = await dai.balanceOf(staker); // staker DAI balance
    expect(balanceBefore.stakedDAI.toString()).to.be.equal(
      (stakerDaiBalanceAfter - stakerDaiBalanceBefore).toString()
    );
  });
});
