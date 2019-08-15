import * as helpers from '../helpers';

const Identity = artifacts.require("Identity");
const FeeFormula = artifacts.require("FeeFormula");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const UBI = artifacts.require("UBI");

contract("Integration - Claiming UBI", ([founder, claimer, nonClaimer, stranger]) => {

  let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
  let feeFormula: helpers.ThenArg<ReturnType<typeof FeeFormula['new']>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
  let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
  let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
  let ubi: helpers.ThenArg<ReturnType<typeof UBI['new']>>;
  let noMintUBI: helpers.ThenArg<ReturnType<typeof UBI['new']>>;
  let reserveUBI: helpers.ThenArg<ReturnType<typeof UBI['new']>>;

  let proposalId: string;

  const periodOffset = 60000;

  before(async () => {
    const periodStart = (await web3.eth.getBlock('latest')).timestamp + periodOffset;
    const periodEnd = periodStart + periodOffset;
    const periodStart2 = periodEnd + periodOffset;
    const periodEnd2 = periodStart2 + periodOffset*2;

    identity = await Identity.deployed();
    feeFormula = await FeeFormula.deployed();
    avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
    controller = await ControllerInterface.at(await avatar.owner());
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());
    noMintUBI = await UBI.new(avatar.address, identity.address, web3.utils.toWei("0"), periodStart, periodEnd);
    ubi = await UBI.new(avatar.address, identity.address, web3.utils.toWei("1000"), periodStart2, periodEnd2);

    await identity.addClaimer(claimer);
  });

  it("should correctly propose and register no minting UBI scheme", async () => {
    // Propose it
    const schemeRegistrar = await SchemeRegistrar.deployed();
    let transaction = await schemeRegistrar.proposeScheme(avatar.address, noMintUBI.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);
  });
  
  it("should start no minting UBI scheme", async () => {
    await helpers.assertVMException(noMintUBI.start(), "not in period");
    await helpers.increaseTime(periodOffset*1.1);
    assert(await noMintUBI.start());
  });

  it("should end UBI scheme with no remaining reserve", async () => {
    await helpers.assertVMException(noMintUBI.end(avatar.address), "period has not ended");
    await helpers.increaseTime(periodOffset);

    const reserve = await token.balanceOf(noMintUBI.address);

    expect(reserve.toString()).to.be.equal("0");
    assert(await noMintUBI.end(avatar.address));
  });

  it("should perform transactions and increase fee reserve", async () => {
    const oldReserve = await token.balanceOf(avatar.address);
    expect(oldReserve.toString()).to.be.equal(web3.utils.toWei("0"));

    await token.transfer(claimer, web3.utils.toWei("10"));
    await token.transfer(claimer, web3.utils.toWei("10"));
    await token.transfer(claimer, web3.utils.toWei("10"));

    // Check that reserve has received fees
    const reserve = (await token.balanceOf(avatar.address)) as any;

    const reserveDiff = reserve.sub(oldReserve);
    const totalFees = ((await token.getFees(web3.utils.toWei("10"))) as any).mul(new (web3 as any).utils.BN("3"));
    expect(reserveDiff.toString()).to.be.equal(totalFees.toString());
  });

  it("should correctly propose UBI scheme", async () => {
    // Propose it
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeScheme(avatar.address, ubi.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;
  });

  it("should correctly register UBI scheme", async () => {
    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);
  });

  it("should start UBI period", async () => {
    await helpers.assertVMException(ubi.start(), "not in period");
    await helpers.increaseTime(periodOffset);
    assert(await ubi.start());
  });

  it("should correctly claim UBI", async () => {
    const oldClaimerBalance = await token.balanceOf(claimer);

    assert(await ubi.claim({ from: claimer }));
    const amountClaimed = await ubi.getClaimAmount();

    // Check that claimer has received the claimed amount
    const fee = await token.getFees(await token.balanceOf(ubi.address));
    const claimDistributionMinusFee = ((await ubi.claimDistribution()) as any).sub(fee);

    const claimerBalance = (await token.balanceOf(claimer)) as any;
    const claimerBalanceDiff = claimerBalance.sub(oldClaimerBalance);

    expect(claimerBalanceDiff.toString()).to.be.equal(claimDistributionMinusFee.toString());
    expect(claimerBalanceDiff.toString()).to.be.equal(amountClaimed.toString());
  });

  it("should show amount of claimers", async () => {
    const claimerAmount = await ubi.getClaimerCount();
    expect(claimerAmount.toString()).to.be.equal("1");
  });

  it("should show amount claimed", async () => {
    const amountClaimed = await ubi.getClaimAmount();

    const distribution = (await ubi.claimDistribution()) as any;
    const expectedDistribution = await distribution.sub(await token.getFees(distribution));

    expect(expectedDistribution.toString()).to.be.equal(amountClaimed.toString());
  });

  it("should not allow to claim twice", async () => {
    await helpers.assertVMException(ubi.claim({ from: claimer }), "has already claimed");
  });

  it("should not allow non-claimer to claim", async () => {
    await helpers.assertVMException(ubi.claim({ from: nonClaimer }), "is not claimer");
  });

  it("should not allow new claimer to claim", async () => {
    await helpers.increaseTime(periodOffset);
    await identity.addClaimer(stranger);

    await helpers.assertVMException(ubi.claim( { from: stranger }), "Was not added within period");
  });

  it("should end UBI period", async () => {
    await helpers.assertVMException(ubi.end(avatar.address), "period has not ended");
    await helpers.increaseTime(periodOffset);
    assert(await ubi.end(avatar.address));
  });
});

export {}