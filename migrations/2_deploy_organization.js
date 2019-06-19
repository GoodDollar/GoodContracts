const Identity = artifacts.require('./Identity');
const DaoCreatorGoodDollar = artifacts.require('./DaoCreatorGoodDollar.sol');
const ControllerCreatorGoodDollar = artifacts.require('./ControllerCreatorGoodDollar.sol');

const Avatar = artifacts.require('./Avatar.sol');
const AbsoluteVote = artifacts.require('./AbsoluteVote.sol');

const SchemeRegistrar = artifacts.require('./SchemeRegistrar.sol');

const tokenName = "TestCoin";
const tokenSymbol = "TDD";
const cap = web3.utils.toWei("100000000","ether");

const initFee = web3.utils.toWei("0.0001");
const initRep = web3.utils.toWei("10");
const initRepInWei = [initRep];
const initToken = web3.utils.toWei("1000");
const initTokenInWei = [initToken];

// initial preliminary constants
const votePrecedence = 50;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

module.exports = async function(deployer) {
  deployer.deploy(Identity).then(async (identity) => {

    await web3.eth.getAccounts(function(err,res) { accounts = res; });
    const founders = [accounts[0]];

    await Promise.all(founders.map(f => identity.addClaimer(f)));

    const controllerCreator = await deployer.deploy(ControllerCreatorGoodDollar);
    const daoCreator = await deployer.deploy(DaoCreatorGoodDollar, controllerCreator.address);

    await daoCreator.forgeOrg(
      tokenName, tokenSymbol, cap, initFee, identity.address,
      founders, initTokenInWei, initRepInWei);

    const avatar = await Avatar.at(await daoCreator.avatar());

    console.log(`AVATAR: ${avatar.address}`);
    console.log(`CONTROLLER: ${await avatar.owner()}`);
    console.log(`NATIVE TOKEN: ${await avatar.nativeToken()}`);

    // Schemes
    // Deploy Voting Maching
    const absoluteVote = await deployer.deploy(AbsoluteVote);
    await absoluteVote.setParameters(votePrecedence, NULL_ADDRESS);
    const voteParametersHash = await absoluteVote.getParametersHash(votePrecedence, NULL_ADDRESS);

    // Deploy SchemeRegistrar
    const schemeRegistrar = await deployer.deploy(SchemeRegistrar);
    await schemeRegistrar.setParameters(voteParametersHash, voteParametersHash, absoluteVote.address);
    const schemeRegisterParams = await schemeRegistrar.getParametersHash(voteParametersHash, voteParametersHash, absoluteVote.address);

    // Subscribe schemes
    const schemesArray = [schemeRegistrar.address];
    const paramsArray = [schemeRegisterParams];
    const permissionArray = ['0x0000001F'];

    await daoCreator.setSchemes(
      avatar.address,
      schemesArray,
      paramsArray,
      permissionArray,
      "metaData"); 
  });
};
