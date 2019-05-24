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
    identity.addWhitelisted(GoodDollar.address);
    identity.addWhitelisted(GoodDollarReserve.address);
    identity.addWhitelisted(OneTimePaymentLinks.address);
    let totalSupply = 0;

    totalSupply = (await GDD.totalSupply.call()).toString(10);
    console.log("Before initialMove() - GoodDollar totalSupply:", totalSupply);
    console.log("Initializing amount of GTC in the market.");

    // Minting X number of GoodDollars to the GoodDollar market.
    let reserve = await GoodDollarReserve.deployed();
    await GDD.initialMove(GoodDollarReserve.address, 100000);
    totalSupply = (await GDD.totalSupply.call()).toString(10);
    let poolBalance = (await reserve.poolBalance()).toString(10);
    let forex = (await reserve.calculateAmountPurchased(
      web3.utils.toWei("1", "ether")
    )).toString(10);
    console.log("After initialMove() - GoodDollar totalSupply:", {
      totalSupply,
      poolBalance,
      oneETHtoGD: forex
    });

    await GDD.setMonetaryPolicy(GoodDollarReserve.address);
    await GDD.transferOwnership(GoodDollarReserve.address);
    await GDD.addMinter(GoodDollarReserve.address);
    await GDD.renounceMinter();
    console.log("Done moving ownership of token to reserve");
    await (await RedemptionData.deployed()).transferOwnership(
      RedemptionFunctional.address
    );
    console.log("Done moving ownership of claim data to claim contract");
    await (await GoodDollarReserve.deployed()).transferOwnership(
      RedemptionFunctional.address
    );
    console.log("Done moving ownership of reserve to claim contract");

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
