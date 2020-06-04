const fse = require("fs-extra");
const settings = require("./deploy-settings.json");
const daoAddresses = require("../../releases/deployment.json");
const UBIScheme = artifacts.require("./UBIScheme.sol");
const UBIPool = artifacts.require("FirstClaimPool");

const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");

const releaser = require("../../scripts/releaser.js");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function(deployer, network) {
  if (network === "tdd") return;
  if (network.indexOf("mainnet") >= 0) {
    return;
  }

  await deployer;
  const accounts = await web3.eth.getAccounts();
  const founders = [accounts[0]];
  const file = await fse.readFile("releases/deployment.json", "utf8");
  const previousDeployment = JSON.parse(file);
  const networkAddresses = previousDeployment[network];
  const networkSettings = settings[network] || settings["default"];
  const homedao = daoAddresses[network];

  const ubiPool = await deployer.deploy(
    UBIPool,
    networkSettings.firstClaimAmount,
    homedao.Avatar,
    homedao.Identity
  );

  const ubi = await deployer.deploy(
    UBIScheme,
    homedao.Avatar,
    homedao.Identity,
    ubiPool.address,
    (Date.now() / 1000).toFixed(0),
    (Date.now() / 1000 + 60 * 60 * 24 * 365).toFixed(0),
    networkSettings.maxInactiveDays
  );

  console.log("proposing UBI to DAO");
  const absoluteVote = await AbsoluteVote.at(homedao.AbsoluteVote);
  const schemeRegistrar = await SchemeRegistrar.at(homedao.SchemeRegistrar);

  const [p1, p2] = await Promise.all([
    schemeRegistrar.proposeScheme(
      homedao.Avatar,
      ubi.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    ),
    schemeRegistrar.proposeScheme(
      homedao.Avatar,
      ubiPool.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    )
  ]);

  let proposalId1 = p1.logs[0].args._proposalId;
  let proposalId2 = p2.logs[0].args._proposalId;

  console.log("voting...");
  await Promise.all([
    ...founders.map(f => absoluteVote.vote(proposalId1, 1, 0, f)),
    ...founders.map(f => absoluteVote.vote(proposalId2, 1, 0, f))
  ]);

  console.log("starting...");
  await Promise.all([ubi.start(), ubiPool.start()]);

  let releasedContracts = {
    ...networkAddresses,
    UBIScheme: ubi.address,
    FirstClaimPool: ubiPool.address
  };

  console.log("2_sidechain_ubi: Writing deployment file...\n", { releasedContracts });
  await releaser(releasedContracts, network);
};
