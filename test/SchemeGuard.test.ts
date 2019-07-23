import * as helpers from './helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const SchemeGuardMock = artifacts.require("SchemeGuardMock");

contract("SchemeGuard - registered schemes", ([founder, claimer, nonClaimer]) => {

  let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
  let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
  let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
  let mock: helpers.ThenArg<ReturnType<typeof SchemeGuardMock['new']>>;

  let proposalId: string;

  before(async () => {

    avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
    controller = await ControllerInterface.at(await avatar.owner());
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());
    mock = await SchemeGuardMock.new(avatar.address);
    mock.transferOwnership(avatar.address);

  });

  it("should not start scheme", async () => {
    await helpers.assertVMException(mock.start(), "Scheme is not registered");
  });

  it("should correctly propose and register scheme", async () => {

    // Propose it
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeScheme(avatar.address, mock.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);
  });

  it("should have registered scheme", async () => {
    await mock.isRegistered();
  })

  it("should start scheme", async () => {
    assert(await mock.start());
  });

  it("should not end scheme", async () => {
     await helpers.assertVMException(mock.end(), "Scheme is registered");
  });

  it("should unregister scheme", async () => {
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeToRemoveScheme(avatar.address, mock.address,
          helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    assert(executeProposalEventExists);
  });

  it("should end scheme", async () => {
    assert(await mock.end());
  });
});
// Important see: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}