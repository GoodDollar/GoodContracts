const settings = require("./deploy-settings.json");
const daoAddresses = require("../../releases/deployment.json");
const UBIScheme = artifacts.require("./UBIScheme.sol");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");

const releaser = require("../../scripts/releaser.js");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function(deployer, network) {
  if (network === "tdd") return;
  if (network.indexOf("mainnet") >= 0 && network !== "test") {
    return;
  }
  await deployer;
  const accounts = await web3.eth.getAccounts();
  const founders = [accounts[0]];
  const previousDeployment = require("../releases/deployment.json");
  const networkAddresses = previousDeployment[network];
  const networkSettings = settings[network] || settings["default"];
  const homedao = daoAddresses[network];

  console.log({ homedao });
  const ubi = await deployer.deploy(
    UBIScheme,
    homedao.Avatar,
    homedao.Identity,
    (Date.now() / 1000).toFixed(0),
    (Date.now() / 1000 + 60 * 60 * 24 * 365).toFixed(0),
    networkSettings.maxInactiveDays
  );

  console.log("proposing UBI to DAO");
  const absoluteVote = await AbsoluteVote.at(homedao.AbsoluteVote);
  const schemeRegistrar = await SchemeRegistrar.at(homedao.SchemeRegistrar);

  await ubi.transferOwnership(homedao.Avatar);

  let transaction = await schemeRegistrar.proposeScheme(
    homedao.Avatar,
    ubi.address,
    NULL_HASH,
    "0x00000010",
    NULL_HASH
  );

  let proposalId = transaction.logs[0].args._proposalId;

  console.log("voting...", { proposalId });
  const votingResults = await Promise.all(
    founders.map(f => absoluteVote.vote(proposalId, 1, 0, f))
  );

  console.log("starting...", { votingResults: votingResults[0].logs });

  await ubi.start();

  let releasedContracts = {
    ...networkAddresses,
    UBIScheme: ubi.address
  };

  console.log("Writing deployment file...\n", { releasedContracts });
  await releaser(releasedContracts, network);
};
