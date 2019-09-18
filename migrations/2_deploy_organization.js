const Identity = artifacts.require('./Identity');
const FeeFormula = artifacts.require('./FeeFormula');
const Controller = artifacts.require('./Controller.sol');
const DaoCreatorGoodDollar = artifacts.require('./DaoCreatorGoodDollar.sol');
const ControllerCreatorGoodDollar = artifacts.require('./ControllerCreatorGoodDollar.sol');
const GoodDollar = artifacts.require("./GoodDollar.sol");

const Avatar = artifacts.require('./Avatar.sol');
const AbsoluteVote = artifacts.require('./AbsoluteVote.sol');
const SchemeRegistrar = artifacts.require('./SchemeRegistrar.sol');

const UBI = artifacts.require("./FixedUBI.sol");
const SignupBonus = artifacts.require("./SignupBonus.sol");

const releaser = require('../scripts/releaser.js');

const tokenName = "GoodDollar";
const tokenSymbol = "GDD";
const cap = web3.utils.toWei("100000000","ether");

const initFee = web3.utils.toWei("0.0001");
const initRep = web3.utils.toWei("10");
const initRepInWei = [initRep];
let initToken = web3.utils.toWei("10000");

// initial preliminary constants
const votePrecedence = 50;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const NULL_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

module.exports = async function(deployer, network) {

  if (network != 'mainnet' &&
      network != 'test' &&
      network != 'ganache' &&
      network != 'develop') 
  {
    initToken = web3.utils.toWei("0");
  }
  const initTokenInWei = [initToken];

  deployer.deploy(Identity).then(async (identity) => {

    await web3.eth.getAccounts(function(err,res) { accounts = res; });
    const founders = [accounts[0]];

    const feeFormula = await deployer.deploy(FeeFormula);
    const controllerCreator = await deployer.deploy(ControllerCreatorGoodDollar);
    const daoCreator = await deployer.deploy(DaoCreatorGoodDollar, controllerCreator.address);

    await daoCreator.forgeOrg(
      tokenName, tokenSymbol, cap, feeFormula.address, identity.address,
      founders, initTokenInWei, initRepInWei);

    const avatar = await Avatar.at(await daoCreator.avatar());
    const controller = await Controller.at(await avatar.owner());
    const token = await GoodDollar.at(await avatar.nativeToken());

    await identity.setAvatar(avatar.address);
    await feeFormula.setAvatar(avatar.address);
    await identity.transferOwnership(await avatar.owner());
    await feeFormula.transferOwnership(await avatar.owner());
    
    if (network == 'mainnet' ||
        network == 'test' ||
        network == 'ganache' ||
        network == 'develop')
    {
      await token.transfer(avatar.address, web3.utils.toWei("5000"));
    }

    // Schemes
    // Deploy Voting Matching
    const absoluteVote = await deployer.deploy(AbsoluteVote);
    await absoluteVote.setParameters(votePrecedence, NULL_ADDRESS);
    const voteParametersHash = await absoluteVote.getParametersHash(votePrecedence, NULL_ADDRESS);

    // Deploy SchemeRegistrar
    const schemeRegistrar = await deployer.deploy(SchemeRegistrar);
    await schemeRegistrar.setParameters(voteParametersHash, voteParametersHash, absoluteVote.address);
    const schemeRegisterParams = await schemeRegistrar.getParametersHash(voteParametersHash, voteParametersHash, absoluteVote.address);

    let schemesArray;
    let paramsArray;
    let permissionArray;

      // Subscribe schemes
    schemesArray = [schemeRegistrar.address, identity.address, feeFormula.address];
    paramsArray = [schemeRegisterParams, NULL_HASH, NULL_HASH];
    permissionArray = ['0x0000001F', '0x0000001F', '0x0000001F'];

    await daoCreator.setSchemes(
      avatar.address,
      schemesArray,
      paramsArray,
      permissionArray,
      "metaData");
 
    await Promise.all(founders.map(f => identity.addClaimer(f)));

    let releasedContracts = {
      GoodDollar: await avatar.nativeToken(),
      Reputation: await avatar.nativeReputation(),
      Identity: await identity.address,
      Avatar: await avatar.address,
      Controller: await avatar.owner(),
      AbsoluteVote: await absoluteVote.address,
      SchemeRegistrar: await schemeRegistrar.address,
      UBI: NULL_ADDRESS,
      SignupBonus: NULL_ADDRESS,
      OneTimePayments: NULL_ADDRESS,
      network,
      networkId: parseInt(deployer.network_id)
    };

    console.log("Writing deployment file...\n", { releasedContracts });
    await releaser(releasedContracts, network);
  });
};
