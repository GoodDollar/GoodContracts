const fse = require("fs-extra");
const DAIMock = artifacts.require("./DAIMock.sol");
const cDAIMock = artifacts.require("./cDAIMock.sol");
const StakingContract = artifacts.require("./SimpleDAIStaking.sol");

const { networks } = require("../stakingModel/truffle-config.js");

async function getNetworkName() {
  const networkId = await web3.eth.net.getId();
  for (let name in networks) {
    if (networks[name].network_id === networkId.toString())
      return name;
  }
};

module.exports = async function() {
  const network = await getNetworkName();
  const accounts = await web3.eth.getAccounts();
  const staking_file = await fse.readFile("../stakingModel/releases/deployment.json", "utf8");
  const staking_deployment = await JSON.parse(staking_file);
  
  if (network.indexOf("mainnet") >= 0 || network === "develop") {
    let staking_mainnet_addresses = staking_deployment[network];
    const dai = await DAIMock.at(staking_mainnet_addresses.DAI);
    const cDAI = await cDAIMock.at(staking_mainnet_addresses.cDAI);
    const simpleStaking = await StakingContract.at(staking_mainnet_addresses.DAIStaking);

    console.log("minting dai");
    await dai.mint(accounts[0], web3.utils.toWei("100", "ether"));
    // await dai.allocateTo(accounts[0], web3.utils.toWei("100", "ether"));
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
