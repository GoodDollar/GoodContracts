import * as helpers from'./helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const ControllerCreatorGoodDollar = artifacts.require('./ControllerCreatorGoodDollar.sol');
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");

const tokenName = "GoodDollar";
const tokenSymbol = "GDD";
const cap = web3.utils.toWei("100000000","ether");

const initFee = web3.utils.toWei("0.0001");
const initRep = web3.utils.toWei("10");
const zeroRep = web3.utils.toWei("0");
const initRepInWei = [initRep];
const initToken = web3.utils.toWei("1000");
const zeroToken = web3.utils.toWei("0");
const initTokenInWei = [initToken];

contract("Dao - Forging organizations, adding founders", ([founder, joiner, stranger]) => {
    
    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
    let controllerCreator: helpers.ThenArg<ReturnType<typeof ControllerCreatorGoodDollar['new']>>;
    let daoCreator: helpers.ThenArg<ReturnType<typeof DaoCreatorGoodDollar['new']>>;
    let newDaoCreator: helpers.ThenArg<ReturnType<typeof DaoCreatorGoodDollar['new']>>;

    before(async () => {
        controllerCreator = await ControllerCreatorGoodDollar.deployed();
        daoCreator = await DaoCreatorGoodDollar.deployed();
        newDaoCreator = await DaoCreatorGoodDollar.new(controllerCreator.address);
        avatar = await Avatar.at(await daoCreator.avatar());
        identity = await Identity.deployed();
    });

    it("should not allow to forge organizations twice", async () => {
        await newDaoCreator.forgeOrg(
            tokenName, tokenSymbol, cap, initFee, identity.address,
            [founder], [zeroToken], [zeroRep]);

        await helpers.assertVMException(
            newDaoCreator.forgeOrg(
                tokenName, tokenSymbol, cap, initFee,
                identity.address, [founder], [zeroToken], [zeroRep]
            ),
            "Lock already exists"
        );
    });

    it("should not allow stranger to set schemes", async () => {
        const schemesArray = [identity.address];
        const paramsArray = [helpers.NULL_HASH];
        const permissionArray = ['0x0000001F'];

        await helpers.assertVMException(
            newDaoCreator.setSchemes(
                avatar.address, schemesArray, paramsArray,
                permissionArray, "metaData", { from: stranger })
            , "Message sender is not lock"
        );
    })

    it("should not allow zero address founder", async () => {
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

});

export {}