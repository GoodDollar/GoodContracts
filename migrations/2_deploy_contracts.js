let Identity = artifacts.require("Identity");
let DAO = artifacts.require("DAO")
var GoodDollar = artifacts.require("GoodDollar");

module.exports = function(deployer) {
    if (deployer.network === 'development' ||
        deployer.network === 'develop' ||
        deployer.network === 'ropsten') {
      deployer.deploy(Identity)
        .then(() => {
          return deployer.deploy(DAO);
        })
        .then(() => {
          return deployer.deploy(
              GoodDollar,
              "GoodDollar",
              "GDD",
              2,
              Identity.address,
              DAO.address);
        })
    }
};
