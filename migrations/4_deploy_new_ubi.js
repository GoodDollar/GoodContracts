const { toGD } = require("./helpers");
const settings = require("./deploy-settings.json");
const Identity = artifacts.require("./Identity");
const Avatar = artifacts.require("./Avatar.sol");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");

const UBI = artifacts.require("./FixedUBI.sol");

const releaser = require("../scripts/releaser.js");
const fse = require("fs-extra");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function(deployer, network) {
  if (network.indexOf("mainnet") >= 0) {
    console.log("Skipping UBI for mainnet");
    return;
  }
  const networkSettings = settings[network] || settings["default"];
  const file = await fse.readFile("releases/deployment.json", "utf8");
  const previousDeployment = await JSON.parse(file);
  const networkAddresses = previousDeployment[network];

  const avataraddr = await networkAddresses.Avatar;
  const voteaddr = await networkAddresses.AbsoluteVote;
  const schemeaddr = await networkAddresses.SchemeRegistrar;
  const identityaddr = await networkAddresses.Identity;

  await web3.eth.getAccounts(function(err, res) {
    accounts = res;
  });
  const founders = [accounts[0]];

  const avatar = await Avatar.at(avataraddr);
  const identity = await Identity.at(identityaddr);
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
    ...networkAddresses,
    UBI: await ubi.address
  };

  console.log("Rewriting deployment file...\n", { releasedContracts });
  await releaser(releasedContracts, network);
};
