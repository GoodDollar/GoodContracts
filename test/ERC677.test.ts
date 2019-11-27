import * as helpers from './helpers';

const Identity = artifacts.require("Identity");
const Avatar = artifacts.require("Avatar");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const BridgeMock = artifacts.require("BridgeMock");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AddMinter = artifacts.require("AddMinter");

contract("ERC677 token", ([founder, whitelisted]) => {

	let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
	let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
	let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
	let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
	let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
	let addMinter: helpers.ThenArg<ReturnType<typeof AddMinter['new']>>;
	let bridgeMock: helpers.ThenArg<ReturnType<typeof BridgeMock['new']>>;

	let proposalId: string;

	before(async () => {
		avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
		controller = await ControllerInterface.at(await avatar.owner());
		absoluteVote = await AbsoluteVote.deployed();
		token = await GoodDollar.at(await avatar.nativeToken());
		addMinter = await AddMinter.new(avatar.address, founder);
		bridgeMock = await BridgeMock.new();

		// Propose it
		const schemeRegistrar = await SchemeRegistrar.deployed();
		const transaction = await schemeRegistrar.proposeScheme(avatar.address, addMinter.address, 
		  helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

		proposalId = transaction.logs[0].args._proposalId;

		const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
		const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

		// Verifies that the ExecuteProposal event has been emitted
		assert(executeProposalEventExists);
		addMinter.addMinter();
	})

	it("Should not allow setting non contract as bridge contract", async () => {
		await helpers.assertVMException(token.setBridgeContract(whitelisted, { from: founder }), "Invalid bridge contract");
	});

	it("Should allow setting contract as bridge contract", async () => {
		await token.setBridgeContract(bridgeMock.address, { from: founder });
	})
})