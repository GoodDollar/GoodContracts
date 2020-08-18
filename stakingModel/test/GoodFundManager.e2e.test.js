const GoodCompoundStaking = artifacts.require("GoodCompoundStaking");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");
const GoodReserve = artifacts.require("GoodReserveCDai");
const MarketMaker = artifacts.require("GoodMarketMaker");
const GoodDollar = artifacts.require("GoodDollar");
const GoodFundsManager = artifacts.require("GoodFundManager");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const FundManagerSetReserve = artifacts.require("FundManagerSetReserve");
const { next_interval } = require("./helpers");

const fse = require("fs-extra");

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

contract("GoodFundManager - network e2e tests", ([founder, staker]) => {
  let dai,
    cDAI,
    goodCompoundStaking,
    goodReserve,
    goodFundManager,
    goodDollar,
    marketMaker,
    contribution;
  let ubiBridgeRecipient, avatarAddress, registrar, absoluteVote, proposalId, setReserve;

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
    ubiBridgeRecipient = staking_addresses.UBIScheme;
    dai = await DAIMock.at(staking_addresses.DAI);
    cDAI = await cDAIMock.at(staking_addresses.cDAI);
    goodCompoundStaking = await GoodCompoundStaking.at(staking_addresses.DAIStaking);
    goodReserve = await GoodReserve.at(staking_addresses.Reserve);
    goodFundManager = await GoodFundsManager.at(staking_addresses.FundManager);
    marketMaker = await MarketMaker.at(staking_addresses.MarketMaker);
    goodDollar = await GoodDollar.at(dao_addresses.GoodDollar);
    registrar = await SchemeRegistrar.at(dao_addresses.SchemeRegistrar);
    absoluteVote = await AbsoluteVote.at(dao_addresses.AbsoluteVote);
    // schemes
    setReserve = await FundManagerSetReserve.new(
      avatarAddress,
      goodFundManager.address,
      goodReserve.address
    );

    await dai.mint(staker, web3.utils.toWei("100", "ether"));
    await dai.approve(goodCompoundStaking.address, web3.utils.toWei("100", "ether"), {
      from: staker
    });
    await goodCompoundStaking
      .stake(web3.utils.toWei("100", "ether"), 100, {
        from: staker
      })
      .catch(console.log);
    await cDAI.exchangeRateCurrent();
    await cDAI.exchangeRateStored();
  });

  it("should be able to set the reserve", async () => {
    const executeProposalEventExists = await proposeAndRegister(
      setReserve.address,
      registrar,
      proposalId,
      absoluteVote,
      avatarAddress,
      founder
    );
    // Verifies that the ExecuteProposal event has been emitted
    expect(executeProposalEventExists).to.be.true;
    await setReserve.setReserve();
    const reserve1 = await goodFundManager.reserve();
    expect(reserve1).to.be.equal(goodReserve.address);
  });

  it("should collect the interest and transfer it to the reserve and the bridge recipient should recieves minted gd", async () => {
    await next_interval(await goodFundManager.blockInterval());
    await cDAI.exchangeRateCurrent();
    let recipientBefore = await goodDollar.balanceOf(ubiBridgeRecipient);
    const gdPriceBefore = await marketMaker.currentPrice(cDAI.address);
    await goodFundManager.transferInterest(goodCompoundStaking.address);
    const gdPriceAfter = await marketMaker.currentPrice(cDAI.address);
    let recipientAfter = await goodDollar.balanceOf(ubiBridgeRecipient);
    let stakingGDBalance = await goodDollar.balanceOf(goodCompoundStaking.address);
    expect(stakingGDBalance.toString()).to.be.equal("0"); //100% of interest is donated, so nothing is returned to staking
    expect(recipientAfter.sub(recipientBefore).toString()).to.be.equal("38081"); // total of interest + minted from expansion (received 100%)
    expect(Math.floor(gdPriceAfter.toNumber() / 100).toString()).to.be.equal(
      Math.floor(gdPriceBefore.toNumber() / 100).toString()
    );
  });
});