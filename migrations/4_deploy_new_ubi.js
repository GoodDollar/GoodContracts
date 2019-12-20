const { toGD } = require("./helpers");
const settings = require("./deploy-settings.json");
const Identity = artifacts.require("./Identity");
const Controller = artifacts.require("./Controller.sol");
const GoodDollar = artifacts.require("./GoodDollar.sol");

const Avatar = artifacts.require("./Avatar.sol");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");

const UBI = artifacts.require("./FixedUBI.sol");

const releaser = require("../scripts/releaser.js");
const fse = require("fs-extra");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function(deployer, network) {
  const networkSettings = settings[network] || settings["default"];
  const file = await fse.readFile("releases/deployment.json", "utf8");
  const previousDeployment = await JSON.parse(file);
  const networkAddresses = previousDeployment[network];

  const avataraddr = await networkAddresses.Avatar;
  const voteaddr = await networkAddresses.AbsoluteVote;
  const schemeaddr = await networkAddresses.SchemeRegistrar;
  const identityaddr = await networkAddresses.Identity;
  const signupaddr = await networkAddresses.SignupBonus;
  const otpaddr = await networkAddresses.OneTimePayments;
  const homeBridgeaddr = await networkAddresses.HomeBridge;
  const foreignBridgeaddr = await networkAddresses.ForeignBridge;

  await web3.eth.getAccounts(function(err, res) {
    accounts = res;
  });
  const founders = [accounts[0]];

  const avatar = await Avatar.at(avataraddr);
  const identity = await Identity.at(identityaddr);
  const controller = await avatar.owner();
  const token = await GoodDollar.at(await avatar.nativeToken());
  const absoluteVote = await AbsoluteVote.at(voteaddr);
  const schemeRegistrar = await SchemeRegistrar.at(schemeaddr);

  const now = new Date();
  const startUBI = (now.getTime() / 1000 - 1).toFixed(0);
  now.setFullYear(now.getFullYear() + 1);
  const endUBI = (now.getTime() / 1000).toFixed(0);
  console.log({
    total: toGD(networkSettings.totalUBI),
    startUBI,
    endUBI,
    daily: toGD(networkSettings.dailyUBI)
  });
  const ubi = await deployer.deploy(
    UBI,
    avatar.address,
    identity.address,
    toGD(networkSettings.totalUBI),
    startUBI,
    endUBI,
    toGD(networkSettings.dailyUBI)
  );

  await ubi.transferOwnership(avataraddr);

  let transaction = await schemeRegistrar.proposeScheme(
    avatar.address,
    ubi.address,
    NULL_HASH,
    "0x00000010",
    NULL_HASH
  );

  let proposalId = transaction.logs[0].args._proposalId;

  await Promise.all(founders.map(f => absoluteVote.vote(proposalId, 1, 0, f)));

  await ubi.start();

  let releasedContracts = {
    GoodDollar: await avatar.nativeToken(),
    Reputation: await avatar.nativeReputation(),
    Identity: await identity.address,
    Avatar: await avatar.address,
    Controller: await avatar.owner(),
    AbsoluteVote: await absoluteVote.address,
    SchemeRegistrar: await schemeRegistrar.address,
    UpgradeScheme: await networkAddresses.UpgradeScheme,
    AdminWallet: await networkAddresses.AdminWallet,
    UBI: await ubi.address,
    SignupBonus: signupaddr,
    OneTimePayments: otpaddr,
    HomeBridge: homeBridgeaddr,
    ForeignBridge: foreignBridgeaddr,
    network,
    networkId: parseInt(deployer.network_id)
  };

  console.log("Rewriting deployment file...\n", { releasedContracts });
  await releaser(releasedContracts, network);
};
