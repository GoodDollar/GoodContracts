const fse = require("fs-extra");
const settings = require("./deploy-settings.json");
const daoAddresses = require("../../releases/deployment.json");
const StakingContract = artifacts.require("./SimpleDAIStaking.sol");
const FundManager = artifacts.require("./GoodFundManager.sol");
const MarketMaker = artifacts.require("./GoodMarketMaker.sol");
const Reserve = artifacts.require("./GoodReserveCDai.sol");
const Contribution = artifacts.require("./ContributionCalculation.sol");
const BridgeMock = artifacts.require("./BridgeMock.sol");
const DAIMock = artifacts.require("./DAIMock.sol");
const cDAIMock = artifacts.require("./cDAIMock.sol");

const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");

const FundManagerSetReserve = artifacts.require("FundManagerSetReserve");

const releaser = require("../../scripts/releaser.js");
const getFounders = require("../../migrations/getFounders");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function (deployer, network) {
  if (network === "tdd") return;
  if (network.indexOf("mainnet") < 0 && network !== "test" && network !== "develop") {
    return;
  }
  await deployer;

  const founders = await getFounders(AbsoluteVote.web3, network);
  const file = await fse.readFile("releases/deployment.json", "utf8");
  const previousDeployment = JSON.parse(file);
  const networkAddresses = previousDeployment[network];

  const homeNetwork = network.replace(/-?mainnet/, "");
  const networkSettings = { ...settings["default"], ...settings[homeNetwork] };
  const maindao = daoAddresses[network];
  const homedao = daoAddresses[homeNetwork];
  const homeAddresses = previousDeployment[homeNetwork];

  let foreignBridgeAddr, daiAddress, cdaiAddress;
  if (network == "test" || network == "develop") {
    const [foreignBridge, dai] = await Promise.all([
      deployer.deploy(BridgeMock, maindao.GoodDollar),
      deployer.deploy(DAIMock)
    ]);
    const cdai = await deployer.deploy(cDAIMock, dai.address);
    foreignBridgeAddr = foreignBridge.address;
    daiAddress = dai.address;
    cdaiAddress = cdai.address;
    reserveTokenAddress = cdaiAddress;
  } else {
    foreignBridgeAddr = maindao.ForeignBridge._foreignBridge;
    daiAddress = networkSettings.daiAddress;
    cdaiAddress = networkSettings.cdaiAddress;
    reserveTokenAddress = networkSettings.reserveToken.address;
  }
  const ubiBridgeRecipient = homeAddresses.UBIScheme;
  const homeAvatar = homedao.Avatar;

  console.log("deploying stand alone contracts");
  const fundManagerP = deployer.deploy(
    FundManager,
    maindao.Avatar,
    maindao.Identity,
    cdaiAddress,
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
    maindao.Avatar,
    networkSettings.expansionRatio.nom,
    networkSettings.expansionRatio.denom,
    { gas: network.indexOf("mainnet") >= 0 ? 5000000 : undefined }
  );

  const [fundManager, contribcalc, marketmaker] = await Promise.all([
    fundManagerP.then(c => {
      console.log("fundmanager:", c.address);
      return c;
    }),
    contribcalcP.then(c => {
      console.log("contribution calc:", c.address);
      return c;
    }),
    marketmakerP.then(c => {
      console.log("marketmaker:", c.address);
      return c;
    })
  ]);

  console.log("deploying staking contract and reserve");
  const stakingContractP = deployer.deploy(
    StakingContract,
    daiAddress,
    cdaiAddress,
    fundManager.address,
    networkSettings.blockInterval,
    maindao.Avatar,
    maindao.Identity
  );

  const reserveP = deployer.deploy(
    Reserve,
    daiAddress,
    cdaiAddress,
    fundManager.address,
    maindao.Avatar,
    maindao.Identity,
    marketmaker.address,
    contribcalc.address,
    networkSettings.blockInterval
  );

  const [stakingContract, reserve] = await Promise.all([
    stakingContractP.then(c => {
      console.log("staking:", c.address);
      return c;
    }),
    reserveP.then(c => {
      console.log("reserve:", c.address);
      return c;
    })
  ]);

  console.log("initializing reserve token and transfering marketmaker to reserve");
  await marketmaker.initializeToken(
    reserveTokenAddress,
    "100", //1 gd
    networkSettings.reserveToken.gdPriceWei, //"500000" 0.005 cDai = 0.0001 DAI($) (1 cDAI = 0.02$(DAI))
    "1000000" //100% rr
  );
  await marketmaker.transferOwnership(reserve.address);

  console.log("proposing reserve and fundmanager to DAO");
  const absoluteVote = await AbsoluteVote.at(maindao.AbsoluteVote);
  const schemeRegistrar = await SchemeRegistrar.at(maindao.SchemeRegistrar);

  const [p1, p2, p3] = await Promise.all([
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
      stakingContract.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    )
  ]);

  let proposalId1 = p1.logs[0].args._proposalId;
  let proposalId2 = p2.logs[0].args._proposalId;
  let proposalId3 = p3.logs[0].args._proposalId;

  console.log("voting...", { proposalId1, proposalId2, proposalId3 });
  const vote1P = await Promise.all(
    founders
      .slice(0, Math.ceil(founders.length / 2))
      .map(f => absoluteVote.vote(proposalId1, 1, 0, f, { from: f, gas: 500000 }))
  ).catch(e => {
    console.log("proposal 1 failed", e);
    throw e;
  });
  const vote2P = await Promise.all(
    founders
      .slice(0, Math.ceil(founders.length / 2))
      .map(f => absoluteVote.vote(proposalId2, 1, 0, f, { from: f, gas: 500000 }))
  ).catch(e => {
    console.log("proposal 2 failed", e);
    throw e;
  });
  const vote3P = await Promise.all(
    founders
      .slice(0, Math.ceil(founders.length / 2))
      .map(f => absoluteVote.vote(proposalId3, 1, 0, f, { from: f, gas: 500000 }))
  ).catch(e => {
    console.log("proposal 3 failed");
    throw e;
  });

  await Promise.all([vote1P, vote2P, vote3P]);
  console.log("starting...");
  await Promise.all([reserve.start(), fundManager.start(), stakingContract.start()]);

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
    ...founders
      .slice(0, Math.ceil(founders.length / 2))
      .map(f =>
        absoluteVote.vote(setReserveProposalId, 1, 0, f, { from: f, gas: 500000 })
      )
  ]);

  console.log("setting the reserve...");
  await setReserve.setReserve();

  let releasedContracts = {
    ...networkAddresses,
    FundManager: fundManager.address,
    DAIStaking: stakingContract.address,
    Reserve: reserve.address,
    MarketMaker: marketmaker.address,
    Contribution: contribcalc.address,
    DAI: daiAddress,
    cDAI: cdaiAddress,
    ForeignBridge: foreignBridgeAddr,
    network,
    networkId: parseInt(deployer.network_id)
  };

  console.log("3_mainnet: Writing deployment file...\n", { releasedContracts });
  await releaser(releasedContracts, network);
};
