const fse = require("fs-extra");
const settings = require("./deploy-settings.json");
const daoAddresses = require("../../releases/deployment.json");
const GoodCompoundStaking = artifacts.require("./GoodCompoundStaking.sol");
const GoodDMMStaking = artifacts.require("./GoodDMMStaking.sol");
const FundManager = artifacts.require("./GoodFundManager.sol");
const MarketMaker = artifacts.require("./GoodMarketMaker.sol");
const Reserve = artifacts.require("./GoodReserveCDai.sol");
const Contribution = artifacts.require("./ContributionCalculation.sol");
const BridgeMock = artifacts.require("./BridgeMock.sol");
const DAIMock = artifacts.require("./DAIMock.sol");
const cDAIMock = artifacts.require("./cDAIMock.sol");
const mDAIMock = artifacts.require("./mDAIMock.sol");

const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");

const FundManagerSetReserve = artifacts.require("FundManagerSetReserve");

const releaser = require("../../scripts/releaser.js");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function(deployer, network) {
  if (network === "tdd") return;
  if (network.indexOf("mainnet") < 0 && network !== "test" && network !== "develop") {
    return;
  }
  await deployer;
  const accounts = await web3.eth.getAccounts();
  const founders = [accounts[0]];
  const file = await fse.readFile("releases/deployment.json", "utf8");
  const previousDeployment = JSON.parse(file);
  const networkAddresses = previousDeployment[network];

  const homeNetwork = network.replace(/-?mainnet/, "");
  const networkSettings = { ...settings["default"], ...settings[network] };
  const maindao = daoAddresses[network];
  const homedao = daoAddresses[homeNetwork];

  let foreignBridgeAddr, daiAddress, cdaiAddress, mdaiAddress;
  if (network == "test" || network == "develop") {
    const [foreignBridge, dai] = await Promise.all([
      deployer.deploy(BridgeMock, maindao.GoodDollar),
      deployer.deploy(DAIMock)
    ]);
    const cdai = await deployer.deploy(cDAIMock, dai.address);
    const mdai = await deployer.deploy(mDAIMock, dai.address);
    foreignBridgeAddr = foreignBridge.address;
    daiAddress = dai.address;
    cdaiAddress = cdai.address;
    mdaiAddress = mdai.address;
  } else {
    foreignBridgeAddr = maindao.ForeignBridge._foreignBridge;
    daiAddress = networkSettings.daiAddress;
    cdaiAddress = networkSettings.cdaiAddress;
    mdaiAddress = networkSettings.mdaiAddress; // need to add correct address in deployment script
  }
  const ubiBridgeRecipient = networkAddresses.UBIScheme;
  const homeAvatar = homedao.Avatar;

  console.log("deploying stand alone contracts");
  const fundManagerP = deployer.deploy(
    FundManager,
    cdaiAddress,
    maindao.Avatar,
    maindao.Identity,
    foreignBridgeAddr,
    ubiBridgeRecipient,
    networkSettings.blockInterval
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
    maindao.Avatar,
    { gas: network.indexOf("mainnet") >= 0 ? 4000000 : undefined }
  );

  const [fundManager, contribcalc, marketmaker] = await Promise.all([
    fundManagerP,
    contribcalcP,
    marketmakerP
  ]);

  console.log("deploying staking contract and reserve");
  const goodCompoundStakingP = deployer.deploy(
    GoodCompoundStaking,
    daiAddress,
    cdaiAddress,
    fundManager.address,
    networkSettings.blockInterval,
    maindao.Avatar,
    maindao.Identity
  );

  const goodDMMStakingP = deployer.deploy(
    GoodDMMStaking,
    daiAddress,
    mdaiAddress,
    fundManager.address,
    networkSettings.blockInterval,
    maindao.Avatar,
    maindao.Identity
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
    contribcalc.address,
    networkSettings.blockInterval
  );
  const [goodCompoundStaking, goodDMMStaking, reserve] = await Promise.all([goodCompoundStakingP, goodDMMStakingP, reserveP]);
  await marketmaker.initializeToken(
    cdaiAddress,
    "100", //1gd
    "10000", //0.0001 cDai
    "1000000" //100% rr
  );

  await marketmaker.initializeToken(
    mdaiAddress,
    "100", //1gd
    "10000", //0.0001 cDai
    "1000000" //100% rr
  );

  await marketmaker.transferOwnership(reserve.address);

  console.log("proposing reserve and fundmanager to DAO");
  const absoluteVote = await AbsoluteVote.at(maindao.AbsoluteVote);
  const schemeRegistrar = await SchemeRegistrar.at(maindao.SchemeRegistrar);

  const [p1, p2, p3, p4] = await Promise.all([
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
    ),
    schemeRegistrar.proposeScheme(
      maindao.Avatar,
      goodCompoundStaking.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    ),
    schemeRegistrar.proposeScheme(
      maindao.Avatar,
      goodDMMStaking.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    )
  ]);

  let proposalId1 = p1.logs[0].args._proposalId;
  let proposalId2 = p2.logs[0].args._proposalId;
  let proposalId3 = p3.logs[0].args._proposalId;
  let proposalId4 = p4.logs[0].args._proposalId;

  console.log("voting...");
  await Promise.all([
    ...founders.map(f => absoluteVote.vote(proposalId1, 1, 0, f)),
    ...founders.map(f => absoluteVote.vote(proposalId2, 1, 0, f)),
    ...founders.map(f => absoluteVote.vote(proposalId3, 1, 0, f)),
    ...founders.map(f => absoluteVote.vote(proposalId4, 1, 0, f))
  ]);

  console.log("starting...");
  await Promise.all([reserve.start(), fundManager.start(), goodCompoundStaking.start(), goodDMMStaking.start()]);

  console.log("deploying fund manager setReserve scheme...");
  const setReserve = await deployer.deploy(
    FundManagerSetReserve,
    maindao.Avatar,
    fundManager.address,
    reserve.address
  );

  console.log("proposing setReserve...");
  let setReserveProposal = await schemeRegistrar.proposeScheme(
    maindao.Avatar,
    setReserve.address,
    NULL_HASH,
    "0x00000010",
    NULL_HASH
  );

  let setReserveProposalId = setReserveProposal.logs[0].args._proposalId;

  console.log("voting...");
  await Promise.all([
    ...founders.map(f => absoluteVote.vote(setReserveProposalId, 1, 0, f))
  ]);

  console.log("setting the reserve...");
  await setReserve.setReserve();

  let releasedContracts = {
    ...networkAddresses,
    FundManager: fundManager.address,
    DAICompoundStaking: goodCompoundStaking.address,
    DAIDMMStaking: goodDMMStaking.address,
    Reserve: reserve.address,
    MarketMaker: marketmaker.address,
    Contribution: contribcalc.address,
    DAI: daiAddress,
    cDAI: cdaiAddress,
    mDAI: mdaiAddress,
    ForeignBridge: foreignBridgeAddr,
    network,
    networkId: parseInt(deployer.network_id)
  };

  console.log("3_mainnet: Writing deployment file...\n", { releasedContracts });
  await releaser(releasedContracts, network);
};
