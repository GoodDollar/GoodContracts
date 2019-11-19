import * as helpers from "./helpers";
const settings = require("../migrations/deploy-settings.json");
const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const OneTimePayments = artifacts.require("OneTimePayments");

const DEPOSIT_CODE = "test";
const DEPOSIT_CODE_HASH = web3.utils.keccak256(DEPOSIT_CODE);

const GASLIMIT = settings["test"].gasLimit;

contract("Integration - One-Time Payments", ([founder, whitelisted]) => {
  let identity: helpers.ThenArg<ReturnType<typeof Identity["new"]>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar["new"]>>;
  let controller: helpers.ThenArg<
    ReturnType<typeof ControllerInterface["new"]>
  >;
  let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote["new"]>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar["new"]>>;
  let oneTimePayments: helpers.ThenArg<
    ReturnType<typeof OneTimePayments["new"]>
  >;

  let proposalId: string;

  before(async () => {
    identity = await Identity.deployed();
    avatar = await Avatar.at(
      await (await DaoCreatorGoodDollar.deployed()).avatar()
    );
    controller = await ControllerInterface.at(await avatar.owner());
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());
    oneTimePayments = await OneTimePayments.new(
      avatar.address,
      identity.address,
      GASLIMIT
    );

    await identity.addWhitelisted(whitelisted);
  });

  it("should not allow One-Time payments before registering", async () => {
    await token.transfer(whitelisted, helpers.toGD("10"));

    await helpers.assertVMException(
      token.transferAndCall(
        oneTimePayments.address,
        helpers.toGD("5"),
        DEPOSIT_CODE_HASH,
        { from: whitelisted }
      ),
      "Scheme is not registered"
    );
  });

  it("should correctly propose One-Time Payment scheme", async () => {
    // Propose it
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeScheme(
      avatar.address,
      oneTimePayments.address,
      helpers.NULL_HASH,
      "0x00000010",
      helpers.NULL_HASH
    );

    proposalId = transaction.logs[0].args._proposalId;
  });

  it("should correctly register One-Time payment scheme", async () => {
    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const excecuteProposalEventExists = voteResult.logs.some(
      e => e.event === "ExecuteProposal"
    );

    assert(excecuteProposalEventExists);
    await oneTimePayments.start();
    assert(await identity.isDAOContract(oneTimePayments.address));
  });

  it("should not have payment", async () => {
    assert(!(await oneTimePayments.hasPayment(DEPOSIT_CODE_HASH)));
  });

  it("should only allow token to deposit", async () => {
    helpers.assertVMException(
      oneTimePayments.onTokenTransfer(
        whitelisted,
        helpers.toGD("5"),
        DEPOSIT_CODE_HASH,
        { from: whitelisted }
      ),
      "Only callable by this"
    );
  });

  it("should deposit successfully", async () => {
    await token.transfer(whitelisted, helpers.toGD("300"));

    await token.transferAndCall(
      oneTimePayments.address,
      helpers.toGD("5"),
      DEPOSIT_CODE_HASH,
      { from: whitelisted }
    );

    assert(await oneTimePayments.hasPayment(DEPOSIT_CODE_HASH));
  });

  it("should not allow to deposit to same hash", async () => {
    await helpers.assertVMException(
      token.transferAndCall(
        oneTimePayments.address,
        helpers.toGD("5"),
        DEPOSIT_CODE_HASH,
        { from: whitelisted }
      ),
      "Hash already in use"
    );
  });

  it("should have payment", async () => {
    assert(await oneTimePayments.hasPayment(DEPOSIT_CODE_HASH));
  });

  it("should not withdraw due to gas limit", async () => {
    await helpers.assertVMException(
      oneTimePayments.withdraw(DEPOSIT_CODE, { gas: GASLIMIT + 100000 }),
      "Cannot exceed gas limit"
    );
  });

  it("should withdraw successfully", async () => {
    await oneTimePayments.withdraw(DEPOSIT_CODE, {
      gas: GASLIMIT,
      from: whitelisted
    });

    assert(!(await oneTimePayments.hasPayment(DEPOSIT_CODE_HASH)));
  });

  it("should not allow withdraw from unused link", async () => {
    await helpers.assertVMException(
      oneTimePayments.withdraw("test2", { gas: GASLIMIT }),
      "Hash not in use"
    );
  });

  it("should not allow to withdraw from already withdrawn", async () => {
    await helpers.assertVMException(
      oneTimePayments.withdraw(DEPOSIT_CODE, { gas: GASLIMIT }),
      "Hash not in use"
    );
  });

  it("should only allow creator of deposit to cancel", async () => {
    await token.transfer(whitelisted, helpers.toGD("300"));

    await token.transferAndCall(
      oneTimePayments.address,
      helpers.toGD("5"),
      DEPOSIT_CODE_HASH,
      { from: whitelisted }
    );

    assert(await oneTimePayments.hasPayment(DEPOSIT_CODE_HASH));

    await helpers.assertVMException(
      oneTimePayments.cancel(DEPOSIT_CODE_HASH, {
        gas: GASLIMIT,
        from: founder
      }),
      "Can only be called by creator"
    );

    await oneTimePayments.cancel(DEPOSIT_CODE_HASH, {
      from: whitelisted
    });

    //await helpers.assertVMException(oneTimePayments.withdraw(DEPOSIT_CODE, { gas: 590000}), "Hash not in use");
  });

  it("should propose to unregister One-Time payment scheme", async () => {
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeToRemoveScheme(
      avatar.address,
      oneTimePayments.address,
      helpers.NULL_HASH
    );

    proposalId = transaction.logs[0].args._proposalId;
  });

  it("should correctly unregister One-Time payment scheme", async () => {
    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const excecuteProposalEventExists = voteResult.logs.some(
      e => e.event === "ExecuteProposal"
    );

    assert(excecuteProposalEventExists);
  });

  it("should not allow One-Time payments after registering", async () => {
    await token.transfer(whitelisted, helpers.toGD("10"));

    await helpers.assertVMException(
      token.transferAndCall(
        oneTimePayments.address,
        helpers.toGD("5"),
        DEPOSIT_CODE_HASH,
        { from: whitelisted }
      ),
      "Scheme is not registered"
    );
  });

  it("should remove oneTimePayments from whitelisted without decrementing amount of whitelisted non contracts", async () => {
    const oldWhitelistedNonContracts = await identity.getWhitelistedNonContracts();

    await identity.removeWhitelisted(oneTimePayments.address);

    const newWhitelistedNonContracts = await identity.getWhitelistedNonContracts();

    expect(oldWhitelistedNonContracts.toString()).to.be.equal(
           newWhitelistedNonContracts.toString()
    );

  });
});

export {};
