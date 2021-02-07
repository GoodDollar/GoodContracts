const MarketMaker = artifacts.require("GoodMarketMaker");

const GoodDollar = artifacts.require("GoodDollar");
const Bancor = artifacts.require("BancorFormula");

const Identity = artifacts.require("IdentityMock");
const Formula = artifacts.require("FeeFormula");
const avatarMock = artifacts.require("AvatarMock");
const UBIMock = artifacts.require("UBISchemeMock");
const ControllerMock = artifacts.require("ControllerMock");
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

contract(
  "UBISchemeCycle",
  ([
    founder,
    claimer1,
    claimer2,
    claimer3,
    claimer4,
    fisherman,
    claimer5,
    claimer6,
    claimer7,
    claimer8
  ]) => {
    let goodDollar, identity, formula, avatar, ubi, controller, firstClaimPool;

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
      await goodDollar.mint(firstClaimPool.address, "10000000");
      await identity.addWhitelisted(claimer1);
      await identity.addWhitelisted(claimer2);
    });

    it("should deploy the ubi with cycle 7 and 1 active user", async () => {
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
        7
      );
      let isActive = await ubi.isActive();
      await goodDollar.mint(ubi.address, "1000");
      expect(isActive).to.be.false;
      expect(await ubi.cycleLength().then(_ => _.toNumber())).to.be.equal(7);
    });

    it("should not be able to change cycleLength if not avatar", async () => {
      let error = await ubi.setCycleLength(1).catch(e => e);
      expect(error.message).to.have.string("only Avatar");
    });

    it("should be able to change cycleLength if avatar", async () => {
      // initializing the ubi
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "setCycleLength",
          type: "function",
          inputs: [
            {
              type: "uint256",
              name: "_newLength"
            }
          ]
        },
        [8]
      );
      await controller.genericCall(ubi.address, encodedCall, avatar.address, 0);
      expect(await ubi.cycleLength().then(_ => _.toNumber())).to.be.equal(8);
    });

    it("should start the ubi", async () => {
      await ubi.start();
      let isActive = await ubi.isActive();
      const newUbi = await firstClaimPool.ubi();
      let periodStart = await ubi.periodStart().then(_ => _.toNumber());
      let startDate = new Date(periodStart * 1000);
      expect(startDate.toISOString()).to.have.string("T12:00:00.000Z");
      expect(newUbi.toString()).to.be.equal(ubi.address);
      expect(isActive).to.be.true;
    });

    it("should set ubischeme", async () => {
      // initializing the ubi
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "setUBIScheme",
          type: "function",
          inputs: [
            {
              type: "address",
              name: "_ubi"
            }
          ]
        },
        [ubi.address]
      );
      await controller.genericCall(
        firstClaimPool.address,
        encodedCall,
        avatar.address,
        0
      );
      await firstClaimPool.start();
    });

    it("should calculate cycle on first day", async () => {
      await increaseTime(ONE_DAY); //make sure
      let transaction = await ubi.claim({ from: claimer1 });
      await ubi.claim({ from: claimer2 });
      let cycleLength = await ubi.cycleLength().then(_ => _.toNumber());
      let currentCycle = await ubi.currentCycleLength();
      expect(currentCycle.toNumber()).to.be.gt(0);
      const cycleEvent = transaction.logs.find(e => e.event === "UBICycleCalculated");
      expect(cycleEvent.args.day.toNumber()).to.be.a("number");
      expect(cycleEvent.args.pool.toNumber()).to.be.equal(1000);
      expect(cycleEvent.args.cycleLength.toNumber()).to.be.equal(cycleLength);
      expect(cycleEvent.args.dailyUBIPool.toNumber()).to.be.equal(
        Math.floor(1000 / cycleLength)
      );
    });

    it("should  have calculated dailyCyclePool and dailyUbi correctly", async () => {
      increaseTime(ONE_DAY);
      let transaction = await ubi.claim({ from: claimer2 });
      expect(await goodDollar.balanceOf(claimer2).then(_ => _.toNumber())).to.be.equal(
        100 + 62
      ); //first day 1G$ (100 wei), second claim 125 wei daily pool divided by 2 active users = 62
      expect(await ubi.dailyCyclePool().then(_ => _.toNumber())).to.be.equal(125);
      expect(await ubi.currentDayInCycle().then(_ => _.toNumber())).to.be.equal(1); //1 day passed
    });

    it("should calculate next cycle even if day passed without claims(setDay)", async () => {
      increaseTime(ONE_DAY * 9);
      expect(await ubi.currentDayInCycle().then(_ => _.toNumber())).to.be.equal(10); //10 days passed total
      let transaction = await ubi.claim({ from: claimer1 }); //claims in new ubi cycle
      expect(await goodDollar.balanceOf(claimer1).then(_ => _.toNumber())).to.be.equal(
        100 + 58 //58 amount of new ubicycle
      );
      const cycleEvent = transaction.logs.find(e => e.event === "UBICycleCalculated");

      expect(cycleEvent).to.be.not.empty;

      expect(await ubi.currentDayInCycle().then(_ => _.toNumber())).to.be.equal(0); //new cycle started
      expect(cycleEvent.args.dailyUBIPool.toNumber()).to.be.equal(117); //(1000 - 62 in pool) divided by 8 days - only first claimer got 62 in first cycle
    });
  }
);
