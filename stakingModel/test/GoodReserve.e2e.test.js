const GoodCompoundStaking = artifacts.require("GoodCompoundStaking");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");
const GoodReserve = artifacts.require("GoodReserveCDai");
const MarketMaker = artifacts.require("GoodMarketMaker");
const GoodDollar = artifacts.require("GoodDollar");
const ContributionCalculation = artifacts.require("ContributionCalculation");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SetMarketMaker = artifacts.require("SetMarketMaker");
const SetBlockInterval = artifacts.require("SetBlockInterval");
const SetContributionAddress = artifacts.require("SetContributionAddress");
const AddMinter = artifacts.require("AddMinter");

const fse = require("fs-extra");

const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
export const NULL_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const NETWORK = "test";

async function proposeAndRegister(
  addr,
  registrar,
  proposalId,
  absoluteVote,
  avatarAddress,
  fnd
) {
  const transaction = await registrar.proposeScheme(
    avatarAddress,
    addr,
    NULL_HASH,
    "0x00000010",
    NULL_HASH
  );
  proposalId = transaction.logs[0].args._proposalId;
  const voteResult = await absoluteVote.vote(proposalId, 1, 0, fnd);
  return voteResult.logs.some(e => e.event === "ExecuteProposal");
}

contract("GoodCDaiReserve - network e2e tests", ([founder, staker]) => {
  let dai, cDAI, goodReserve, goodDollar, marketMaker, contribution;
  let avatarAddress,
    registrar,
    absoluteVote,
    proposalId,
    setMarketMaker,
    setBlockInterval,
    setContributionAddress,
    addMinter;

  before(async function() {
    let network = process.env.NETWORK;
    if (network === "tdd") {
      this.skip();
    }
    const staking_file = await fse.readFile("releases/deployment.json", "utf8");
    const dao_file = await fse.readFile("../releases/deployment.json", "utf8");
    const staking_deployment = await JSON.parse(staking_file);
    const dao_deployment = await JSON.parse(dao_file);
    const staking_addresses = staking_deployment[NETWORK];
    const dao_addresses = dao_deployment[NETWORK];
    avatarAddress = dao_addresses.Avatar;
    dai = await DAIMock.at(staking_addresses.DAI);
    cDAI = await cDAIMock.at(staking_addresses.cDAI);
    goodReserve = await GoodReserve.at(staking_addresses.Reserve);
    marketMaker = await MarketMaker.at(staking_addresses.MarketMaker);
    contribution = await ContributionCalculation.at(staking_addresses.Contribution);
    goodDollar = await GoodDollar.at(dao_addresses.GoodDollar);
    registrar = await SchemeRegistrar.at(dao_addresses.SchemeRegistrar);
    absoluteVote = await AbsoluteVote.at(dao_addresses.AbsoluteVote);

    // schemes
    setMarketMaker = await SetMarketMaker.new(
      avatarAddress,
      goodReserve.address,
      marketMaker.address
    );
    setBlockInterval = await SetBlockInterval.new(
      avatarAddress,
      goodReserve.address,
      5759
    );
    setContributionAddress = await SetContributionAddress.new(
      avatarAddress,
      goodReserve.address,
      contribution.address
    );
    addMinter = await AddMinter.new(avatarAddress, goodReserve.address);

    await proposeAndRegister(
      addMinter.address,
      registrar,
      proposalId,
      absoluteVote,
      avatarAddress,
      founder
    );
    await addMinter.addMinter();
  });

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
    const executeProposalEventExists = await proposeAndRegister(
      setMarketMaker.address,
      registrar,
      proposalId,
      absoluteVote,
      avatarAddress,
      founder
    );
    // Verifies that the ExecuteProposal event has been emitted
    expect(executeProposalEventExists).to.be.true;
    await setMarketMaker.setMarketMaker();
    const marketMaker2 = await goodReserve.marketMaker();
    expect(marketMaker2).to.be.equal(marketMaker.address);
  });

  it("should be able to set the blockInterval", async () => {
    const executeProposalEventExists = await proposeAndRegister(
      setBlockInterval.address,
      registrar,
      proposalId,
      absoluteVote,
      avatarAddress,
      founder
    );
    // Verifies that the ExecuteProposal event has been emitted
    expect(executeProposalEventExists).to.be.true;
    await setBlockInterval.setBlockInterval();
    const blockInterval = await goodReserve.blockInterval();
    expect(blockInterval.toString()).to.be.equal("5759");
  });

  it("should be able to set the contribution address", async () => {
    const executeProposalEventExists = await proposeAndRegister(
      setContributionAddress.address,
      registrar,
      proposalId,
      absoluteVote,
      avatarAddress,
      founder
    );
    // Verifies that the ExecuteProposal event has been emitted
    expect(executeProposalEventExists).to.be.true;
    await setContributionAddress.setContributionAddress();
    const contributionAddressT = await goodReserve.contribution();
    expect(contributionAddressT).to.be.equal(contribution.address);
  });

  it("should returned fixed 0.005 market price", async () => {
    const gdPrice = await goodReserve.currentPrice(cDAI.address);
    const cdaiWorthInGD = gdPrice.mul(new BN("100000000", 10));
    const gdFloatPrice = gdPrice.toNumber() / 10 ** 8; //cdai 8 decimals
    expect(gdFloatPrice).to.be.equal(0.005);
    expect(cdaiWorthInGD.toString()).to.be.equal("50000000000000"); //in 8 decimals precision
    expect(cdaiWorthInGD.toNumber() / 10 ** 8).to.be.equal(500000);
  });

  it("should be able to buy gd with cDAI and reserve should be correct", async () => {
    let amount = 1e8;
    await dai.mint(web3.utils.toWei("100", "ether"));
    dai.approve(cDAI.address, web3.utils.toWei("100", "ether"));
    await cDAI.mint(web3.utils.toWei("100", "ether"));
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceBefore = reserveToken.reserveSupply;
    const cDAIBalanceReserveBefore = await cDAI.balanceOf(goodReserve.address);
    await cDAI.approve(goodReserve.address, amount);
    await goodReserve.buy(cDAI.address, amount, 0);
    reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceAfter = reserveToken.reserveSupply;
    const cDAIBalanceReserveAfter = await cDAI.balanceOf(goodReserve.address);
    expect((cDAIBalanceReserveAfter - cDAIBalanceReserveBefore).toString()).to.be.equal(
      amount.toString()
    );
    expect((reserveBalanceAfter - reserveBalanceBefore).toString()).to.be.equal(
      amount.toString()
    );
  });

  it("should be able to buy gd with cDAI and the total gd should be increased", async () => {
    let amount = 1e8;
    await dai.mint(web3.utils.toWei("100", "ether"));
    dai.approve(cDAI.address, web3.utils.toWei("100", "ether"));
    await cDAI.mint(web3.utils.toWei("100", "ether"));
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let gdSupplyBefore = reserveToken.gdSupply;
    await cDAI.approve(goodReserve.address, amount);
    await goodReserve.buy(cDAI.address, amount, 0);
    reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let gdSupplyAfter = reserveToken.gdSupply;
    expect(gdSupplyAfter.gt(gdSupplyBefore)).to.be.true;
  });

  it("should be able to retain the precision when buying a low quantity of tokens", async () => {
    let amount = 1e8;
    await dai.mint(web3.utils.toWei("100", "ether"));
    dai.approve(cDAI.address, web3.utils.toWei("100", "ether"));
    await cDAI.mint(web3.utils.toWei("100", "ether"));
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    const priceBefore = await goodReserve.currentPrice(cDAI.address);
    await cDAI.approve(goodReserve.address, amount);
    await goodReserve.buy(cDAI.address, amount, 0);
    reserveToken = await marketMaker.reserveTokens(cDAI.address);
    const priceAfter = await goodReserve.currentPrice(cDAI.address);
    expect(Math.floor(priceAfter.toNumber() / 100).toString()).to.be.equal(
      Math.floor(priceBefore.toNumber() / 100).toString()
    );
  });

  it("should be able to sell gd to cDAI and reserve should be correct", async () => {
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalance = reserveToken.reserveSupply.toNumber();
    let supply = reserveToken.gdSupply.toNumber();
    let amount = 1e4;
    const cDAIBalanceBefore = await cDAI.balanceOf(founder);
    const cDAIBalanceReserveBefore = await cDAI.balanceOf(goodReserve.address);
    await goodDollar.approve(goodReserve.address, amount);
    await goodReserve.sell(cDAI.address, amount, 0);
    const cDAIBalanceAfter = await cDAI.balanceOf(founder);
    const cDAIBalanceReserveAfter = await cDAI.balanceOf(goodReserve.address);
    // return = reserveBalance * (1 - (1 - sellAmount / supply) ^ (1000000 / reserveRatio))
    // reserve ratio is 100% so:
    // return = reserve balance * (1 - (1 - sellAmount / supply))
    // the contribution ratio is 20%
    let expected = reserveBalance * (1 - (1 - amount / supply));
    expected = Math.ceil(expected - 0.2 * expected);
    expect(Math.floor((cDAIBalanceAfter.toNumber() - cDAIBalanceBefore.toNumber()) / 10 ** 8)).to.be.equal(
      Math.floor(expected / 10 ** 8)
    );
    expect((cDAIBalanceReserveBefore - cDAIBalanceReserveAfter).toString()).to.be.equal(
      expected.toString()
    );
  });

  it("should be able to retain the precision when selling a low quantity of tokens", async () => {
    let amount = 1e1;
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    const priceBefore = await goodReserve.currentPrice(cDAI.address);
    await goodDollar.approve(goodReserve.address, amount);
    await goodReserve.sell(cDAI.address, amount, 0);
    reserveToken = await marketMaker.reserveTokens(cDAI.address);
    const priceAfter = await goodReserve.currentPrice(cDAI.address);
    expect(Math.floor(priceAfter.toNumber() / 100).toString()).to.be.equal(
      Math.floor(priceBefore.toNumber() / 100).toString()
    );
  });
});
