const { toGD } = require("./helpers");
const settings = require("./deploy-settings.json");

const Identity = artifacts.require("./Identity");
const Controller = artifacts.require("./Controller.sol");
const GoodDollar = artifacts.require("./GoodDollar.sol");

const Avatar = artifacts.require("./Avatar.sol");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");

const UBI = artifacts.require("./FixedUBI.sol");
const SignupBonus = artifacts.require("./SignUpBonus.sol");
const OneTimePayments = artifacts.require("./OneTimePayments.sol");

const releaser = require("../scripts/releaser.js");
const fse = require("fs-extra");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function(deployer, network) {
  const networkSettings = settings[network] || settings["default"];

  const GASLIMIT = networkSettings.gasLimit;

  const file = await fse.readFile("releases/deployment.json", "utf8");
  const previousDeployment = await JSON.parse(file);
  const networkAddresses = previousDeployment[network];

  const avataraddr = await networkAddresses.Avatar;
  const voteaddr = await networkAddresses.AbsoluteVote;
  const schemeaddr = await networkAddresses.SchemeRegistrar;
  const identityaddr = await networkAddresses.Identity;
  const ubiaddr = await networkAddresses.UBI;
  const signupaddr = await networkAddresses.SignupBonus;

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

  const oneTimePayments = await deployer.deploy(
    OneTimePayments,
    avatar.address,
    identity.address,
    GASLIMIT
  );

  await oneTimePayments.transferOwnership(avataraddr);

  let transaction = await schemeRegistrar.proposeScheme(
    avatar.address,
    oneTimePayments.address,
    NULL_HASH,
    "0x00000010",
    NULL_HASH
  );

  let proposalId = transaction.logs[0].args._proposalId;

  await Promise.all(founders.map(f => absoluteVote.vote(proposalId, 1, 0, f)));

  await oneTimePayments.start();

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
    UBI: ubiaddr,
    SignupBonus: signupaddr,
    OneTimePayments: await oneTimePayments.address,
    network,
    networkId: parseInt(deployer.network_id)
  };

  console.log("Rewriting deployment file...\n", { releasedContracts });
  await releaser(releasedContracts, network);
};
