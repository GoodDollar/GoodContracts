const fse = require("fs-extra");
const settings = require("./deploy-settings.json");
const StakingContract = artifacts.require("./SimpleDAIStaking.sol");
const Reserve = artifacts.require("./GoodReserveCDai.sol");
const DAIMock = artifacts.require("./DAIMock.sol");
const cDAIMock = artifacts.require("./cDAIMock.sol");
const GoodDollar = artifacts.require("./GoodDollar.sol");
const UBIScheme = artifacts.require("./UBIScheme.sol");

const { networks } = require("../truffle-config.js");
module.exports = async function(deployer, network) {
  if (network.indexOf("production") >= 0 || network.indexOf("test") >= 0) {
    return;
  }

  const batch = new web3.BatchRequest();
  await deployer;
  const networkSettings = { ...settings["default"], ...settings[network] };
  const accounts = await web3.eth.getAccounts();
  const staking_file = await fse.readFile("releases/deployment.json", "utf8");
  const dao_file = await fse.readFile("../releases/deployment.json", "utf8");
  const staking_deployment = await JSON.parse(staking_file);
  const dao_deployment = await JSON.parse(dao_file);

  if (network.indexOf("mainnet") >= 0 || network === "develop") {
    let staking_mainnet_addresses = staking_deployment[network];
    const dai = await DAIMock.at(staking_mainnet_addresses.DAI);
    const cDAI = await cDAIMock.at(staking_mainnet_addresses.cDAI);
    const simpleStaking = await StakingContract.at(staking_mainnet_addresses.DAIStaking);
    const goodReserve = await Reserve.at(staking_mainnet_addresses.Reserve);

    console.log("minting dai");
    await dai.allocateTo(accounts[0], web3.utils.toWei("100", "ether"));
    console.log("approving...");
    await dai.approve(cDAI.address, web3.utils.toWei("100", "ether"));
    await cDAI.mint(web3.utils.toWei("100", "ether"));
    let ownercDaiBalanceAfter = await cDAI.balanceOf(accounts[0]).then(_ => _.toString());

    await cDAI.transfer(simpleStaking.address, ownercDaiBalanceAfter);
    let stakingBalance = await cDAI
      .balanceOf(simpleStaking.address)
      .then(_ => _.toString());
    console.log({ stakingBalance });
  }
};
