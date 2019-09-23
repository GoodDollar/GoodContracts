import * as helpers from '../helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const ReputationMock = artifacts.require("ReputationMock");
const Reputation = artifacts.require("Reputation");

contract("Integration - Claiming Reputation", ([founder, claimer, claimer2]) => {

  let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
  let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
  let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
  let reputationMock: helpers.ThenArg<ReturnType<typeof ReputationMock['new']>>;
  let reputation: helpers.ThenArg<ReturnType<typeof Reputation['new']>>;

  let proposalId: string;

  const periodOffset = 60000;
  const reward = web3.utils.toWei("10");

  before(async () => {
    const periodStart = (await web3.eth.getBlock('latest')).timestamp + periodOffset;
    const periodEnd = periodStart + periodOffset;

    identity = await Identity.deployed();
    avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
    controller = await ControllerInterface.at(await avatar.owner());
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());
    reputationMock = await ReputationMock.new(avatar.address, identity.address, reward, periodStart, periodEnd, { from: founder } );
    reputation = await Reputation.at(await avatar.nativeReputation());

    await identity.addClaimer(claimer);
  });

  it("should not allow creation of scheme with zero or less reputation", async () => {
    const periodStart = (await web3.eth.getBlock('latest')).timestamp + periodOffset;
    const periodEnd = periodStart + periodOffset;

    helpers.assertVMException(ReputationMock.new(avatar.address, identity.address, 0, periodStart, periodEnd, { from: founder }),
      "reputation reward cannot be equal to or lower than zero");
  });

  it("should correctly propose Rep scheme", async () => {
    // Propose it
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeScheme(avatar.address, reputationMock.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

   proposalId = transaction.logs[0].args._proposalId;
  });

  it("should correctly register Rep scheme", async () => {
    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);
  });

  it("should reward claimer and creator for starting period", async () => {
    const oldReputationBalanceClaimer = await reputation.balanceOf(claimer);
    const oldReputationBalanceFounder = (await reputation.balanceOf(founder)) as any;
    
    expect(oldReputationBalanceClaimer.toString()).to.be.equal('0');
    expect(oldReputationBalanceFounder.toString()).to.be.equal(reward.toString());

    await helpers.assertVMException(reputationMock.start(), "not in period");
    await helpers.increaseTime(periodOffset*1.5);
    assert(await reputationMock.start({ from: claimer }));

    const newReputationBalanceClaimer = await reputation.balanceOf(claimer);
    const newReputationBalanceFounder = (await reputation.balanceOf(founder)) as any;
    const founderNewOldRepDiff = newReputationBalanceFounder.sub(oldReputationBalanceFounder);

    expect(newReputationBalanceClaimer.toString()).to.be.equal(reward.toString());
    expect(founderNewOldRepDiff.toString()).to.be.equal(reward.toString());
  });

  it("should reward for ending Rep period", async () => {
    const oldReputationBalanceClaimer = (await reputation.balanceOf(claimer)) as any;
    expect(oldReputationBalanceClaimer.toString()).to.be.equal(reward);

    await helpers.assertVMException(reputationMock.end(avatar.address), "period has not ended");
    await helpers.increaseTime(periodOffset);
    assert(await reputationMock.end(avatar.address, { from: claimer }));

    const newReputationBalanceClaimer = (await reputation.balanceOf(claimer)) as any;
    const claimerRepDiff = newReputationBalanceClaimer.sub(oldReputationBalanceClaimer);
    expect(claimerRepDiff.toString()).to.be.equal(reward.toString());
  });
});

// Important see: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}