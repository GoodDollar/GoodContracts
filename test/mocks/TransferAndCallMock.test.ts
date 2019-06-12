import * as helpers from '../helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const TransferAndCallMock = artifacts.require("TransferAndCallMock")

contract("Mocks - TransferAndCall", ([founder, whitelisted]) => {

    let receiver: helpers.ThenArg<ReturnType<typeof TransferAndCallMock['new']>>;
    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;

    before(async () => {
        receiver = await TransferAndCallMock.new();
        identity = await Identity.deployed();
        avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
        token = await GoodDollar.at(await avatar.nativeToken());

        await identity.addIdentity(receiver.address, false);
        await identity.addIdentity(whitelisted, true);
    });

    it("should transfer and call function", async () => {
        let data = (receiver as any).contract.methods.mockTransfer(whitelisted, web3.utils.toWei("2")).encodeABI();

        assert(await token.transferAndCall(receiver.address, web3.utils.toWei("10"), data));
        assert(await receiver.wasCalled());
    });
});