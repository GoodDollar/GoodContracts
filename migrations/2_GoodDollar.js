var GoodDollar = artifacts.require("GoodDollar");

module.exports = function(deployer) {
    deployer.deploy(GoodDollar,"GoodDollar","GDD",4,[]);
};
