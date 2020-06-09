const fse = require("fs-extra");
const settings = require("../stakingModel/migrations/deploy-settings.json");
const StakingContract = artifacts.require("./SimpleDAIStaking.sol");
const GoodFundsManager = artifacts.require("./GoodFundManager.sol");

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
  if (network.indexOf("production") >= 0 || network.indexOf("test") >= 0) {
    return;
  }
  const networkSettings = { ...settings["default"], ...settings[network] };
  const staking_file = await fse.readFile("../stakingModel/releases/deployment.json", "utf8");
  const staking_deployment = await JSON.parse(staking_file);

  if (network.indexOf("mainnet") >= 0 || network === "develop") {
    let staking_mainnet_addresses = staking_deployment[network];
    const simpleStaking = await StakingContract.at(staking_mainnet_addresses.DAIStaking);
    const goodFundManager = await GoodFundsManager.at(
      staking_mainnet_addresses.FundManager
    );

    const canCollect = await simpleStaking.canCollect();

    if (network.indexOf("mainnet") >= 0 && !canCollect) return;

    if (network === "develop" && !canCollect)
      for (let i = 0; i < networkSettings.blockInterval; ++i)
        await web3.currentProvider.send(
          { jsonrpc: "2.0", method: "evm_mine", id: 123 },
          () => {}
        );

    console.log("collecting interest...");

    await goodFundManager.transferInterest(simpleStaking.address);
  }
};
