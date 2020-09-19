import * as helpers from './helpers';

const Identity = artifacts.require("Identity");
const FeeFormula = artifacts.require("FeeFormula");
const SenderFeeFormula = artifacts.require("SenderFeeFormula");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const ControllerInterface = artifacts.require("ControllerInterface");
const GoodDollar = artifacts.require("GoodDollar");
const TransferAndCallMock = artifacts.require("TransferAndCallMock");

contract("GoodDollar", ([founder, whitelisted, outsider]) => {

    let receiver: helpers.ThenArg<ReturnType<typeof TransferAndCallMock['new']>>;
    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let feeFormula: helpers.ThenArg<ReturnType<typeof FeeFormula['new']>>;
    let newFormula: helpers.ThenArg<ReturnType<typeof FeeFormula['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
    let newtoken: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
    let cappedToken: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
    let unCappedToken: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
    let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;

    before(async () => {
        receiver = await TransferAndCallMock.new();
        identity = await Identity.deployed();
        feeFormula = await FeeFormula.deployed();
        avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
        controller = await ControllerInterface.at(await avatar.owner());
        unCappedToken = await GoodDollar.new('Test', 'TDD', 0, feeFormula.address, identity.address, receiver.address)
        cappedToken = await GoodDollar.new('Test', 'TDD', helpers.toGD('10') , feeFormula.address, identity.address, receiver.address);
        token = await GoodDollar.at(await avatar.nativeToken());
        newFormula = await SenderFeeFormula.new(1);
        newtoken = await GoodDollar.new("gd","gd",1000000,newFormula.address,identity.address,avatar.address)
        newtoken.mint(whitelisted,helpers.toGD("300"))
        await token.transfer(whitelisted, helpers.toGD("300"));
        await token.transfer(founder, helpers.toGD("100"));
        await token.transfer(outsider, helpers.toGD("10"));
        await identity.addWhitelisted(whitelisted);
        await identity.addWhitelisted(outsider);
    });

    it("transfer from minter()", async () => {
        const oldBalance = await token.balanceOf(whitelisted);
        const oldEarnings = await token.earnings(whitelisted);
        await token.transfer(whitelisted, helpers.toGD("300"));
        const newBalance = (await token.balanceOf(whitelisted)) as any;
        const newEarnings = (await token.earnings(whitelisted)) as any;
        const balanceDiff = (new (web3 as any).utils.BN(newBalance)).sub((new (web3 as any).utils.BN(oldBalance)));
        const earningsDiff = (new (web3 as any).utils.BN(newEarnings)).sub((new (web3 as any).utils.BN(oldEarnings)));

        expect(earningsDiff.toString()).to.be.equal(balanceDiff.toString());
    });

    it("transferAndCall not from minter()", async () => {
        let data = "0x0";

        const oldEarnings = await token.earnings(whitelisted);
        await token.transferAndCall(whitelisted, helpers.toGD("0.1"), data, { from: outsider });
        const newEarnings = (await token.earnings(whitelisted)) as any;
        const earningsDiff = newEarnings.sub(oldEarnings);

        expect(earningsDiff.toString()).to.be.equal("0");
    });

    it("transferAndCall from minter()", async () => {
        let data = "0x0";

        const oldBalance = await token.balanceOf(whitelisted);
        const oldEarnings = await token.earnings(whitelisted);
        await token.transferAndCall(whitelisted, helpers.toGD("300"), data);
        const newBalance = (await token.balanceOf(whitelisted)) as any;
        const newEarnings = (await token.earnings(whitelisted)) as any;
        const balanceDiff = (new (web3 as any).utils.BN(newBalance)).sub((new (web3 as any).utils.BN(oldBalance)));
        const earningsDiff = (new (web3 as any).utils.BN(newEarnings)).sub((new (web3 as any).utils.BN(oldEarnings)));

        expect(earningsDiff.toString()).to.be.equal(balanceDiff.toString());
    });

    it("transfer not from minter()", async () => {
        const oldEarnings = await token.earnings(whitelisted);
        await token.transfer(whitelisted, helpers.toGD("0.1"), { from: outsider });
        const newEarnings = (await token.earnings(whitelisted)) as any;
        const earningsDiff = newEarnings.sub(oldEarnings);

        expect(earningsDiff.toString()).to.be.equal("0");
    });

    it("transferFrom from minter()", async () => {
        const oldBalance = await token.balanceOf(whitelisted);
        const oldEarnings = await token.earnings(whitelisted);
        await token.approve(whitelisted, helpers.toGD("300"), { from: founder });
        await token.transferFrom(whitelisted, whitelisted, helpers.toGD("300"), { from: founder });
        const newBalance = (await token.balanceOf(whitelisted)) as any;
        const newEarnings = (await token.earnings(whitelisted)) as any;
        const balanceDiff = (new (web3 as any).utils.BN(newBalance)).sub((new (web3 as any).utils.BN(oldBalance)));
        const earningsDiff = (new (web3 as any).utils.BN(newEarnings)).sub((new (web3 as any).utils.BN(oldEarnings)));

        expect(earningsDiff.toString()).to.be.equal(balanceDiff.toString());
    });

    it("transferFrom not from minter()", async () => {
        const oldEarnings = await token.earnings(whitelisted);
        await token.approve(whitelisted, helpers.toGD("300"), { from: outsider });
        await token.transferFrom(whitelisted, whitelisted, helpers.toGD("300"), { from: outsider });
        const newEarnings = (await token.earnings(whitelisted)) as any;
        const earningsDiff = newEarnings.sub(oldEarnings);

        expect(earningsDiff.toString()).to.be.equal("0");
    });
});