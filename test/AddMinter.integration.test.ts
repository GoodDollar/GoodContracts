import * as helpers from './helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AddMinter = artifacts.require("AddMinter");

contract("Integration - adding minter", ([founder, minter, claimer, nonClaimer]) => {

  let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
  let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
  let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
  let addMinter: helpers.ThenArg<ReturnType<typeof AddMinter['new']>>;

  let proposalId: string;

  before(async () => {

    avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
    controller = await ControllerInterface.at(await avatar.owner());
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());
    addMinter = await AddMinter.new(avatar.address, minter);
  });

  it("should not create scheme with zero address", async () => {
    await helpers.assertVMException(AddMinter.new(avatar.address, helpers.NULL_ADDRESS), "Minter must not be null");
  });

  it("should not add minter", async () => {
    assert(!(await token.isMinter(minter)));
    await helpers.assertVMException(addMinter.addMinter(), "Scheme is not registered");
    assert(!(await token.isMinter(minter)));
  });

  it("should correctly propose and register scheme", async () => {
    // Propose it
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeScheme(avatar.address, addMinter.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);
  });

  it("should add minter", async () => {
    assert(!(await token.isMinter(minter)));
    addMinter.addMinter();
    assert(await token.isMinter(minter));
  })
});
// Important see: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}