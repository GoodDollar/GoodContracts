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

    it("should fail transfer", async () => {
        let data = "0x0";

        await helpers.assertVMRevert(
            token.transferAndCall(receiver.address, await token.balanceOf(outsider) + helpers.toGD("1000") , data, { from: outsider })
        );
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
        assert(await token.increaseAllowance(whitelisted, helpers.toGD("20"), { from: founder } ));
    });

    it("should allow to transfer from", async () => {
        assert(await token.transferFrom(founder, whitelisted, helpers.toGD("10"), { from: whitelisted }))
    })

    it("should decrease allowance", async () => {
        assert(await token.decreaseAllowance(whitelisted,  helpers.toGD("10"), { from: founder } ));
    });

    it("should allow to burn", async () => {
        assert(await token.burn(helpers.toGD("10"), { from: whitelisted }));
    })

    it("should allow to burn from", async () => {
        assert(await token.approve(whitelisted, helpers.toGD("20"), { from: founder } ));
        assert(await token.burnFrom(founder, helpers.toGD("20"), { from: whitelisted } ));
    });

    it("should not allow to mint beyond cap", async () => {
        assert(await unCappedToken.mint(founder, helpers.toGD('10')));

        await helpers.assertVMException(cappedToken.mint(founder, helpers.toGD("12")), "Cannot increase supply beyond cap");
    });

    it("should collect transaction fee", async () => {
        const oldReserve = await token.balanceOf(avatar.address);
  
        await token.transfer(founder, helpers.toGD("200"),{from: whitelisted});
  
        // Check that reserve has received fees
        const reserve = (await token.balanceOf(avatar.address)) as any;
  
        const reserveDiff = reserve.sub(oldReserve);
        const totalFees = (await (token as any)
          .getFees(helpers.toGD("200"))
          .then(_ => _["0"])) as any;
        expect(reserveDiff.toString()).to.be.equal(totalFees.toString());
      });

    it("should get same results from overloaded getFees method", async () => {
      const totalFees = (await (token as any) //fix overload issue
        .getFees(helpers.toGD("300"))
        .then(_ => _["0"])) as any;
      const totalFees2 = (await token
        .getFees(helpers.toGD("300"), whitelisted, whitelisted)
        .then(_ => _["0"])) as any;
      expect(totalFees2.toNumber()).to.be.gt(0);
      expect(totalFees2.toString()).to.be.equal(totalFees.toString());
    });
  
    it("should collect transaction fee from sender", async () => {
        const oldReserve = await newtoken.balanceOf(avatar.address);
        const oldFounder = await newtoken.balanceOf(founder);
        await newtoken.transfer(founder, helpers.toGD("200"),{from: whitelisted});
  
        // Check that reserve has received fees
        const reserve = (await newtoken.balanceOf(avatar.address)) as any;
        const newFounder = (await newtoken.balanceOf(founder)) as any;
        const newWhitelisted = await newtoken.balanceOf(whitelisted);

        const reserveDiff = reserve.sub(oldReserve);
        const founderDiff = newFounder.sub(oldFounder);

        const totalFees = (await (newtoken as any)
          .getFees(helpers.toGD("200"))
          .then(_ => _["0"])) as any;
        expect(reserveDiff.toString()).to.be.equal(totalFees.toString());
        expect(founderDiff.toString()).to.be.equal(helpers.toGD("200"));
        expect(newWhitelisted.toString()).to.be.equal(helpers.toGD("98"));// 300 - 200 - 2(1% fee)

      });
});