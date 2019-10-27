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
    feeGuard = await FormulaHolder.new(feeFormula.address, { from: founder });
  });

	before(async () => {
		identity = await Identity.deployed();
		avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
		absoluteVote = await AbsoluteVote.deployed();
		token = await GoodDollar.at(await avatar.nativeToken());
		feeFormula = await FeeFormula.deployed();
		newFormula = await FeeFormula.new();
		feeGuard = await FormulaHolderMock.new(feeFormula.address, { from: founder });
	});

	it("should not allow FormulaHolder with null formula", async () => {
		await helpers.assertVMException(FormulaHolderMock.new(helpers.NULL_ADDRESS), "Supplied formula is null");
	});

    proposalId = transaction.logs[0].args._proposalId;

    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(
      e => e.event === "ExecuteProposal"
    );

    assert(executeProposalEventExists);

    await newFormula.setAvatar(avatar.address);
  });

  it("should not allow stranger to change formula", async () => {
    await helpers.assertVMException(
      feeGuard.setFormula(newFormula.address, avatar.address, {
        from: stranger
      }),
      "Only callable by avatar of owner or owner"
    );
  });

	it("should not allow stranger to change formula", async () => {
		await helpers.assertVMRevert(
			feeGuard.setFormula(newFormula.address, { from: stranger })
		);
	});

	it("should allow owner to set new formula", async () => {
		assert(await feeGuard.setFormula(newFormula.address, { from: founder }));
	});
});
