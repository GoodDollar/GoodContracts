const fse = require("fs-extra");
const settings = require("../stakingModel/migrations/deploy-settings.json");
const StakingContract = artifacts.require("./SimpleDAIStaking.sol");
const GoodFundsManager = artifacts.require("./GoodFundManager.sol");

const getNetworkName = () => {
  const argslist = process.argv;
  for (let item of argslist) {
    if (item.indexOf("network=") > 0)
      return item.substring(item.indexOf('=') + 1, item.length);
  }
  return "develop";
};

/**
 * helper script to simulate collecting interest from the staking contract
 */
const simulate = async function() {
  const network = getNetworkName();
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

module.exports = done => {
  simulate()
    .catch(console.log)
    .then(done);
};

