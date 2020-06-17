const { toGD } = require("./helpers");
const settings = require("./deploy-settings.json");
const Identity = artifacts.require("./Identity");
const FeeFormula = artifacts.require("./FeeFormula");
const Controller = artifacts.require("./Controller.sol");
const DaoCreatorGoodDollar = artifacts.require("./DaoCreatorGoodDollar.sol");
const ControllerCreatorGoodDollar = artifacts.require(
  "./ControllerCreatorGoodDollar.sol"
);
const AddFoundersGoodDollar = artifacts.require("./AddFoundersGoodDollar");
const GoodDollar = artifacts.require("./GoodDollar.sol");
const Reputation = artifacts.require("./Reputation.sol");

const Avatar = artifacts.require("./Avatar.sol");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");
const UpgradeScheme = artifacts.require("./UpgradeScheme.sol");

const AdminWallet = artifacts.require("./AdminWallet.sol");

const releaser = require("../scripts/releaser.js");

const tokenName = "GoodDollar";
const tokenSymbol = "G$";

// initial preliminary constants
const votePrecedence = 50;
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

// AdminWallet Settings

module.exports = async function(deployer, network) {
  const isMainNet = network.indexOf("mainnet") >= 0;
  const networkSettings = { ...settings["default"], ...settings[network] };
  const walletToppingAmount = web3.utils.toWei(
    networkSettings.walletToppingAmount,
    networkSettings.walletToppingUnits
  );
  const walletToppingTimes = networkSettings.walletToppingTimes;
  const cap = toGD(networkSettings.cap);

  const initRep = networkSettings.reputation;
  const initRepInWei = [initRep];
  let initToken = toGD(networkSettings.avatarTokens);

  const initTokenInWei = initToken;

  deployer.deploy(Identity).then(async identity => {
    await identity.setAuthenticationPeriod(networkSettings.identityAuthenticationPeriod);
    const accounts = await web3.eth.getAccounts();
    const founders = [accounts[0]];
    const feeFormula = await deployer.deploy(FeeFormula, networkSettings.txFeePercentage);
    const controllerCreator = await deployer.deploy(ControllerCreatorGoodDollar, {
      gas: isMainNet ? 4000000 : undefined
    });
    const addFoundersGoodDollar = await deployer.deploy(
      AddFoundersGoodDollar,
      controllerCreator.address
    );

    const daoCreator = await deployer.deploy(
      DaoCreatorGoodDollar,
      addFoundersGoodDollar.address,
      { gas: isMainNet ? 8000000 : undefined }
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

    console.log("forgeorg");
    await daoCreator.forgeOrg(
      tokenName,
      tokenSymbol,
      cap,
      feeFormula.address,
      identity.address,
      founders,
      initTokenInWei,
      initRepInWei,
      { gas: isMainNet ? 8000000 : undefined }
    );

    const avatar = await Avatar.at(await daoCreator.avatar());
    const controller = await Controller.at(await avatar.owner());
    const token = await GoodDollar.at(await avatar.nativeToken());

    let adminWalletP = Promise.resolve({});
    if (isMainNet) {
      console.log("Skipping AdminWallet for mainnet");
    } else {
      console.log("adminwallet");
      adminWalletP = deployer.deploy(
        AdminWallet,
        founders,
        walletToppingAmount,
        walletToppingTimes,
        identity.address
      );
    }
    // Deploy admin wallet

    //Set avatar for schemes
    const [adminWallet, ,] = await Promise.all([
      adminWalletP,
      identity.setAvatar(avatar.address),
      feeFormula.setAvatar(avatar.address)
    ]);

    //for testing we give founders some tokens
    if (["test", "develop", "coverage", "soliditycoverage"].includes(network)) {
      await Promise.all(founders.map(f => token.mint(f, initTokenInWei)));
    }

    console.log("setting identity");
    await Promise.all([
      identity.addIdentityAdmin(avatar.address),
      identity.addPauser(avatar.address),
      adminWallet.address && identity.addIdentityAdmin(adminWallet.address)
    ]);
    console.log("transfering ownerships");

    await Promise.all([
      identity.transferOwnership(await avatar.address /* owner */),
      feeFormula.transferOwnership(await avatar.address /* .owner() */)
    ]);

    if (network.indexOf("production") >= 0) {
      await token.renounceMinter(); // TODO: renounce all founders
    }
    //Transfer ownership to controller
    //await token.transferOwnership(await avatar.owner());
    //await reputation.transferOwnership(await avatar.owner());

    console.log("setting up dao voting machine and schemes");

    // Schemes
    // Deploy Voting Matching
    const absoluteVote = await deployer.deploy(AbsoluteVote);
    await absoluteVote.setParameters(votePrecedence, NULL_ADDRESS);
    const voteParametersHash = await absoluteVote.getParametersHash(
      votePrecedence,
      NULL_ADDRESS
    );

    const upgradeScheme = await deployer.deploy(UpgradeScheme);
    await upgradeScheme.setParameters(voteParametersHash, absoluteVote.address);
    const upgradeParametersHash = await upgradeScheme.getParametersHash(
      voteParametersHash,
      absoluteVote.address
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
      upgradeScheme.address,
      identity.address,
      feeFormula.address
    ];
    paramsArray = [schemeRegisterParams, upgradeParametersHash, NULL_HASH, NULL_HASH];
    permissionArray = ["0x0000001F", "0x0000001F", "0x0000001F", "0x0000001F"];

    await daoCreator.setSchemes(
      avatar.address,
      schemesArray,
      paramsArray,
      permissionArray,
      "metaData"
    );

    console.log("whitelisting contracts and founders...");
    await Promise.all([
      ...founders.map(f => identity.addWhitelisted(f)),
      identity.addContract(avatar.address),
      identity.addContract(await avatar.owner()),
      adminWallet.address && identity.addContract(adminWallet.address),
      identity.addContract(identity.address)
    ]);

    let releasedContracts = {
      GoodDollar: await avatar.nativeToken(),
      Reputation: await avatar.nativeReputation(),
      Identity: await identity.address,
      Avatar: await avatar.address,
      Controller: await avatar.owner(),
      AbsoluteVote: await absoluteVote.address,
      SchemeRegistrar: await schemeRegistrar.address,
      UpgradeScheme: await upgradeScheme.address,
      AdminWallet: await adminWallet.address,
      UBI: NULL_ADDRESS,
      SignupBonus: NULL_ADDRESS,
      OneTimePayments: NULL_ADDRESS,
      HomeBridge: NULL_ADDRESS,
      ForeignBridge: NULL_ADDRESS,
      network,
      networkId: parseInt(deployer.network_id)
    };

    console.log("Writing deployment file...\n", { releasedContracts });
    await releaser(releasedContracts, network);
  });
};
