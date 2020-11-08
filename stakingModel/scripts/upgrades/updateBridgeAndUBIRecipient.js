const fse = require("fs-extra");
const settings = require("../../migrations/deploy-settings.json");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");
const FundManagerSetUBIAndBridge = artifacts.require("./FundManagerSetUBIAndBridge.sol");

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
  if (network.includes("mainnet") === false) {
    console.log("can only run on mainnets");
    return;
  }
  const networkSettings = { ...settings["default"], ...settings[network] };
  const staking_deployment = require("../../releases/deployment.json");
  const daoAddresses = require("../../../releases/deployment.json");
  const homedao = daoAddresses[network];
  //   const staking_deployment = JSON.parse(staking_file);
  let staking_addresses = staking_deployment[network];

  let staking_addresses_home = staking_deployment[network.replace(/-?mainnet/, "")];
  const founders = await getFounders(AbsoluteVote.web3, network);
  console.log({ network, networkSettings, staking_addresses_home, homedao, founders });
  const ubiupdate = await FundManagerSetUBIAndBridge.new(
    homedao.Avatar,
    staking_addresses.FundManager,
    staking_addresses_home.UBIScheme,
    staking_addresses.ForeignBridge
  );

  console.log("Scheme deployed at:", {
    scheme: ubiupdate.address,
    newRecipient: staking_addresses_home.UBIScheme,
    newBridge: staking_addresses.ForeignBridge
  });

  console.log("proposing Update to DAO");
  const absoluteVote = await AbsoluteVote.at(homedao.AbsoluteVote);
  const schemeRegistrar = await SchemeRegistrar.at(homedao.SchemeRegistrar);

  const proposal = await schemeRegistrar.proposeScheme(
    homedao.Avatar,
    ubiupdate.address,
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

  console.log("updating contracts...");
  const res = await ubiupdate.setContracts();
  console.log("result:", { res, logs: res.logs });
};

module.exports = done => {
  upgrade()
    .catch(console.log)
    .then(done);
};
