"use strict";

var BancorFormula = artifacts.require("BancorFormula");
var ExpArray = artifacts.require("ExpArray");
var GoodDollar = artifacts.require("GoodDollar");
var Identity = artifacts.require("Identity");
var GoodDollarReserve = artifacts.require("GoodDollarReserve");
var RedemptionData = artifacts.require("RedemptionData");
var RedemptionFunctional = artifacts.require("RedemptionFunctional");
var OneTimePaymentLinks = artifacts.require("OneTimePaymentLinks");
var releaser = require("../contracts/releaser");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    let owner = accounts[0];
    await deployer.deploy(RedemptionData);
    await deployer.deploy(ExpArray);
    await deployer.deploy(BancorFormula, ExpArray.address);
    let identity = await deployer.deploy(Identity);
    let GDD = await GoodDollar.deployed();

    await deployer.deploy(OneTimePaymentLinks, GoodDollar.address);
    // Deploying the GoodDollarReserve and Creating 10 Ethers in it's account from the deployer.
    await deployer.deploy(
      GoodDollarReserve,
      GDD.address,
      BancorFormula.address,
      Identity.address,
      OneTimePaymentLinks.address,
      "10000",
      { value: web3.utils.toWei("1", "gwei") }
    );
    await deployer.deploy(
      RedemptionFunctional,
      Identity.address,
      RedemptionData.address,
      GoodDollarReserve.address
    );
    if (network === "fuse" || network === "staging") {
      identity.addWhitelistAdmin("0x0aFb8F8B5B581Cd67E8a6e00aC4248A4B6f980E1");
      identity.addWhitelistAdmin("0x8158815481A26c4759d167f4e372a384b5521187");
    }
    identity.addWhitelisted(GoodDollar.address);
    identity.addWhitelisted(GoodDollarReserve.address);
    identity.addWhitelisted(OneTimePaymentLinks.address);

    const releasedContracts = {
      GoodDollar: GoodDollar.address,
      Identity: Identity.address,
      GoodDollarReserve: GoodDollarReserve.address,
      RedemptionData: RedemptionData.address,
      RedemptionFunctional: RedemptionFunctional.address,
      OneTimePaymentLinks: OneTimePaymentLinks.address,
      network,
      networkId: parseInt(deployer.network_id)
    };
    console.log("Writing deployment file...", { releasedContracts });
    await releaser(releasedContracts, network);
  });
};
