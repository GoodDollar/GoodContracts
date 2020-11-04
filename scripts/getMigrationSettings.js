const getSettings = async network => {
  const daoAddresses = require("../releases/deployment.json");
  const modelAddresses = require("../stakingModel/releases/deployment.json");
  let upgradableAddresses = {};
  try {
    upgradableAddresses = require("../upgradables/releases/deployment.json");
  } catch (e) {}
  const releaser = require("./releaser.js");
  const daoSettings = require("../migrations/deploy-settings.json");
  const modelSettings = require("../stakingModel/migrations/deploy-settings.json");
  let upgradableSettings = {};
  try {
    upgradableSettings = require("../upgradables/migrations/deploy-settings.json");
  } catch (e) {}

  //   const networkAddresses = previousDeployment[network];
  //   const networkSettings = { ...settings["default"], ...settings[network] };
  //   const homedao = daoAddresses[network];
  //   console.log({ networkSettings, network, homedao });
  const homeNetwork = network.replace(/-?mainnet/, "");
  const mainNetwork = homeNetwork + "-mainnet";
  return {
    daoAddresses: daoAddresses[homeNetwork] || {},
    modelAddresses: modelAddresses[homeNetwork] || {},
    upgradableAddresses: upgradableAddresses[homeNetwork] || {},
    mainDaoAddresses: daoAddresses[mainNetwork] || {},
    mainModelAddresses: modelAddresses[mainNetwork] || {},
    mainUpgradableAddresses: upgradableAddresses[mainNetwork] || {},
    daoSettings: { ...daoSettings["default"], ...daoSettings[homeNetwork] },
    modelSettings: { ...modelSettings["default"], ...modelSettings[homeNetwork] },
    upgradableSettings: {
      ...(upgradableSettings["default"] || {}),
      ...(upgradableSettings[homeNetwork] || {})
    }
  };
};

module.exports.releaser = require("./releaser");
module.exports.getFounders = require("../migrations/getFounders");

module.exports.getSettings = getSettings;
