import * as helpers from '../helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const OneTimePayments = artifacts.require("OneTimePayments");

const DEPOSIT_CODE = 'test';
const DEPOSIT_CODE_HASH = web3.utils.keccak256(DEPOSIT_CODE);

contract("Integration - One-Time Payments", ([founder, claimer]) => {
  
  let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
  let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
  let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
  let oneTimePayments: helpers.ThenArg<ReturnType<typeof OneTimePayments['new']>>;

  let proposalId: string;

  before(async () => {
    identity = await Identity.deployed();
    avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
    controller = await ControllerInterface.at(await avatar.owner());
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());
    oneTimePayments = await OneTimePayments.new(avatar.address);

    await identity.addClaimer(claimer);
  });

  it("should not allow One-Time payments before registering", async () => {
    await token.transfer(claimer, web3.utils.toWei("10"));

    await helpers.assertVMException(token.transferAndCall(oneTimePayments.address, web3.utils.toWei("5"), DEPOSIT_CODE_HASH, { from: claimer }),
      "Scheme is not registered");
  });

  it("should correctly propose One-Time Payment scheme", async () => {
    // Propose it
    const schemeRegistrar = await SchemeRegistrar.deployed();    
    const transaction = await schemeRegistrar.proposeScheme(avatar.address, oneTimePayments.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;
  });

  it("should correctly register One-Time payment scheme", async () => {
    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const excecuteProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    assert(excecuteProposalEventExists);
  });

  it("should not have payment", async () => {
    assert(!(await oneTimePayments.hasPayment(DEPOSIT_CODE_HASH)));
  });

  it("should only allow token to deposit", async () => {
    helpers.assertVMException(oneTimePayments.onTokenTransfer(claimer, web3.utils.toWei("5"), DEPOSIT_CODE_HASH, { from: claimer }), "Only callable by this");
  });

  it("should deposit successfully", async () => {
    await token.transfer(claimer, web3.utils.toWei("300"));

    await token.transferAndCall(oneTimePayments.address, web3.utils.toWei("5"), DEPOSIT_CODE_HASH, { from: claimer });

    assert(await oneTimePayments.hasPayment(DEPOSIT_CODE_HASH));
  });

  it("should not allow to deposit to same hash", async () => {

    await helpers.assertVMException(token.transferAndCall(oneTimePayments.address, web3.utils.toWei("5"), DEPOSIT_CODE_HASH, { from: claimer }), "Hash already in use");
  });

  it("should have payment", async () => {
    assert(await oneTimePayments.hasPayment(DEPOSIT_CODE_HASH));
  })

  it("should withdraw successfully", async () => {
    await oneTimePayments.withdraw(DEPOSIT_CODE, { from: founder });

    assert(!(await oneTimePayments.hasPayment(DEPOSIT_CODE_HASH)));
  });

  it("should not allow withdraw from unused link", async () => {
    await helpers.assertVMException(oneTimePayments.withdraw("test2", { from: founder}), "Hash not in use");
  });

  it("should not allow to withdraw from already withdrawn", async () => {
    await helpers.assertVMException(oneTimePayments.withdraw(DEPOSIT_CODE, { from: founder}), "Hash not in use");
  })

  it("should propose to unregister One-Time payment scheme", async () => {
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeToRemoveScheme(avatar.address, oneTimePayments.address,
      helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;
  });

  it("should correctly unregister One-Time payment scheme", async () => {
    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const excecuteProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    assert(excecuteProposalEventExists);
  });

  it("should not allow One-Time payments after registering", async () => {
    await token.transfer(claimer, web3.utils.toWei("10"));

    await helpers.assertVMException(token.transferAndCall(oneTimePayments.address, web3.utils.toWei("5"), DEPOSIT_CODE_HASH, { from: claimer }),
      "Scheme is not registered");
  });
});

export {}