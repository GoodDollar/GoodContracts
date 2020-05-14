var Migrations = artifacts.require("./Migrations.sol");

module.exports = async (deployer, network) => {
  process.env.NETWORK = network;
  if (network === "tdd") return;
  console.log("MAKE SURE TO DEPLOY MAIN PROJECT CONTRACTS FIRST");
};
