const { deployOrDAOUpgrade } = require("../scripts/upgradableDeployer");
const { getSettings, releaser } = require("../../scripts/getMigrationSettings");
const { networkNames } = require("@openzeppelin/upgrades-core");

const Invite = artifacts.require("InvitesV1");
const allowUnsafe = true;

module.exports = async (deployer, network, accounts) => {
  if (network === "tdd") return;

  if (network.indexOf("mainnet") >= 0) {
    console.log("not deploying on mainnet");
    return;
  }

  networkNames[1] = network;
  networkNames[122] = network;
  networkNames[3] = network;

  const {
    daoAddresses,
    modelAddresses,
    upgradableAddresses,
    upgradableSettings
  } = await getSettings(network);
  console.log({ daoAddresses, modelAddresses, upgradableAddresses, upgradableSettings });
  const deployedProxy = upgradableAddresses["Invites"];
  const deployedContracts = await deployOrDAOUpgrade(
    network,
    web3,
    deployer,
    daoAddresses,
    Invite,
    [
      daoAddresses["Avatar"],
      daoAddresses["Identity"],
      daoAddresses["GoodDollar"],
      upgradableSettings.level0Bounty
    ],
    null,
    deployedProxy,
    0, //0 hours time lock
    "Invites",
    allowUnsafe,
    process.env.FORCE_DEPLOY
  );

  if (deployedContracts && Object.keys(deployedContracts).length > 0) {
    let releasedContracts = {
      ...upgradableAddresses,
      ...deployedContracts
    };

    await releaser(releasedContracts, network);
  }
};
