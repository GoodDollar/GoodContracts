const { deployOrDAOUpgrade } = require("../scripts/upgradableDeployer");
const { getSettings, releaser } = require("../../scripts/getMigrationSettings");

const Invite = artifacts.require("InvitesV1");
const allowUnsafe = true;

module.exports = async (deployer, network, accounts) => {
  if (network === "tdd") return;
  const {
    daoAddresses,
    modelAddresses,
    upgradableAddresses,
    founders
  } = await getSettings(network, "");
  console.log({ daoAddresses, modelAddresses, upgradableAddresses });
  const deployedProxy = upgradableAddresses["Invites"];
  const deployedContracts = await deployOrDAOUpgrade(
    network,
    web3,
    deployer,
    daoAddresses,
    Invite,
    [daoAddresses["Avatar"], daoAddresses["Identity"], daoAddresses["GoodDollar"]],
    null,
    deployedProxy,
    0, //0 hours time lock
    "Invites",
    allowUnsafe
  );

  if (deployedContracts && Object.keys(deployedContracts).length > 0) {
    let releasedContracts = {
      ...upgradableAddresses,
      ...deployedContracts
    };

    await releaser(releasedContracts, network);
  }
};
