const { toGD } = require("./helpers");
const settings = require("./deploy-settings.json");
const Identity = artifacts.require("./Identity");
const FeeFormula = artifacts.require("./FeeFormula");
const Controller = artifacts.require("./Controller.sol");
const DaoCreatorGoodDollar = artifacts.require("./DaoCreatorGoodDollar.sol");
const ControllerCreatorGoodDollar = artifacts.require(
  "./ControllerCreatorGoodDollar.sol"
);
const GoodDollar = artifacts.require("./GoodDollar.sol");
const Reputation = artifacts.require("./Reputation.sol");

const Avatar = artifacts.require("./Avatar.sol");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");

const releaser = require("../scripts/releaser.js");

const tokenName = "GoodDollar";
const tokenSymbol = "GDD";

// initial preliminary constants
const votePrecedence = 50;
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function(deployer, network) {
  const networkSettings = settings[network] || settings["default"];
  const cap = toGD(networkSettings.cap);

  const initRep = networkSettings.reputation;
  const initRepInWei = [initRep];
  let initToken = toGD(networkSettings.foundersTokens);

  const initTokenInWei = [initToken];

  deployer.deploy(Identity).then(async identity => {
    await web3.eth.getAccounts(function(err, res) {
      accounts = res;
    });
    const founders = [accounts[0]];

    const feeFormula = await deployer.deploy(FeeFormula);
    const controllerCreator = await deployer.deploy(
      ControllerCreatorGoodDollar
    );
    const daoCreator = await deployer.deploy(
      DaoCreatorGoodDollar,
      controllerCreator.address
    );

    console.log({
      tokenName,
      tokenSymbol,
      cap,
      formula: feeFormula.address,
      identity: identity.address,
      founders,
      initTokenInWei,
      initRepInWei
    });

    await daoCreator.forgeOrg(
      tokenName,
      tokenSymbol,
      cap,
      feeFormula.address,
      identity.address,
      founders,
      initTokenInWei,
      initRepInWei
    );

    const avatar = await Avatar.at(await daoCreator.avatar());
    const controller = await Controller.at(await avatar.owner());
    const token = await GoodDollar.at(await avatar.nativeToken());
    const reputation = await Reputation.at(await avatar.nativeReputation());

    //Set avatar for schemes
    await identity.setAvatar(avatar.address);
    await feeFormula.setAvatar(avatar.address);

    //Set fee recipient, add minters and admin
    await token.setFeeRecipient(avatar.address, avatar.address);
    await token.addMinter(avatar.address);
    await token.addMinter(controller.address);
    await token.renounceMinter();
    await identity.addIdentityAdmin(avatar.address, avatar.address);

    //Transfer ownership to controller
    await token.transferOwnership(await avatar.owner());
    await reputation.transferOwnership(await avatar.owner());
    await identity.transferOwnership(await avatar.owner());
    await feeFormula.transferOwnership(await avatar.owner());

    // Schemes
    // Deploy Voting Matching
    const absoluteVote = await deployer.deploy(AbsoluteVote);
    await absoluteVote.setParameters(votePrecedence, NULL_ADDRESS);
    const voteParametersHash = await absoluteVote.getParametersHash(
      votePrecedence,
      NULL_ADDRESS
    );

    // Deploy SchemeRegistrar
    const schemeRegistrar = await deployer.deploy(SchemeRegistrar);
    await schemeRegistrar.setParameters(
      voteParametersHash,
      voteParametersHash,
      absoluteVote.address
    );
    const schemeRegisterParams = await schemeRegistrar.getParametersHash(
      voteParametersHash,
      voteParametersHash,
      absoluteVote.address
    );

    let schemesArray;
    let paramsArray;
    let permissionArray;

    // Subscribe schemes
    schemesArray = [
      schemeRegistrar.address,
      identity.address,
      feeFormula.address
    ];
    paramsArray = [schemeRegisterParams, NULL_HASH, NULL_HASH];
    permissionArray = ["0x0000001F", "0x0000001F", "0x0000001F"];

    await daoCreator.setSchemes(
      avatar.address,
      schemesArray,
      paramsArray,
      permissionArray,
      "metaData"
    );

    await Promise.all(founders.map(f => identity.addWhitelisted(f)));
    await identity.addContract(avatar.address);
    await identity.addContract(await avatar.owner());

    await token.transfer(
      avatar.address,
      toGD(networkSettings.founderTokensToAvatar)
    );

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
