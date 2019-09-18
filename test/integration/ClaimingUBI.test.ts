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
const FixedUBI = artifacts.require("FixedUBI");
const ReserveRelayer = artifacts.require("ReserveRelayer");

contract("Integration - Claiming UBI", ([founder, claimer, claimer2, claimer3, claimer4, nonClaimer, stranger]) => {

  let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
  let feeFormula: helpers.ThenArg<ReturnType<typeof FeeFormula['new']>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
  let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
  let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
  let ubi: helpers.ThenArg<ReturnType<typeof UBI['new']>>;
  let reserveUBI: helpers.ThenArg<ReturnType<typeof UBI['new']>>;
  let fixedUBI: helpers.ThenArg<ReturnType<typeof FixedUBI['new']>>;
  let emptyUBI: helpers.ThenArg<ReturnType<typeof UBI['new']>>;
  let reserveRelayer: helpers.ThenArg<ReturnType<typeof ReserveRelayer['new']>>;

  let proposalId: string;

  const periodOffset = 60000;

  before(async () => {
    const periodStart = (await web3.eth.getBlock('latest')).timestamp + periodOffset;
    const periodEnd = periodStart + periodOffset;
    const periodStart2 = periodEnd + periodOffset;
    const periodEnd2 = periodStart2 + periodOffset*2;
    const periodEnd3 = periodEnd2 + periodOffset*100000;

    identity = await Identity.deployed();
    feeFormula = await FeeFormula.deployed();
    avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
    controller = await ControllerInterface.at(await avatar.owner());
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());
    ubi = await UBI.new(avatar.address, identity.address, web3.utils.toWei("0.3"), periodStart2, periodEnd2);
    reserveUBI = await UBI.new(avatar.address, identity.address, web3.utils.toWei("300000"), periodStart2, periodEnd2);
    emptyUBI = await UBI.new(avatar.address, identity.address, web3.utils.toWei("0"), periodStart, periodEnd);
    fixedUBI = await FixedUBI.new(avatar.address, identity.address, web3.utils.toWei("0"), periodEnd2, periodEnd3, web3.utils.toWei("1"));
    reserveRelayer = await ReserveRelayer.new(avatar.address, fixedUBI.address, periodEnd2, periodEnd3);

    await identity.addClaimer(claimer);
  });

  it("should end UBI scheme with no remaining reserve", async () => {
    // Propose it
    const schemeRegistrar = await SchemeRegistrar.deployed();
    let transaction = await schemeRegistrar.proposeScheme(avatar.address, emptyUBI.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);

    await helpers.assertVMException(emptyUBI.start(), "not in period");
    await helpers.increaseTime(periodOffset*1.1);
    assert(await emptyUBI.start());

    await helpers.assertVMException(emptyUBI.end(avatar.address), "period has not ended");
    await helpers.increaseTime(periodOffset);

    const reserve = await token.balanceOf(emptyUBI.address);

    expect(reserve.toString()).to.be.equal("0");
    assert(await emptyUBI.end(avatar.address));
  });

  it("should perform transactions and increase fee reserve", async () => {
    const oldReserve = await token.balanceOf(avatar.address);

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

  it("should not allow starting scheme without enough funds", async () => {
    const schemeRegistrar = await SchemeRegistrar.deployed();
    let transaction = await schemeRegistrar.proposeScheme(avatar.address, reserveUBI.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);

    await helpers.assertVMException(reserveUBI.start(), "Not enough funds to start");
  });

  it("should register fixed claim scheme and add claimers", async () => {
    const schemeRegistrar = await SchemeRegistrar.deployed();
    let transaction = await schemeRegistrar.proposeScheme(avatar.address, fixedUBI.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);

    await identity.addClaimer(claimer2);
    await identity.addClaimer(claimer3);
  });

  it("should correctly claim UBI", async () => {
    const oldClaimerBalance = await token.balanceOf(claimer);

    assert(await ubi.claim({ from: claimer }));
    const amountClaimed = await ubi.getClaimAmount(0);

    // Check that claimer has received the claimed amount
    const claimDistribution = ((await ubi.claimDistribution()) as any);

    const claimerBalance = (await token.balanceOf(claimer)) as any;
    const claimerBalanceDiff = claimerBalance.sub(oldClaimerBalance);

    expect(claimerBalanceDiff.toString()).to.be.equal(claimDistribution.toString());
    expect(claimerBalanceDiff.toString()).to.be.equal(amountClaimed.toString());
  });

  it("should show amount of claimers", async () => {

    const claimerAmount = await ubi.getClaimerCount(0);
    expect(claimerAmount.toString()).to.be.equal("1");
  });

  it("should show amount claimed", async () => {
    const amountClaimed = await ubi.getClaimAmount(0);

    const distribution = (await ubi.claimDistribution()) as any;

    expect(distribution.toString()).to.be.equal(amountClaimed.toString());
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

  it("should allow starting fixed claim scheme", async () => {
     assert(await fixedUBI.start());
     await helpers.increaseTime(periodOffset*5);
  });

  it("should correctly register ReserveRelayer scheme and transfer new fees to fixed UBI", async () => {
    await token.transfer(claimer, web3.utils.toWei("10"));
    await token.transfer(claimer, web3.utils.toWei("10"));
    await token.transfer(avatar.address, web3.utils.toWei("100"));

    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeScheme(avatar.address, reserveRelayer.address,
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    assert(executeProposalEventExists);
    assert(await reserveRelayer.start());
  });

  it("should allow claiming from fixed UBI", async () => {
    assert(await fixedUBI.claim({ from: claimer3 }));
  });

  it("should not allow claiming on same day from fixed UBI", async () => {
    await helpers.assertVMException(fixedUBI.claim({ from: claimer3 }), "Has claimed within a day");
  });

  it("should not allow to claim for more than seven days", async () => {
    await helpers.increaseTime(periodOffset*5000);
    await token.burn(await token.balanceOf(claimer3), { from: claimer3 });
    const oldBalanceclaimer3 = await token.balanceOf(claimer3);
    expect(oldBalanceclaimer3.toString()).to.be.equal(web3.utils.toWei("0"));

    const claimDays = await fixedUBI.checkEntitlement({ from: claimer3 });
    expect(claimDays.toString()).to.be.equal("7");

    await fixedUBI.claim({ from: claimer3 });

    const newBalanceclaimer3 = await token.balanceOf(claimer3);

    const maxValue = ((web3.utils.toWei("7")) as any);
    expect(newBalanceclaimer3.toString()).to.be.equal(maxValue.toString());
  });

  it("should get daily stats", async () => {
    const res = await fixedUBI.getDailyStats();

    const maxValue = ((web3.utils.toWei("7")) as any);

    expect(res[0].toString()).to.be.equal("1");
    expect(res[1].toString()).to.be.equal(maxValue.toString());    
  });
});

export {}