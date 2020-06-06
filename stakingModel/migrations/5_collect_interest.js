const fse = require("fs-extra");
const settings = require("./deploy-settings.json");
const StakingContract = artifacts.require("./SimpleDAIStaking.sol");
const GoodFundsManager = artifacts.require("./GoodFundManager.sol");

module.exports = async function(deployer, network) {
  if (network.indexOf("production") >= 0) {
    return;
  }

  await deployer;
  const networkSettings = settings[network] || settings["default"];
  const staking_file = await fse.readFile("releases/deployment.json", "utf8");
  const staking_deployment = await JSON.parse(staking_file);

  if (network.indexOf("mainnet") >= 0 || network === "develop") {
    let staking_mainnet_addresses = staking_deployment[network];
    const simpleStaking = await StakingContract.at(staking_mainnet_addresses.DAIStaking);
    const goodFundManager = await GoodFundsManager.at(staking_mainnet_addresses.FundManager);

    const canCollect = await simpleStaking.canCollect();

    if (network.indexOf("mainnet") >= 0 && !canCollect) return;

    if (network === "develop" && !canCollect)
        for (let i = 0; i < networkSettings.blockInterval; ++i)
          await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine", id: 123 }, () => {});

    console.log("collecting interest...");

    await goodFundManager.transferInterest(simpleStaking.address);
  }
};
