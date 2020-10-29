const { deployOrDAOUpgrade } = require("../scripts/upgradableDeployer");
const { getSettings, releaser } = require("../../scripts/getMigrationSettings");

const DonationsStaking = artifacts.require("DonationsStaking");

module.exports = async (deployer, network, accounts) => {
  if (network === "tdd") return;

  const {
    daoAddresses,
    modelAddresses,
    upgradableAddresses,
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
