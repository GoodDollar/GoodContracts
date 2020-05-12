const settings = require("./deploy-settings.json");

const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");
const SetHomeBridge = artifacts.require("./DeployHomeBridge.sol");
const SetForeignBridge = artifacts.require("./DeployForeignBridge.sol");
const GoodDollar = artifacts.require("./GoodDollar.sol");

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

  const avataraddr = networkAddresses.Avatar;
  const voteaddr = networkAddresses.AbsoluteVote;
  const schemeaddr = networkAddresses.SchemeRegistrar;
  const gd = await GoodDollar.at(networkAddresses.GoodDollar);

  await web3.eth.getAccounts(function(err, res) {
    accounts = res;
  });
  const founders = [accounts[0]];

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

    console.log("voting home bridge scheme");
    let transaction = await schemeRegistrar.proposeScheme(
      avataraddr,
      factory.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    );

    let proposalId = transaction.logs[0].args._proposalId;

    await Promise.all(
      founders.map(f => absoluteVote.vote(proposalId, 1, 0, f))
    );

    const isAlreadyMinter = await gd.isMinter(
      "0xb895638fb3870AD5832402a5BcAa64A044687db0"
    );

    console.log("creating home bridge");
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

    factory = await deployer.deploy(
      SetForeignBridge,
      avataraddr,
      network === "mainnet"
        ? "0xaC116929b2baB59D05a1Da99303e7CAEd100ECC9"
        : "0xABBf5D8599B2Eb7b4e1D25a1Fd737FF1987655aD"
    );

    await factory.transferOwnership(avataraddr);

    console.log("voting foreign bridge scheme");

    let transaction = await schemeRegistrar.proposeScheme(
      avataraddr,
      factory.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    );

    let proposalId = transaction.logs[0].args._proposalId;

    await Promise.all(
      founders.map(f => absoluteVote.vote(proposalId, 1, 0, f))
    );

    console.log("creating foreign bridge");
    let transaction2 = await factory.setBridge();

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
