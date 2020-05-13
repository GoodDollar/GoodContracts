import * as helpers from "./helpers";

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const FeeFormula = artifacts.require("FeeFormula");
const FormulaHolder = artifacts.require("FormulaHolder");
const FormulaHolderMock = artifacts.require("FormulaHolderMock");

contract("FeeFormula - setting transaction fees", ([founder, stranger]) => {
  let identity: helpers.ThenArg<ReturnType<typeof Identity["new"]>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar["new"]>>;
  let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote["new"]>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar["new"]>>;
  let feeFormula: helpers.ThenArg<ReturnType<typeof FeeFormula["new"]>>;
  let newFormula: helpers.ThenArg<ReturnType<typeof FeeFormula["new"]>>;
  let feeGuard: helpers.ThenArg<ReturnType<typeof FormulaHolder["new"]>>;

  let proposalId: string;

  before(async () => {
    identity = await Identity.deployed();
    avatar = await Avatar.at(
      await (await DaoCreatorGoodDollar.deployed()).avatar()
    );
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());
    feeFormula = await FeeFormula.deployed();
    newFormula = await FeeFormula.new(0);
    feeGuard = await FormulaHolderMock.new(feeFormula.address, {
      from: founder
    });
  });

  it("should not allow FormulaHolder with null formula", async () => {
    await helpers.assertVMException(
      FormulaHolderMock.new(helpers.NULL_ADDRESS),
      "Supplied formula is null"
    );
  });

  it("should not allow Fee formula with too high percentage", async () => {
    await helpers.assertVMException(
      FeeFormula.new(110),
      "Percentage should be <100"
    );
  });

  it("should be allowed to register new formula", async () => {
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeScheme(
      avatar.address,
      newFormula.address,
      helpers.NULL_HASH,
      "0x00000010",
      helpers.NULL_HASH
    );

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(
      e => e.event === "ExecuteProposal"
    );

    assert(executeProposalEventExists);

    await newFormula.setAvatar(avatar.address);
  });

  it("should not allow stranger to change formula", async () => {
    await helpers.assertVMRevert(
      feeGuard.setFormula(newFormula.address, { from: stranger })
    );
  });

  it("should allow owner to set new formula", async () => {
    assert(await feeGuard.setFormula(newFormula.address, { from: founder }));
  });

  it("should have support 0 tx fee", async () => {
    expect(
      (await newFormula
        .getTxFees(1000, founder, stranger)
        .then(_ => _[0])).toNumber()
    ).to.be.equal(0);
  });

  it("should calculate tx fee correctly", async () => {
    expect(
      (await feeFormula
        .getTxFees(1000, stranger, founder)
        .then(_ => _[0])).toNumber()
    ).to.be.equal(10);
    expect(
      (await feeFormula
        .getTxFees(50, stranger, founder)
        .then(_ => _[0])).toNumber()
    ).to.be.equal(0);
  });

  it("should calculate tx fee correctly with sender and recipient", async () => {
    expect(
      (await feeFormula
        .getTxFees(1000, founder, stranger)
        .then(_ => _[0])).toNumber()
    ).to.be.equal(10);
    expect(
      (await feeFormula
        .getTxFees(50, founder, stranger)
        .then(_ => _[0])).toNumber()
    ).to.be.equal(0);
  });
});
