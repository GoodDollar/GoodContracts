'use strict';
 
var BancorFormula = artifacts.require("BancorFormula");
var ExpArray = artifacts.require("ExpArray");
var GoodDollar = artifacts.require("GoodDollar");
var Identity = artifacts.require("Identity");
var GoodDollarReserve = artifacts.require("GoodDollarReserve");
var RedemptionData = artifacts.require("RedemptionData");
var RedemptionFunctional = artifacts.require("RedemptionFunctional");
var releaser = require("../contracts/releaser");

module.exports = function(deployer,network,accounts) {
    deployer.then(async () => {
        let owner = accounts[0];
        await deployer.deploy(RedemptionData);
        await deployer.deploy(ExpArray);
        await deployer.deploy(BancorFormula, ExpArray.address);
        await deployer.deploy(Identity);
        let GDD = await GoodDollar.deployed();
        // Deploying the GoodDollarReserve and Creating 10 Ethers in it's account from the deployer.
        await deployer.deploy(GoodDollarReserve, GDD.address, BancorFormula.address, {'value': web3.utils.toWei("1", "ether")}); 
        
        await deployer.deploy(RedemptionFunctional, Identity.address, RedemptionData.address, GoodDollarReserve.address);

        
        let totalSupply = 0;

        totalSupply = (await GDD.totalSupply.call()).toString(10);
        console.log("Before initialMove() - GoodDollar totalSupply:",totalSupply);
        console.log("Initializing amount of GTC in the market.");
        
        // Minting X number of GoodDollars to the GoodDollar market.
        await GDD.initialMove(GoodDollarReserve.address); 
        totalSupply = (await GDD.totalSupply.call()).toString(10);
        console.log("After initialMove() - GoodDollar totalSupply:",totalSupply);

        await GDD.transferOwnership(GoodDollarReserve.address);
        await GDD.addMinter(GoodDollarReserve.address);
        await GDD.renounceMinter();
        console.log("Done moving ownership of token to reserve");
        (await RedemptionData.deployed()).transferOwnership(RedemptionFunctional.address);
        console.log("Done moving ownership of claim data to claim contract");
        (await GoodDollarReserve.deployed()).transferOwnership(RedemptionFunctional.address);
        console.log("Done moving ownership of reserve to claim contract");

        process.deployment = {
            "BancorFormula": BancorFormula.address,
            "ExpArray": ExpArray.address,
            "GoodDollar": GDD.address,
            "GoodDollarReserve": GoodDollarReserve.address,
            "RedemptionData": RedemptionData.address,
            "RedemptionFunctional": RedemptionFunctional.address
        }

       
        // await releaser(process.deployment, network);
    });
};

 