import * as helpers from'./helpers';

const Identity = artifacts.require("Identity");
const IdentityMock = artifacts.require("IdentityMock");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const IdentityGuardMock = artifacts.require("IdentityGuardMock");
const IdentityGuardFailMock = artifacts.require("IdentityGuardFailMock");

contract("Identity - Blacklist and Claimer", ([founder, blacklisted, blacklisted2, claimer, outsider]) => {

    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let dangerIdentity: helpers.ThenArg<ReturnType<typeof IdentityMock['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
    let mock: helpers.ThenArg<ReturnType <typeof IdentityGuardMock['new']>>;

    before(async () => {
        identity = await Identity.deployed();
        dangerIdentity = await IdentityMock.new();

        avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
        token = await GoodDollar.at(await avatar.nativeToken());

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

    it("should add identity admin", async () => {
        await identity.addIdentityAdmin(outsider);
    });

    it("should remove identity admin", async () => {
        await identity.removeIdentityAdmin(outsider);
    });

    it("should not remove identity admin twice", async () => {
        await helpers.assertVMException(identity.removeIdentityAdmin(outsider), "not IdentityAdmin");
    });

    it("should renounce identity admin", async () => {
        await identity.addIdentityAdmin(outsider);
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

    it("should not allow non-registered identity contract", async () => {
        await helpers.assertVMException(token.setIdentity(dangerIdentity.address), "Scheme is not registered");
        dangerIdentity = await Identity.new();
    });


    it("should allow to set registered identity", async () => {
        assert(await token.setIdentity(identity.address));
    });

});

// Important see: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}