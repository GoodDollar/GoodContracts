const settings = require("./deploy-settings.json");

const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");
const SetHomeBridge = artifacts.require("./DeployHomeBridge.sol");
const SetForeignBridge = artifacts.require("./DeployForeignBridge.sol");
const GoodDollar = artifacts.require("./GoodDollar.sol");
const Reputation = artifacts.require("./Reputation.sol");
const Avatar = artifacts.require("./Avatar.sol");

const getFounders = require("./getFounders");
const releaser = require("../scripts/releaser.js");
const fse = require("fs-extra");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function (deployer, network) {
  const file = await fse.readFile("releases/deployment.json", "utf8");
  const previousDeployment = await JSON.parse(file);
  const networkAddresses = previousDeployment[network];

  const avataraddr = networkAddresses.Avatar;
  const voteaddr = networkAddresses.AbsoluteVote;
  const schemeaddr = networkAddresses.SchemeRegistrar;
  const gd = await GoodDollar.at(networkAddresses.GoodDollar);

  const founders = await getFounders(AbsoluteVote.web3, network);
  const avatar = await Avatar.at(avataraddr);

  const rep = await Reputation.at(await avatar.nativeReputation());
  console.log({
    totalRep: await rep
      .totalSupplyAt(await web3.eth.getBlockNumber())
      .then(_ => _.toString())
  });
  console.log({ founderRep: await rep.balanceOf(founders[0]).then(_ => _.toString()) });

  const absoluteVote = await AbsoluteVote.at(voteaddr);
  const schemeRegistrar = await SchemeRegistrar.at(schemeaddr);

  let factory, homeBridgeaddr, foreignBridgeaddr;

  //deploy home bridge always on fuse
  if (["fuse", "staging", "production"].includes(network)) {
    console.log("Deploying home bridge scheme");
    factory = await deployer.deploy(
      SetHomeBridge,
      avataraddr,
      "0xb895638fb3870AD5832402a5BcAa64A044687db0"
    );

    await factory.transferOwnership(avataraddr);

    console.log("proposing home bridge scheme", factory.address);
    let transaction = await schemeRegistrar.proposeScheme(
      avataraddr,
      factory.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    );

    let proposalId = transaction.logs[0].args._proposalId;
    console.log("voting home bridge scheme", { proposalId });
    await Promise.all(
      founders.slice(0, Math.ceil(founders.length / 2)).map(f =>
        absoluteVote
          .vote(proposalId, 1, 0, f, { from: f, gas: 500000 })
          .then(r => {
            console.log(f, "vote result:", r.logs);
          })
          .catch(e => {
            console.log(f, "vote failed", e);
          })
      )
    );

    const isAlreadyMinter = await gd.isMinter(
      "0xb895638fb3870AD5832402a5BcAa64A044687db0"
    );

    console.log("creating home bridge", { isAlreadyMinter });
    let transaction2 = await factory.setBridge(isAlreadyMinter === false);

    const {
      _homeBridge,
      _homeValidators,
      _token,
      _blockNumber
    } = transaction2.logs[0].args;
    homeBridgeaddr = {
      _homeBridge,
      _homeValidators,
      _token,
      _blockNumber: _blockNumber.toNumber()
    };
    //foreign bridge for dev/staging on ropsten and production on ethereum
  } else if (network.indexOf("mainnet") >= 0) {
    console.log("Deploying foreign bridge scheme");

    deployBridge = await deployer.deploy(
      SetForeignBridge,
      avataraddr,
      network.indexOf("production") >= 0
        ? "0xaC116929b2baB59D05a1Da99303e7CAEd100ECC9"
        : "0xABBf5D8599B2Eb7b4e1D25a1Fd737FF1987655aD"
    );

    console.log("proposing foreign bridge scheme");

    let transaction = await schemeRegistrar.proposeScheme(
      avataraddr,
      deployBridge.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    );

    let proposalId = transaction.logs[0].args._proposalId;
    console.log("voting foreign bridge scheme", { proposalId });

    await Promise.all(
      founders
        .slice(0, Math.ceil(founders.length / 2))
        .map(f => absoluteVote.vote(proposalId, 1, 0, f, { from: f, gas: 500000 }))
    );

    console.log("creating foreign bridge");
    let transaction2 = await deployBridge.setBridge();

    const {
      _foreignBridge,
      _foreignValidators,
      _foreignToken,
      _blockNumber
    } = transaction2.logs[0].args;
    foreignBridgeaddr = {
      _foreignBridge,
      _foreignValidators,
      _foreignToken,
      _blockNumber: _blockNumber.toNumber()
    };
  }

  let releasedContracts = {
    ...networkAddresses
  };
  homeBridgeaddr && (releasedContracts.HomeBridge = homeBridgeaddr);
  foreignBridgeaddr && (releasedContracts.ForeignBridge = foreignBridgeaddr);

  console.log("Rewriting deployment file...\n", { releasedContracts });
  await releaser(releasedContracts, network);
};
