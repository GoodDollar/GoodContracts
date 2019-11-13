import * as helpers from './helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const FeeFormula = artifacts.require("FeeFormula");

contract("Ownership - transferring ownership to controller", ([founder]) => {

	let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
	let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
	let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
	let feeFormula: helpers.ThenArg<ReturnType<typeof FeeFormula['new']>>;
	let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;

	let proposalId: string;

	before(async () => {
		avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
		controller = await ControllerInterface.at(await avatar.owner());
		token = await GoodDollar.at(await avatar.nativeToken());
		feeFormula = await FeeFormula.deployed();
		identity = await Identity.deployed();
	});

	it("fee formula should have proper owner", async () => {
		const formulaOwner = await feeFormula.owner();
		expect(formulaOwner).to.be.equal(avatar.address);
	})

	it("identity should have proper owner", async () => {
		const identityOwner = await identity.owner();
		expect(identityOwner).to.be.equal(avatar.address);
	});
});