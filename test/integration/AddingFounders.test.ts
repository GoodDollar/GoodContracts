import * as helpers from '../helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AddFounder = artifacts.require("AddFounder");

contract("Integration - adding founders", ([founder, joiner, stranger]) => {

  let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
  let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
  let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
  let addFounder: helpers.ThenArg<ReturnType<typeof AddFounder['new']>>;
  let addFounder2: helpers.ThenArg<ReturnType<typeof AddFounder['new']>>;
  let addFounder3: helpers.ThenArg<ReturnType<typeof AddFounder['new']>>;
  let proposalId: string;

  const periodOffset = 60000;
  const initRep = web3.utils.toWei("10");
  const zeroRep = web3.utils.toWei("0");
  const initToken = web3.utils.toWei("100");
  const zeroToken =web3.utils.toWei("0");

  before(async () => {
    const periodStart = (await web3.eth.getBlock('latest')).timestamp + periodOffset;
    const periodEnd = periodStart + periodOffset;

    identity = await Identity.deployed();
    avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
    controller = await ControllerInterface.at(await avatar.owner());
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());
    addFounder = await AddFounder.new(avatar.address, founder, initToken, zeroRep, periodStart, periodEnd);
    addFounder2 = await AddFounder.new(avatar.address, founder, zeroToken, initRep, periodStart, periodEnd);
  });

  it("should not allow creation of scheme with zero address founder", async () => {
    const periodStart = (await web3.eth.getBlock('latest')).timestamp;
    const periodEnd = periodStart + periodOffset;

    await helpers.assertVMException(
      AddFounder.new(
        avatar.address, helpers.NULL_ADDRESS, initToken,
        zeroRep, periodStart, periodEnd), "Founder cannot be zero address");
  });

  it("should only be able to create scheme if founder has tokens or reputation", async() => {
    const periodStart = (await web3.eth.getBlock('latest')).timestamp;
    const periodEnd = periodStart + periodOffset;

    await helpers.assertVMException(
      AddFounder.new(
        avatar.address, founder, zeroToken, zeroRep,
        periodStart, periodEnd), "Cannot grant founder nothing");
  });

  it("should add successfully to founders", async () => {
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeScheme(avatar.address, addFounder.address, 
        helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;
    
    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

      // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);

    await helpers.assertVMException(addFounder.start(), "not in period");
    await helpers.increaseTime(periodOffset*1.5)
    assert(await addFounder.start());

    
    const transaction2 = await schemeRegistrar.proposeScheme(avatar.address, addFounder2.address, 
        helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction2.logs[0].args._proposalId;
    
    const voteResult2 = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists2 = voteResult2.logs.some(e => e.event === 'ExecuteProposal');

      // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists2);
    assert(await addFounder2.start());
  });

});

// Important see: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}