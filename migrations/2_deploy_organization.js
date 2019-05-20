const Identity = artifacts.require('./Identity');
const DaoCreatorGoodDollar = artifacts.require('./DaoCreatorGoodDollar.sol');
const ControllerCreatorGoodDollar = artifacts.require('./ControllerCreatorGoodDollar.sol');

const Avatar = artifacts.require('./Avatar.sol');
const AbsoluteVote = artifacts.require('./AbsoluteVote.sol');

const tokenName = "TestToken";
const tokenSymbol = "TST";
const cap = web3.utils.toWei("100000000","ether");

const initRep = web3.utils.toWei("10");
const initRepInWei = [initRep];
const initToken = web3.utils.toWei("1000");
const initTokenInWei = [initToken];

module.exports = async function(deployer) {
  deployer.deploy(Identity).then(async (identity) => {

    await web3.eth.getAccounts(function(err,res) { accounts = res; });
    const founders = [accounts[0]];

    await Promise.all(founders.map(f => identity.addWhitelisted(f)));

    const controllerCreator = await deployer.deploy(ControllerCreatorGoodDollar);
    const daoCreator = await deployer.deploy(DaoCreatorGoodDollar, controllerCreator.address);

    const returnedParams = await daoCreator.forgeOrg(
      tokenName, tokenSymbol, cap, identity.address,
      founders, initTokenInWei, initRepInWei);

    const avatar = await Avatar.at(returnedParams.logs[0].args._avatar);

    // Schemes
    const absoluteVote = await deployer.deploy(AbsoluteVote);


    // TODO: Deploy UBI scheme
  });
};
