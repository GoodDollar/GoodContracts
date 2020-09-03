const fse = require("fs-extra");
const settings = require("../../migrations/deploy-settings.json");
const UBIScheme = artifacts.require("./UBIScheme.sol");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");
const releaser = require("../../../scripts/releaser.js");
const getFounders = require("../../../migrations/getFounders");
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

const getNetworkName = () => {
  const argslist = process.argv;
  let found = false;
  for (let i in argslist) {
    const item = argslist[i];
    if (found) return item;
    if (item && item.indexOf("network") >= 0) found = true;
  }
  return;
};

/**
 * truffle helper script to upgrade the ubischeme
 */
const upgrade = async function() {
  const network = getNetworkName();
  const networkSettings = { ...settings["default"], ...settings[network] };
  const staking_deployment = require("../../releases/deployment.json");
  const daoAddresses = require("../../../releases/deployment.json");
  const homedao = daoAddresses[network];
  //   const staking_deployment = JSON.parse(staking_file);

  let staking_addresses = staking_deployment[network];
  const founders = await getFounders(AbsoluteVote.web3, network);
  console.log({ network, networkSettings, staking_addresses, homedao, founders });
  const ubiScheme = await UBIScheme.new(
    homedao.Avatar,
    homedao.Identity,
    staking_addresses.FirstClaimPool,
    (Date.now() / 1000).toFixed(0),
    (Date.now() / 1000 + 60 * 60 * 24).toFixed(0),
    networkSettings.maxInactiveDays,
    networkSettings.ubiCycle
  );

  console.log("Scheme deployed at:", ubiScheme.address);

  console.log("proposing UBI to DAO");
  const absoluteVote = await AbsoluteVote.at(homedao.AbsoluteVote);
  const schemeRegistrar = await SchemeRegistrar.at(homedao.SchemeRegistrar);

  const proposal = await schemeRegistrar.proposeScheme(
    homedao.Avatar,
    ubiScheme.address,
    NULL_HASH,
    "0x00000010",
    NULL_HASH
  );

  let proposalId = proposal.logs[0].args._proposalId;

  console.log("voting...", { proposalId });

  await Promise.all(
    founders
      .slice(0, Math.ceil(founders.length / 2))
      .map(f => absoluteVote.vote(proposalId, 1, 0, f, { from: f, gas: 500000 }))
  );

  console.log("starting...");
  await ubiScheme.start();

  let releasedContracts = {
    ...staking_addresses,
    UBIScheme: ubiScheme.address
  };

  console.log("Writing deployment file...\n", { releasedContracts });
  await releaser(releasedContracts, network);
};

module.exports = done => {
  upgrade()
    .catch(console.log)
    .then(done);
};
