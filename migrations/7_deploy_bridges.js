const { toGD } = require("./helpers");
const settings = require("./deploy-settings.json");
const Identity = artifacts.require("./Identity");
const Controller = artifacts.require("./Controller.sol");
const GoodDollar = artifacts.require("./GoodDollar.sol");

const Avatar = artifacts.require("./Avatar.sol");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");
const SetHomeBridge = artifacts.require("./SetHomeBridge.sol");
const SetForeignBridge = artifacts.require("./SetForeignBridge.sol");

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

  let factory;

  if (network == "fuse") {
    factory = await SetHomeBridge.new(avataraddr, "0xb895638fb3870AD5832402a5BcAa64A044687db0");
  }
  else {
    factory = await SetForeignBridge.new(avataraddr, "0xABBf5D8599B2Eb7b4e1D25a1Fd737FF1987655aD");
  }

  await factory.transferOwnership(avataraddr);

  let transaction = await schemeRegistrar.proposeScheme(
    avatar.address,
    factory.address,
    NULL_HASH,
    "0x00000010",
    NULL_HASH
  );

  let proposalId = transaction.logs[0].args._proposalId;

  await Promise.all(founders.map(f => absoluteVote.vote(proposalId, 1, 0, f)));

  let transaction2 = await factory.SetBridge();

  console.log(transaction2.logs);
};
