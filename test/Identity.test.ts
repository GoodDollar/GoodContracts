import * as helpers from'./helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const IdentityGuard = artifacts.require("IdentityGuard");
const IdentityGuardMock = artifacts.require("IdentityGuardMock");
const IdentityGuardFailMock = artifacts.require("IdentityGuardFailMock");
const AddAdmin = artifacts.require("AddAdmin");
const RemoveAdmin = artifacts.require("RemoveAdmin");

contract("Identity - Blacklist and Claimer", ([founder, blacklisted, blacklisted2, claimer, outsider]) => {

    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let dangerIdentity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
    let identityGuard: helpers.ThenArg<ReturnType<typeof IdentityGuard['new']>>;
    let mock: helpers.ThenArg<ReturnType <typeof IdentityGuardMock['new']>>;
    let addAdmin: helpers.ThenArg<ReturnType <typeof AddAdmin['new']>>;
    let addAdmin2: helpers.ThenArg<ReturnType <typeof AddAdmin['new']>>;
    let removeAdmin: helpers.ThenArg<ReturnType <typeof RemoveAdmin['new']>>;

    let proposalId: string;

    before(async () => {
        identity = await Identity.deployed();
        dangerIdentity = await Identity.new();

        avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
        token = await GoodDollar.at(await avatar.nativeToken());
        absoluteVote = await AbsoluteVote.deployed();

        identityGuard = await IdentityGuard.new(dangerIdentity.address);
        await helpers.assertVMException(IdentityGuardFailMock.new(), "Supplied identity is null");
        mock = await IdentityGuardMock.new(identity.address);
    });

    it("should set avatar", async () => {
        await helpers.assertVMRevert(dangerIdentity.isRegistered());
        await dangerIdentity.setAvatar(avatar.address);
    })

    it("should blacklist addreess", async () => {
        await identity.addBlacklisted(blacklisted);
        assert(await identity.isBlacklisted(blacklisted));

        await identity.removeBlacklisted(blacklisted);
        assert(!(await identity.isBlacklisted(blacklisted)));
    });

    it("should check blacklisted", async () => {
        assert(await mock.blacklistMock(blacklisted));
        await identity.addBlacklisted(blacklisted);

        await helpers.assertVMException(mock.blacklistMock(blacklisted), "Receiver is blacklisted");
        await helpers.assertVMException(mock.blacklistMock(founder, { from : blacklisted }), "Caller is blacklisted");

        await identity.addBlacklisted(blacklisted2);

        await helpers.assertVMException(mock.blacklistMock(blacklisted2, { from : blacklisted }), "Caller is blacklisted");
        await identity.removeBlacklisted(blacklisted);        
    });

    it("should add, check and remove claimer", async () => {
        await helpers.assertVMException(mock.checkClaimer(claimer), "is not claimer");

        await identity.addClaimer(claimer);
        assert(await identity.isClaimer(claimer));

        assert(await mock.checkClaimer(claimer));

        await identity.removeClaimer(claimer);
        assert(!(await identity.isClaimer(claimer)));
    });

    it("should increment and decrement claimers when adding claimer", async () => {
        const oldClaimerCount = await identity.getClaimerCount();

        await identity.addClaimer(claimer);

        const diffClaimerCount = ((await identity.getClaimerCount()) as any).sub(oldClaimerCount);
        expect(diffClaimerCount.toString()).to.be.equal('1');

        await identity.removeClaimer(claimer);

        const claimerCount = (await identity.getClaimerCount());
        expect(claimerCount.toString()).to.be.equal(oldClaimerCount.toString());

    });

    it("should revert when non admin tries to add claimer", async () => {
        await helpers.assertVMException(
            identity.addClaimer(claimer, {from: outsider}),
            "not IdentityAdmin"
        );
    });

    it("should revert when non admin tries to add blacklist", async () => {
        await helpers.assertVMException(
            identity.addBlacklisted(blacklisted, {from: outsider}),
            "not IdentityAdmin"
        );
    });

    it("should not be able to add zero address as identity admin", async() => {
        helpers.assertVMException(
            AddAdmin.new(
                avatar.address,
                identity.address,
                helpers.NULL_ADDRESS
            ),
            "admin cannot be null address"
        );
    })

    it("should add identity admin", async () => {
        addAdmin = await AddAdmin.new(
            avatar.address,
            identity.address,
            outsider
        );

        const schemeRegistrar = await SchemeRegistrar.deployed();
        let transaction = await schemeRegistrar.proposeScheme(avatar.address, addAdmin.address, 
          helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

        proposalId = transaction.logs[0].args._proposalId;

        const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
        const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

        // Verifies that the ExecuteProposal event has been emitted
        assert(executeProposalEventExists);

        await addAdmin.transferOwnership(await avatar.owner());
        await addAdmin.start();

        expect(await identity.isIdentityAdmin(outsider)).to.be.equal(true);
    });

    it("should remove identity admin", async () => {
        removeAdmin = await RemoveAdmin.new(
            avatar.address,
            identity.address,
            outsider,
            );

        const schemeRegistrar = await SchemeRegistrar.deployed();
        let transaction = await schemeRegistrar.proposeScheme(avatar.address, removeAdmin.address,
            helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

        proposalId = transaction.logs[0].args._proposalId;

        const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
        const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');
        assert(executeProposalEventExists);

        await removeAdmin.transferOwnership(await avatar.owner());
        await removeAdmin.start();

        expect(await identity.isIdentityAdmin(outsider)).to.be.equal(false);
    });

    it("should not remove identity admin twice", async () => {
        await helpers.assertVMException(
            RemoveAdmin.new(
                avatar.address,
                identity.address,
                outsider
            ),
            "Given address is not admin"
        );
    });

    it("should renounce identity admin", async () => {
        addAdmin2 = await AddAdmin.new(
            avatar.address,
            identity.address,
            outsider
        );

        const schemeRegistrar = await SchemeRegistrar.deployed();
        let transaction = await schemeRegistrar.proposeScheme(avatar.address, addAdmin2.address, 
          helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

        proposalId = transaction.logs[0].args._proposalId;

        const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
        const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

        // Verifies that the ExecuteProposal event has been emitted
        assert(executeProposalEventExists);
        
        await addAdmin2.transferOwnership(await avatar.owner());
        await addAdmin2.start();

        expect(await identity.isIdentityAdmin(outsider)).to.be.equal(true);

        await identity.renounceIdentityAdmin( { from: outsider } )
    });

    it("should revert when adding to claimer twice", async () => {
        await identity.addClaimer(claimer);

        await helpers.assertVMException(
          identity.addClaimer(claimer),
          "VM Exception"
        );

        await identity.removeClaimer(claimer);
    });

    it("should revert when adding to blacklist twice", async () => {
        await identity.addBlacklisted(blacklisted);

        await helpers.assertVMException(
          identity.addBlacklisted(blacklisted),
          "VM Exception"
        );

        await identity.removeBlacklisted(blacklisted);
    })

    it("should not increment claimer counter when adding claimer", async () => {
        await identity.addClaimer(claimer);
        let claimerCount = await identity.getClaimerCount();

        await helpers.assertVMException(
          identity.addClaimer(claimer),
          "VM Exception"
        );

        let claimerCountNew = await identity.getClaimerCount();
        expect(claimerCountNew.toString()).to.be.equal(claimerCount.toString());

        await identity.removeClaimer(claimer);
    });

    it("should not allow setting non-registered identity contract", async () => {
        await helpers.assertVMException(identityGuard.setIdentity(dangerIdentity.address, avatar.address), "Scheme is not registered");
        dangerIdentity = await Identity.new();
    });

    it("should allow to set registered identity", async () => {
        assert(await identityGuard.setIdentity(identity.address, avatar.address));
    });
});

export {}