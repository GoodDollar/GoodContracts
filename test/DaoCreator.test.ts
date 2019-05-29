import * as helpers from'./helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");

const tokenName = "GoodDollar";
const tokenSymbol = "GDD";
const cap = web3.utils.toWei("100000000","ether");

const initFee = web3.utils.toWei("0.0001");
const initRep = web3.utils.toWei("10");
const initRepInWei = [initRep];
const initToken = web3.utils.toWei("1000");
const initTokenInWei = [initToken];

contract("Dao - Forging organizations, adding founders", ([founder, stranger]) => {
    
    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>
    let daoCreator: helpers.ThenArg<ReturnType<typeof DaoCreatorGoodDollar['new']>>;

    before(async () => {
        daoCreator = await DaoCreatorGoodDollar.deployed();
        avatar = await Avatar.at(await daoCreator.avatar());
        identity = await Identity.deployed();
    });

    it("should not allow zero address to forge org", async () => {
        await helpers.assertVMException(
            daoCreator.forgeOrg(
                tokenName, tokenSymbol, cap, initFee, identity.address,
                [helpers.NULL_ADDRESS], initTokenInWei, initRepInWei
            ),
            "Founder cannot be zero address"
        );
    });

    it("should not allow founders without reputation to forge org", async () => {
        await helpers.assertVMException(
            daoCreator.forgeOrg(
                tokenName, tokenSymbol, cap, initFee, identity.address,
                [founder], initTokenInWei, []
            ),
            "Founder reputation missing"
        );
    });

    it("should not allow founders without tokens to forge org", async () =>{
        await helpers.assertVMException(
            daoCreator.forgeOrg(
                tokenName, tokenSymbol, cap, initFee, identity.address,
                [founder], [], initRepInWei
            ),
            "Not enough founder tokens"
        );
    });

    it("should not allow sender to forge org without founders", async () => {
        await helpers.assertVMException(
            daoCreator.forgeOrg(
                tokenName, tokenSymbol, cap, initFee, identity.address,
                [], [], []
            ),
            "Must have at least one founder"
        );
    });

    it("should not mint reputation or tokens to zero address founder", async () => {
        const newfounders = [founder, helpers.NULL_ADDRESS];
        const newTokeninWei = [initToken, initToken];
        const newRepinWei = [initRep, initRep];

        await helpers.assertVMException(
            daoCreator.forgeOrg(
                tokenName, tokenSymbol, cap, initFee, identity.address,
                newfounders, newTokeninWei, newRepinWei
            ),
            "Founder cannot be zero address"
        );
    });

    it("should only allow lock address to add Founders", async () => {

        await daoCreator.forgeOrg(
            tokenName, tokenSymbol, cap, initFee, identity.address,
            [founder], initTokenInWei, initRepInWei, {from: founder}
        );

        await helpers.assertVMException(
            daoCreator.addFounders(
                avatar.address, [stranger], 
                initTokenInWei, initRepInWei, {from: stranger}
            ),
            "Message sender is not lock"
        );   
    });

    it("should only be able to add founders with corresponding tokens", async () => {
        await helpers.assertVMException(
            daoCreator.addFounders(
                avatar.address, [stranger], 
                [], initRepInWei
            ),
            "Not enough founder tokens"
        );   
    });

    it("should only be able to add founders with corresponding reputation", async () => {
        await helpers.assertVMException(
            daoCreator.addFounders(
                avatar.address, [stranger], 
                initTokenInWei, []
            ),
            "Founder reputation missing"
        );   
    });

    it("should not be able to add empty list of founders", async () => {
        await helpers.assertVMException(
            daoCreator.addFounders(
                avatar.address, [], 
                [], []
            ),
            "Must have at least one founder"
        );   
    });
});

export {}