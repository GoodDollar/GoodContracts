var Migrations = artifacts.require("./Migrations.sol");

module.exports = function(deployer) {
  process.env.NETWORK = deployer.network;
  deployer.deploy(Migrations);
};
 