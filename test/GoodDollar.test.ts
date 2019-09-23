import * as helpers from './helpers';

const Identity = artifacts.require("Identity");
const FeeFormula = artifacts.require("FeeFormula");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const ControllerInterface = artifacts.require("ControllerInterface");
const GoodDollar = artifacts.require("GoodDollar");
const TransferAndCallMock = artifacts.require("TransferAndCallMock");

contract("GoodDollar", ([founder, claimer, outsider]) => {

    let receiver: helpers.ThenArg<ReturnType<typeof TransferAndCallMock['new']>>;
    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let feeFormula: helpers.ThenArg<ReturnType<typeof FeeFormula['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
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

        await token.transfer(claimer, helpers.toGD("100"));
        await token.transfer(founder, helpers.toGD("100"));
        await token.transfer(outsider, helpers.toGD("10"));
        await identity.addClaimer(claimer);

    });

    it("should fail transfer", async () => {
        let data = "0x0";

        await helpers.assertVMRevert(token.transferAndCall(receiver.address, await token.balanceOf(outsider) , data, { from: outsider }));
    });

    it("should transfer and not call function", async () => {
        let data = "0x0";

        await helpers.assertVMException(token.transferAndCall(receiver.address, helpers.toGD("10"), data), "Contract Fallback failed");
        assert(!(await receiver.wasCalled()))
    });

    it("should transfer, not call and return true if not contract", async () => {
        let data = "0x0";

        assert(await token.transferAndCall(founder, helpers.toGD("3"), data));
    });

    it("should transfer and call correct function on receiver contract", async () => {
        let data = (receiver as any).contract.methods.mockTransfer().encodeABI();

        assert(await token.transferAndCall(receiver.address, helpers.toGD("10"), data));
        assert(await receiver.wasCalled());
    });

    it("should increase allowance", async () => {
        assert(await token.increaseAllowance(claimer, helpers.toGD("20"), { from: founder } ));
    });

    it("should allow to transfer from", async () => {
        assert(await token.transferFrom(founder, claimer, helpers.toGD("10"), { from: claimer }))
    })

    it("should decrease allowance", async () => {
        assert(await token.decreaseAllowance(claimer,  helpers.toGD("10"), { from: founder } ));
    });

    it("should allow to burn", async () => {
        assert(await token.burn(helpers.toGD("10"), { from: claimer }));
    })

    it("should allow to burn from", async () => {
        assert(await token.approve(claimer, helpers.toGD("20"), { from: founder } ));
        assert(await token.burnFrom(founder, helpers.toGD("20"), { from: claimer } ));
    });

    it("should not allow to mint beyond cap", async () => {
        assert(await unCappedToken.mint(founder, helpers.toGD('10')));

        await helpers.assertVMException(cappedToken.mint(founder, helpers.toGD("12")), "Cannot increase supply beyond cap");
    });
});