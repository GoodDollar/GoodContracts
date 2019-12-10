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

const GASLIMIT = settings["test"].gasLimit;

contract("Integration - One-Time Payments", ([
  founder, whitelisted, whitelisted2, 
  PAYMENT_ID, WRONG_PAYMENT_ID
]) => {

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

  const createPaymentSignature = async (address: string, signer: string) => {
    const message = web3.utils.sha3(address);
    return fixSignature(await web3.eth.sign(message, signer));
  }

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
      identity.address
    );

    await identity.addWhitelisted(whitelisted);
    await identity.addWhitelisted(whitelisted2);
  });

  it("should not allow One-Time payments before registering", async () => {
    await token.transfer(whitelisted, helpers.toGD("10"));

    await helpers.assertVMException(
      token.transferAndCall(
        oneTimePayments.address,
        helpers.toGD("5"),
        PAYMENT_ID,
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
    assert(!(await oneTimePayments.hasPayment(PAYMENT_ID)));
  });

  it("should only allow token to deposit", async () => {
    helpers.assertVMException(
      oneTimePayments.onTokenTransfer(
        whitelisted,
        helpers.toGD("5"),
        web3.eth.abi.encodeParameter('address', PAYMENT_ID),
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
      web3.eth.abi.encodeParameter('address', PAYMENT_ID),
      { from: whitelisted }
    );

    assert(await oneTimePayments.hasPayment(PAYMENT_ID));
  });

  it("should not allow to deposit to same hash", async () => {
    await helpers.assertVMException(
      token.transferAndCall(
        oneTimePayments.address,
        helpers.toGD("5"),
        web3.eth.abi.encodeParameter('address', PAYMENT_ID),
        { from: whitelisted }
      ),
      "paymentId already in use"
    );
  });

  it("should have payment", async () => {
    assert(await oneTimePayments.hasPayment(PAYMENT_ID));
  });

  it("should not withdraw with wrong signature", async () => {
    const signature = await createPaymentSignature(whitelisted2, WRONG_PAYMENT_ID);

    await helpers.assertVMException(
      oneTimePayments.withdraw(PAYMENT_ID, signature, { from: whitelisted2 }),
      "Signature is not correct"
    );
  });

  it("should withdraw successfully", async () => {
    const signature = await createPaymentSignature(whitelisted2, PAYMENT_ID);
    await oneTimePayments.withdraw(PAYMENT_ID, signature, { from: whitelisted2 });

    assert(!(await oneTimePayments.hasPayment(PAYMENT_ID)));
  });

  it("should not allow withdraw from unused link", async () => {
    const signature = await createPaymentSignature(whitelisted2, WRONG_PAYMENT_ID);

    await helpers.assertVMException(
      oneTimePayments.withdraw(WRONG_PAYMENT_ID, signature, { from: whitelisted2 }),
      "paymentId not in use"
    );
  });

  it("should not allow to withdraw from already withdrawn", async () => {
    const signature = await createPaymentSignature(whitelisted2, PAYMENT_ID);

    await helpers.assertVMException(
      oneTimePayments.withdraw(PAYMENT_ID, signature, { from: whitelisted2 }),
      "paymentId not in use"
    );
  });

  it("should only allow creator of deposit to cancel", async () => {
    await token.transfer(whitelisted, helpers.toGD("300"));

    await token.transferAndCall(
      oneTimePayments.address,
      helpers.toGD("5"),
      web3.eth.abi.encodeParameter('address', PAYMENT_ID),
      { from: whitelisted }
    );

    assert(await oneTimePayments.hasPayment(PAYMENT_ID));

    await helpers.assertVMException(
      oneTimePayments.cancel(PAYMENT_ID, { from: founder }),
      "Can only be called by creator"
    );

    await oneTimePayments.cancel(PAYMENT_ID, { from: whitelisted });

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
        web3.eth.abi.encodeParameter('address', PAYMENT_ID),
        { from: whitelisted }
      ),
      "Scheme is not registered"
    );
  });

  it("should remove oneTimePayments from whitelisted without decrementing amount of whitelisted non contracts", async () => {
    const oldWhitelisted = await identity.whitelistedCount() as any;
    const oldWhitelistedContracts = await identity.whitelistedContracts() as any;

    const oldWhitelistedNonContracts = oldWhitelisted.sub(oldWhitelistedContracts);

    await identity.removeWhitelisted(oneTimePayments.address);

    const newWhitelisted = await identity.whitelistedCount() as any;
    const newWhitelistedContracts = await identity.whitelistedContracts() as any;

    const newWhitelistedNonContracts = newWhitelisted.sub(newWhitelistedContracts);

    expect(oldWhitelistedNonContracts.toString()).to.be.equal(
           newWhitelistedNonContracts.toString()
    );

  });
});

/* Taken from https://github.com/OpenZeppelin/openzeppelin-contracts/blob/5f92adc2e/test/helpers/sign.js */
function fixSignature (signature) {
  // in geth its always 27/28, in ganache its 0/1. Change to 27/28 to prevent
  // signature malleability if version is 0/1
  // see https://github.com/ethereum/go-ethereum/blob/v1.8.23/internal/ethapi/api.go#L465
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) {
    v += 27;
  }
  const vHex = v.toString(16);
  return signature.slice(0, 130) + vHex;
}

export {};
