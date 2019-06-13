import * as helpers from'./helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");

contract("Identity - Blacklist and Claimer", ([founder, blacklisted, claimer, outsider]) => {

    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;

    before(async () => {
        identity = await Identity.deployed();
        avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
        token = await GoodDollar.at(await avatar.nativeToken());
    });

    it("should blacklist addreess", async () => {
        await identity.addBlacklisted(blacklisted);
        assert(await identity.isBlacklisted(blacklisted));

        await identity.removeBlacklisted(blacklisted);
        assert(!(await identity.isBlacklisted(blacklisted)));
    });

    it("should add and remove claimer", async () => {
        await identity.addClaimer(claimer);
        assert(await identity.isClaimer(claimer));

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

});

// Important see: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}