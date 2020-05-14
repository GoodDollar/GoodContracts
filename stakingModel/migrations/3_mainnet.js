const settings = require("./deploy-settings.json");
const daoAddresses = require("../../releases/deployment.json");
const StakingContract = artifacts.require("./SimpleDAIStaking.sol");
const FundManager = artifacts.require("./GoodFundManager.sol");
const MarketMaker = artifacts.require("./GoodMarketMaker.sol");
const Reserve = artifacts.require("./GoodReserveCDai.sol");
const Contribution = artifacts.require("./ContributionCalculation.sol");
const BridgeMock = artifacts.require("./BridgeMock.sol");

const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");

const releaser = require("../../scripts/releaser.js");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function(deployer, network) {
  if (network.indexOf("mainnet") < 0 && network !== "test") {
    return;
  }
  await deployer;
  const accounts = await web3.eth.getAccounts();
  const founders = [accounts[0]];
  const previousDeployment = require("../releases/deployment.json");
  const networkAddresses = previousDeployment[network];

  const homeNetwork = network.replace(/-?mainnet/, "");
  const networkSettings = settings[network] || settings["default"];
  const maindao = daoAddresses[network];
  const homedao = daoAddresses[homeNetwork];

  //TODO: mock for test network
  const daiAddress = networkSettings.daiAddress;
  const cdaiAddress = networkSettings.cdaiAddress;

  //TODO: update to bridge with bridge+homeavatar once PR is merged
  let foreignBridgeAddr;
  if (network == "test") {
    const foreignBridge = await deployer.deploy(BridgeMock);
    foreignBridgeAddr = foreignBridge.address;
  } else {
    foreignBridgeAddr = maindao.ForeignBridge._foreignBridge;
  }
  const ubiBridgeRecipient = homedao.UBIScheme;
  const homeAvatar = homedao.Avatar;

  console.log("deploying stand alone contracts");
  const fundManagerP = deployer.deploy(
    FundManager,
    cdaiAddress,
    maindao.Avatar,
    maindao.Identity
  );

  //daily expansion = rdiv(999388834642296, 1e15); //20% yearly
  //second day RR 99.9388834642296 = 999388
  //3rd day RR 99.9388 * 0.999388834642296 = 998777
  const contribcalcP = deployer.deploy(
    Contribution,
    maindao.Avatar,
    networkSettings.contributionRatio.nom,
    networkSettings.contributionRatio.denom
  );
  const marketmakerP = deployer.deploy(
    MarketMaker,
    maindao.GoodDollar,
    networkSettings.expansionRatio.nom,
    networkSettings.expansionRatio.denom,
    maindao.Avatar
  );

  const [fundManager, contribcalc, marketmaker] = await Promise.all([
    fundManagerP,
    contribcalcP,
    marketmakerP
  ]);

  console.log("deploying staking contract and reserve");
  const stakingContractP = deployer.deploy(
    StakingContract,
    daiAddress,
    cdaiAddress,
    fundManager.address,
    networkSettings.blockInterval
  );

  const reserveP = deployer.deploy(
    Reserve,
    daiAddress,
    cdaiAddress,
    maindao.GoodDollar,
    fundManager.address,
    maindao.Avatar,
    maindao.Identity,
    marketmaker.address,
    contribcalc.address
  );
  const [stakingContract, reserve] = await Promise.all([
    stakingContractP,
    reserveP
  ]);
  await marketmaker.transferOwnership(reserve.address);

  console.log("proposing reserve and fundmanager to DAO");
  const absoluteVote = await AbsoluteVote.at(maindao.AbsoluteVote);
  const schemeRegistrar = await SchemeRegistrar.at(maindao.SchemeRegistrar);

  const [p1, p2] = await Promise.all([
    schemeRegistrar.proposeScheme(
      maindao.Avatar,
      reserve.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    ),
    schemeRegistrar.proposeScheme(
      maindao.Avatar,
      fundManager.address,
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
  await Promise.all([reserve.start(), fundManager.start()]);

  //TODO: verify isRegistered is used when needed
  let releasedContracts = {
    ...networkAddresses,
    FundManager: fundManager.address,
    DAIStaking: stakingContract.address,
    Reserve: reserve.address,
    MarketMaker: marketmaker.address,
    Contribution: contribcalc.address,
    network,
    networkId: parseInt(deployer.network_id)
  };

  console.log("Writing deployment file...\n", { releasedContracts });
  await releaser(releasedContracts, network);
};
