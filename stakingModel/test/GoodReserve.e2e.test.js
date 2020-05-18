const SimpleDAIStaking = artifacts.require("SimpleDAIStaking");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");



const GoodReserve = artifacts.require("GoodReserveCDai");
const MarketMaker = artifacts.require("GoodMarketMaker");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const avatarMock = artifacts.require("AvatarMock");
const Controller = artifacts.require("Controller");
const Identity = artifacts.require("Identity");
const Formula = artifacts.require("FeeFormula");
const ContributionCalculation = artifacts.require("ContributionCalculation");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SetMarketMaker = artifacts.require("SetMarketMaker");
const SetBlockInterval = artifacts.require("SetBlockInterval");
const SetContributionAddress = artifacts.require("SetContributionAddress");

const fse = require("fs-extra");

const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
export const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const NETWORK = "test";

async function proposeAndRegister(addr, registrar, proposalId, absoluteVote, avatarAddress, fnd) {
  const transaction = await registrar.proposeScheme(avatarAddress, addr, NULL_HASH, "0x00000010", NULL_HASH);
  proposalId = transaction.logs[0].args._proposalId;
  const voteResult = await absoluteVote.vote(proposalId, 1, 0, fnd);
  return voteResult.logs.some(e => e.event === 'ExecuteProposal');
}

contract("GoodCDaiReserve - network e2e tests", ([founder, staker]) => {
  let dai, cDAI, simpleStaking, goodReserve, goodDollar, marketMaker, contribution, controller;
  let avatarAddress, registrar, absoluteVote, proposalId, setMarketMaker, setBlockInterval, setContributionAddress;

  before(async function() {
    const staking_file = await fse.readFile("releases/deployment.json", "utf8");
    const dao_file = await fse.readFile("../releases/deployment.json", "utf8");
    const staking_deployment = await JSON.parse(staking_file);
    const dao_deployment = await JSON.parse(dao_file);
    const staking_addresses = staking_deployment[NETWORK];
    const dao_addresses = dao_deployment[NETWORK];
    avatarAddress = dao_addresses.Avatar;
    dai = await DAIMock.at(staking_addresses.DAI);
    cDAI = await cDAIMock.at(staking_addresses.cDAI);
    simpleStaking = await SimpleDAIStaking.at(staking_addresses.DAIStaking);
    goodReserve = await GoodReserve.at(staking_addresses.Reserve);
    marketMaker = await MarketMaker.at(staking_addresses.MarketMaker);
    contribution = await ContributionCalculation.at(staking_addresses.Contribution);
    controller = await Controller.at(dao_addresses.Controller);
    goodDollar = await GoodDollar.at(dao_addresses.GoodDollar);
    registrar = await SchemeRegistrar.at(dao_addresses.SchemeRegistrar);
    absoluteVote = await AbsoluteVote.at(dao_addresses.AbsoluteVote);

    // schemes
    setMarketMaker = await SetMarketMaker.new(avatarAddress, goodReserve.address, marketMaker.address);
    setBlockInterval = await SetBlockInterval.new(avatarAddress, goodReserve.address, 5759);
    setContributionAddress = await SetContributionAddress.new(avatarAddress, goodReserve.address, contribution.address);
    
  });

  

//   it("should mint new dai", async () => {
    
// console.log('bbbbb');
//     dai.mint(cDAI.address, web3.utils.toWei("100000000", "ether"));
//     console.log('cccccccc');

//     await marketMaker.initializeToken(
//       cDAI.address,
//       "100", //1gd
//       "10000", //0.0001 cDai
//       "1000000" //100% rr
//     );
//     console.log('dssdsds');
//   });








  it("should not set the marketmaker", async () => {
    let error = await setMarketMaker.setMarketMaker().catch(e => e);
    expect(error.message).not.to.be.empty;
  });

  it("should not set the block interval", async () => {
    let error = await setBlockInterval.setBlockInterval().catch(e => e);
    expect(error.message).not.to.be.empty;
  });

  it("should not set the contribution", async () => {
    let error = await setContributionAddress.setContributionAddress().catch(e => e);
    expect(error.message).not.to.be.empty;
  });

  it("should be able to set the marketmaker", async () => {
    const executeProposalEventExists = await proposeAndRegister(setMarketMaker.address,
      registrar, proposalId, absoluteVote, avatarAddress, founder);
    // Verifies that the ExecuteProposal event has been emitted
    expect(executeProposalEventExists).to.be.true;
    await setMarketMaker.setMarketMaker();
    const marketMaker2 = await goodReserve.marketMaker();
    expect(marketMaker2).to.be.equal(marketMaker.address);
  });

  it("should be able to set the blockInterval", async () => {
    const executeProposalEventExists = await proposeAndRegister(setBlockInterval.address,
      registrar, proposalId, absoluteVote, avatarAddress, founder);
    // Verifies that the ExecuteProposal event has been emitted
    expect(executeProposalEventExists).to.be.true;
    await setBlockInterval.setBlockInterval();
    const blockInterval = await goodReserve.blockInterval();
    expect(blockInterval.toString()).to.be.equal('5759');
  });

  it("should be able to set the contribution address", async () => {
    const executeProposalEventExists = await proposeAndRegister(setContributionAddress.address,
      registrar, proposalId, absoluteVote, avatarAddress, founder);
    // Verifies that the ExecuteProposal event has been emitted
    expect(executeProposalEventExists).to.be.true;
    await setContributionAddress.setContributionAddress();
    const contributionAddressT = await goodReserve.contribution();
    expect(contributionAddressT).to.be.equal(contribution.address);
  });

  it("should returned fixed 0.0001 market price", async () => {
    const gdPrice = await goodReserve.currentPrice(cDAI.address);
    const cdaiWorthInGD = gdPrice.mul(new BN("100000000", 10));
    const gdFloatPrice = gdPrice.toNumber() / 10 ** 8; //cdai 8 decimals
    expect(gdFloatPrice).to.be.equal(0.0001);
    expect(cdaiWorthInGD.toString()).to.be.equal("1000000000000"); //in 8 decimals precision
    expect(cdaiWorthInGD.toNumber() / 10 ** 8).to.be.equal(10000);
  });
});
