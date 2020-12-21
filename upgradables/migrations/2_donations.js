const { networkNames } = require("@openzeppelin/upgrades-core");
const { deployOrDAOUpgrade } = require("../scripts/upgradableDeployer");
const { getSettings, releaser } = require("../../scripts/getMigrationSettings");

const DonationsStaking = artifacts.require("DonationsStaking");

module.exports = async (deployer, network, accounts) => {
  if (network === "tdd") return;

  if (network.indexOf("mainnet") < 0 && network !== "test" && network !== "develop") {
    console.log("not deploying on sidechain");
    return;
  }

  networkNames[1] = network;
  networkNames[122] = network;
  networkNames[3] = network;
  const {
    mainDaoAddresses: daoAddresses,
    mainModelAddresses: modelAddresses,
    mainUpgradableAddresses: upgradableAddresses,
    founders
  } = await getSettings(network, "");
  console.log({ daoAddresses, modelAddresses, upgradableAddresses });
  const deployedProxy = upgradableAddresses["DonationsStaking"];
  const deployedContracts = await deployOrDAOUpgrade(
    network,
    web3,
    deployer,
    daoAddresses,
    DonationsStaking,
    [daoAddresses["Avatar"], modelAddresses["DAIStaking"], modelAddresses["DAI"]],
    null,
    deployedProxy,
    0 //0 hours time lock
  );

  if (deployedContracts && Object.keys(deployedContracts).length > 0) {
    let releasedContracts = {
      ...upgradableAddresses,
      ...deployedContracts
    };

    await releaser(releasedContracts, network);
  }
};
