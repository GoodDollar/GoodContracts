const getSettings = async (network, AbsoluteVote) => {
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
  return {
    daoAddresses: daoAddresses[network] || {},
    modelAddresses: modelAddresses[network] || {},
    upgradableAddresses: upgradableAddresses[network] || {},
    daoSettings: { ...daoSettings["default"], ...daoSettings[network] },
    modelSettings: { ...modelSettings["default"], ...modelSettings[network] },
    upgradableSettings: {
      ...(upgradableSettings["default"] || {}),
      ...(upgradableSettings[network] || {})
    }
  };
};

module.exports.releaser = require("./releaser");
module.exports.getFounders = require("../migrations/getFounders");

module.exports.getSettings = getSettings;
