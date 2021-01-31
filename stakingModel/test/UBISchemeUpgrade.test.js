const MarketMaker = artifacts.require("GoodMarketMaker");

const GoodDollar = artifacts.require("GoodDollar");
const Bancor = artifacts.require("BancorFormula");

const Identity = artifacts.require("IdentityMock");
const Formula = artifacts.require("FeeFormula");
const avatarMock = artifacts.require("AvatarMock");
const UBIMock = artifacts.require("UBISchemeMock");
const ControllerMock = artifacts.require("Controller");
const FirstClaimPool = artifacts.require("FirstClaimPool");
const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

const MAX_INACTIVE_DAYS = 3;
const ONE_DAY = 86400;

export const increaseTime = async function(duration) {
  const id = await Date.now();

  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [duration],
      id: id + 1
    },
    () => {}
  );

  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_mine",
      id: id + 1
    },
    () => {}
  );
};

contract("UBIScheme", ([founder, claimer1]) => {
  let goodDollar, identity, formula, avatar, ubi, controller, firstClaimPool, ubiUpgrade;

  before(async () => {
    formula = await Formula.new(0);
    identity = await Identity.new();
    goodDollar = await GoodDollar.new(
      "GoodDollar",
      "GDD",
      "0",
      formula.address,
      identity.address,
      NULL_ADDRESS
    );
    avatar = await avatarMock.new("", goodDollar.address, NULL_ADDRESS);
    controller = await ControllerMock.new(avatar.address);
    await avatar.transferOwnership(controller.address);
    firstClaimPool = await FirstClaimPool.new(avatar.address, identity.address, 100);
  });

  it("should deploy the ubi", async () => {
    const block = await web3.eth.getBlock("latest");
    const startUBI = block.timestamp;
    const endUBI = startUBI + 60 * 60 * 24 * 30;
    ubi = await UBIMock.new(
      avatar.address,
      identity.address,
      firstClaimPool.address,
      startUBI,
      endUBI,
      MAX_INACTIVE_DAYS,
      1
    );
    let isActive = await ubi.isActive();
    expect(isActive).to.be.false;
    await controller.registerScheme(ubi.address, "0x00", "0x0000001F", avatar.address);
    await ubi.start();
    isActive = await ubi.isActive();
    const newUbi = await firstClaimPool.ubi();
    let periodStart = await ubi.periodStart().then(_ => _.toNumber());
    let startDate = new Date(periodStart * 1000);
    expect(startDate.toISOString()).to.have.string("T12:00:00.000Z"); //contract set itself to start at noon GMT
    expect(newUbi.toString()).to.be.equal(ubi.address);
    expect(isActive).to.be.true;
    await goodDollar.mint(ubi.address, "1000000");
    expect(await goodDollar.balanceOf(ubi.address).then(_ => _.toNumber())).to.equal(
      1000000
    );
  });

  it("should deploy upgrade", async () => {
    await increaseTime(60 * 60 * 24 * 30 * 2); //expire prev scheme
    const block = await web3.eth.getBlock("latest");
    const startUBI = block.timestamp;
    const endUBI = startUBI + 60 * 60 * 24 * 30;
    ubiUpgrade = await UBIMock.new(
      avatar.address,
      identity.address,
      firstClaimPool.address,
      startUBI,
      endUBI,
      MAX_INACTIVE_DAYS,
      1
    );
    let isActive = await ubiUpgrade.isActive();
    expect(isActive).to.be.false;
  });

  it("should not be able to upgrade until registered scheme", async () => {
    const res = await ubiUpgrade.upgrade(ubi.address).catch(_ => false);
    expect(res).to.be.false;
  });

  it("should start once registered scheme and prev scheme expired", async () => {
    const block = await web3.eth.getBlock("latest");
    const now = block.timestamp;
    expect(now).to.be.gt(await ubi.periodEnd().then(_ => _.toNumber()));
    await controller.registerScheme(
      ubiUpgrade.address,
      "0x00",
      "0x0000001F",
      avatar.address
    );
    const res = await ubiUpgrade.upgrade(ubi.address).catch(_ => false);
    expect(res).to.not.be.false;

    let isActive = await ubiUpgrade.isActive();
    const newUbi = await firstClaimPool.ubi();
    let periodStart = await ubiUpgrade.periodStart().then(_ => _.toNumber());
    expect(newUbi.toString()).to.be.equal(ubiUpgrade.address);
    expect(isActive).to.be.true;
    let startDate = new Date(periodStart * 1000);
    expect(startDate.toISOString()).to.have.string("T12:00:00.000Z"); //contract set itself to start at noon GMT
  });

  it("should have transferred funds correctly", async () => {
    const oldUbiBalance = await goodDollar.balanceOf(ubi.address);
    const newUbiBalance = await goodDollar.balanceOf(ubiUpgrade.address);
    expect(oldUbiBalance.toNumber()).to.equal(0);
    expect(newUbiBalance.toNumber()).to.equal(1000000);
  });

  it("should have set new firstclaim await correctly", async () => {
    expect(await firstClaimPool.claimAmount().then(_ => _.toNumber())).to.equal(1000);
  });

  it("should not be able to call upgrade again", async () => {
    const res = await ubiUpgrade.upgrade(ubi.address).catch(_ => false);
    expect(res).to.be.false;
  });
});
