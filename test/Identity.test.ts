import * as helpers from'./helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");

contract("Identity - Whitelist and Claimer", ([founder, whitelisted, nonwhitelisted]) => {

    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;

    before(async () => {
        identity = await Identity.deployed();
        avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
        token = await GoodDollar.at(await avatar.nativeToken());
        await identity.addIdentity(whitelisted, true);
    });

    it("should whitelist non-whitelisted and add to claimers", async() => {
        await identity.addIdentity(nonwhitelisted, true);

        assert(identity.isWhitelisted(nonwhitelisted));
        assert(identity.isClaimer(nonwhitelisted));

        await identity.removeIdentity(nonwhitelisted);
    })

    it("should whitelist non-whitelisted without adding to claimers", async() => {
        await identity.addIdentity(nonwhitelisted, false);

        assert(identity.isWhitelisted(nonwhitelisted));
        expect(await identity.isClaimer(nonwhitelisted)).to.be.false;

        await identity.removeIdentity(nonwhitelisted);
    })

    it("should increment claimers when adding identity", async() => {
        let oldClaimerCount = await identity.getClaimerCount();
        expect(oldClaimerCount.toString()).to.be.equal('2');

        await identity.addIdentity(nonwhitelisted, true);

        let newClaimerCount = await identity.getClaimerCount();
        expect(newClaimerCount.toString()).to.be.equal('3');

        await identity.removeIdentity(nonwhitelisted);
    });

    it("should decrement claimers when removing identity", async() => {
        let oldClaimerCount = await identity.getClaimerCount();
        expect(oldClaimerCount.toString()).to.be.equal('2');
        await identity.removeIdentity(whitelisted);

        let newClaimerCount = await identity.getClaimerCount();
        expect(newClaimerCount.toString()).to.be.equal('1');
        await identity.addIdentity(whitelisted, true);
    });

    it("should revert when sending from whitelisted to non-whitelisted", async () => {
        await token.transfer(whitelisted, web3.utils.toWei("10"));
        
        await helpers.assertVMException(
            token.transfer(nonwhitelisted, web3.utils.toWei("1"), {from: whitelisted}),
            "Is not whitelisted"
        );
    });

    it("should revert when non admin tries to whitelist", async () => {
        await helpers.assertVMException(
            identity.addIdentity(nonwhitelisted, true, {from: whitelisted}),
            "not IdentityAdmin"
        );
    });

    it("should revert when adding to whitelist twice", async() => {
        await helpers.assertVMException(
          identity.addIdentity(whitelisted, true),
          "VM Exception"
        );
    })

    it("should not increment claimers when whitelisting reverts", async() => {
        await identity.addIdentity(nonwhitelisted, true);

        let claimerCount = await identity.getClaimerCount();

        await helpers.assertVMException(
          identity.addIdentity(nonwhitelisted, true),
          "VM Exception"
        );

        let claimerCountnew = await identity.getClaimerCount();
        expect(claimerCountnew.toString()).to.be.equal(claimerCount.toString());

        await identity.removeIdentity(nonwhitelisted);
    });

});

// Important see: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}