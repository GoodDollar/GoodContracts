import * as helpers from './helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const ActivePeriodMock = artifacts.require("ActivePeriodMock");

contract("Integration - Active Period", ([founder, claimer, nonClaimer]) => {

  let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
  let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
  let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
  let activePeriodMock: helpers.ThenArg<ReturnType<typeof ActivePeriodMock['new']>>;

  let proposalId: string;

  const periodOffset = 60000;

  before(async () => {

    const periodStart = (await web3.eth.getBlock('latest')).timestamp + periodOffset;
    const periodEnd = periodStart + periodOffset;

    avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
    controller = await ControllerInterface.at(await avatar.owner());
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());

    await helpers.assertVMException( ActivePeriodMock.new(periodEnd, periodStart), "start cannot be after nor equal to end")
    activePeriodMock = await ActivePeriodMock.new(periodStart, periodEnd);
  });

  it("should correctly propose and register scheme", async () => {

    // Propose it
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeScheme(avatar.address, activePeriodMock.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);
  });

  it("should not end inactive scheme", async () => {
    helpers.assertVMException(activePeriodMock.end(avatar.address), "is not active");
  });

  it("should not allow starting twice", async () => {
    await helpers.increaseTime(periodOffset*1.5);
    await activePeriodMock.start();
    await helpers.assertVMException(activePeriodMock.start(), "cannot start twice");
    await activePeriodMock.end(avatar.address);
  });

  it("should unregister scheme", async () => {
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeToRemoveScheme(avatar.address, activePeriodMock.address,
          helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    assert(executeProposalEventExists);
  });
});
// Important see: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}