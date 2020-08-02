const settings = require("./deploy-settings.json");

const Identity = artifacts.require("./Identity");
const Avatar = artifacts.require("./Avatar.sol");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");
const ReputationMintOnce = artifacts.require("./ReputationMintOnce.sol");
const Reputation = artifacts.require("./Reputation.sol");
const getFounders = require("./getFounders");
const releaser = require("../scripts/releaser.js");
const fse = require("fs-extra");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function (deployer, network, accounts) {
  if (process.env.MINT_REP !== "true") {
    console.log("Skipping MINT REP");
    return;
  }
  const networkSettings = { ...settings["default"], ...settings[network] };

  const file = await fse.readFile("releases/deployment.json", "utf8");
  const previousDeployment = await JSON.parse(file);
  const networkAddresses = previousDeployment[network];

  const avataraddr = await networkAddresses.Avatar;
  const voteaddr = await networkAddresses.AbsoluteVote;
  const schemeaddr = await networkAddresses.SchemeRegistrar;
  const identityaddr = await networkAddresses.Identity;

  const founders = await getFounders(AbsoluteVote.web3, network);
  console.log({ founders });
  const avatar = await Avatar.at(avataraddr);
  const identity = await Identity.at(identityaddr);
  const absoluteVote = await AbsoluteVote.at(voteaddr);
  const schemeRegistrar = await SchemeRegistrar.at(schemeaddr);

  // const mintRep = await deployer.deploy(
  //   ReputationMintOnce,
  //   avatar.address,
  //   founders,
  //   90,
  //   { gas: 2000000, gasPrice: 70000000000, nonce: 33 }
  // )
  const mintRep = await ReputationMintOnce.at(
    "0x1a1dA2aA956fa2eD9E007A96Ea35D7855AAA0ab8"
  );
  console.log("proposing mint rep scheme");
  // let transaction = await schemeRegistrar.proposeScheme(
  //   avatar.address,
  //   mintRep.address,
  //   NULL_HASH,
  //   '0x00000010',
  //   NULL_HASH
  // )

  // let proposalId = transaction.logs[0].args._proposalId
  let proposalId = "0x5b4ed55d588ebace4e4cea693b6ece3876b5942b8b319d159d03be93e1bae50b";
  console.log("voting mint rep", { proposalId });

  const v1 = await absoluteVote.vote(proposalId, 1, 0, founders[0], {
    from: founders[0],
    gas: 500000
  });
  console.log("minting..");
  await mintRep.fixIssues();
};
