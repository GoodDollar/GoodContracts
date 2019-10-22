import * as helpers from './helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const ReserveMinter = artifacts.require("ReserveMinter");

contract("ReserveMinter - Minting to reserve", ([founder, whitelisted, receiver]) => {

	let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
	let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
	let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
	let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
	let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
	let reserveMinter: helpers.ThenArg<ReturnType<typeof ReserveMinter['new']>>;

	let proposalId: string;

	const periodOffset = 60000;

	before(async () => {
		const periodStart = (await web3.eth.getBlock('latest')).timestamp + periodOffset;
		const periodEnd = periodStart + periodOffset;

		identity = await Identity.deployed();
		avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
		controller = await ControllerInterface.at(await avatar.owner());
		absoluteVote = await AbsoluteVote.deployed();
		token = await GoodDollar.at(await avatar.nativeToken());
		reserveMinter = await ReserveMinter.new(avatar.address, helpers.toGD("10"), receiver);
		await identity.addWhitelisted(whitelisted);
	});

	it("should not allow relayer with null address receiver", async () => {
		const periodStart = (await web3.eth.getBlock('latest')).timestamp + periodOffset;
		const periodEnd = periodStart + periodOffset;
		helpers.assertVMException(ReserveMinter.new(avatar.address, helpers.toGD("10"), helpers.NULL_ADDRESS), "receiver cannot be null address");
	});

	it("should correctly propose ReserveMinter scheme", async () => {
		const schemeRegistrar = await SchemeRegistrar.deployed();
		const transaction = await schemeRegistrar.proposeScheme(avatar.address, reserveMinter.address,
			helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

		proposalId = transaction.logs[0].args._proposalId;
	});

	it("should correctly register ReserveMinter scheme", async () => {
		const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
		const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

		assert(executeProposalEventExists);
	});

	it("should start, mint to receiver and then end", async () => {
		const oldBalance = await token.balanceOf(receiver);
		expect(oldBalance.toString()).to.be.equal("0");

		const reserve = (await token.balanceOf(avatar.address)) as any;
		
		assert(await reserveMinter.start());

		const newBalance = await token.balanceOf(receiver);

		expect(newBalance.toString()).to.be.equal((helpers.toGD("10")).toString());
	});
})