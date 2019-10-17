import * as helpers from'./helpers';

const Identity = artifacts.require("Identity");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const AdminWallet = artifacts.require("AdminWallet");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");

contract("AdminWallet", ([founder, whitelisted, stranger, blacklisted]) => {

    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
    let adminWallet: helpers.ThenArg<ReturnType<typeof AdminWallet['new']>>;

    let toppingAmount;
    let toppingTimes;

    before(async () => {

        identity = await Identity.deployed();
        adminWallet = await AdminWallet.deployed();

        avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
        token = await GoodDollar.at(await avatar.nativeToken());

        toppingAmount = await adminWallet.toppingAmount();
        toppingTimes = await adminWallet.toppingTimes();
    });

    it("should add single admin", async () => {
        await adminWallet.addAdmins([whitelisted]);
        assert(await adminWallet.isAdmin(whitelisted));
    })

    it("should remove single admin", async () => {
        await adminWallet.removeAdmins([whitelisted]);
        assert(!(await adminWallet.isAdmin(whitelisted)))
    })

    it("should allow admin to whitelist and remove whitelist", async () => {
        assert(!(await identity.isWhitelisted(whitelisted)))
        await adminWallet.whitelist(whitelisted);

        assert(await identity.isWhitelisted(whitelisted));
        await adminWallet.removeWhitelist(whitelisted);
        assert(!(await identity.isWhitelisted(whitelisted)))
    })

    it("should not allow non-admin to whitelist and remove whitelist", async () => {
        assert(!(await identity.isWhitelisted(whitelisted)));
        await helpers.assertVMException(
            adminWallet.whitelist(
                whitelisted, { from: stranger }),
                "Caller is not admin"
        )
        assert(!(await identity.isWhitelisted(whitelisted)));
        await adminWallet.whitelist(whitelisted);
        assert(await identity.isWhitelisted(whitelisted));
        await helpers.assertVMException(
            adminWallet.removeWhitelist(
                whitelisted, { from: stranger }),
                "Caller is not admin"
        )
        assert(await identity.isWhitelisted(whitelisted));
    })

    it("should allow admin to blacklist and remove blacklist", async () => {
        assert(!(await identity.isBlacklisted(blacklisted)))
        await adminWallet.blacklist(blacklisted);

        assert(await identity.isBlacklisted(blacklisted));
        await adminWallet.removeBlacklist(blacklisted);
        assert(!(await identity.isBlacklisted(blacklisted)))
    })

    it("should not allow non-admin to blacklist and remove blacklist", async () => {
        assert(!(await identity.isBlacklisted(blacklisted)));
        await helpers.assertVMException(
            adminWallet.blacklist(
                blacklisted, { from: stranger }),
                "Caller is not admin"
        )
        assert(!(await identity.isBlacklisted(blacklisted)));
        await adminWallet.blacklist(blacklisted);
        assert(await identity.isBlacklisted(blacklisted));
        await helpers.assertVMException(
            adminWallet.removeBlacklist(
                blacklisted, { from: stranger }),
                "Caller is not admin"
        )
        assert(await identity.isBlacklisted(blacklisted));
        await adminWallet.removeBlacklist(blacklisted);
        assert(!(await identity.isBlacklisted(blacklisted)))  
    })


    it("should fill wallet", async () => {
        const amount = toppingAmount*100;
        const oldbalance = await token.balanceOf(adminWallet.address)
        expect(oldbalance.toString()).to.be.equal('0');

        await token.transfer(adminWallet.address, amount);
        const newbalance = await token.balanceOf(adminWallet.address)
        expect(newbalance.toString()).to.be.equal('99000');
    })

    it("should not allow to top wallet more than the given times", async () => {

        await adminWallet.topWallet(whitelisted);
        await adminWallet.topWallet(whitelisted);
        await adminWallet.topWallet(whitelisted);

        await helpers.assertVMException(
            adminWallet.topWallet(whitelisted),
            "User wallet has been topped too many times today"
        )
    })
});

export {}