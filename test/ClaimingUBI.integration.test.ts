import * as helpers from "./helpers";

const Identity = artifacts.require("Identity");
const FeeFormula = artifacts.require("FeeFormula");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const UBI = artifacts.require("UBI");
const FixedUBI = artifacts.require("FixedUBI");
const ReserveRelayer = artifacts.require("ReserveRelayer");

contract(
  "Integration - Claiming UBI",
  ([
    founder,
    whitelisted,
    whitelisted2,
    whitelisted3,
    whitelisted4,
    nonWhitelisted,
    stranger
  ]) => {
    let identity: helpers.ThenArg<ReturnType<typeof Identity["new"]>>;
    let feeFormula: helpers.ThenArg<ReturnType<typeof FeeFormula["new"]>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar["new"]>>;
    let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface["new"]>>;
    let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote["new"]>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar["new"]>>;
    let ubi: helpers.ThenArg<ReturnType<typeof UBI["new"]>>;
    let reserveUBI: helpers.ThenArg<ReturnType<typeof UBI["new"]>>;
    let fixedUBI: helpers.ThenArg<ReturnType<typeof FixedUBI["new"]>>;
    let vanillaFixedUBI: helpers.ThenArg<ReturnType<typeof FixedUBI["new"]>>;
    let emptyUBI: helpers.ThenArg<ReturnType<typeof UBI["new"]>>;
    let reserveRelayer: helpers.ThenArg<ReturnType<typeof ReserveRelayer["new"]>>;

    let proposalId: string;

    const periodOffset = 60000;

    before(async () => {
      const periodStart = (await web3.eth.getBlock("latest")).timestamp + periodOffset;
      const periodEnd = periodStart + periodOffset;
      const periodStart2 = periodEnd + periodOffset;
      const periodEnd2 = periodStart2 + periodOffset * 2;
      const periodEnd3 = periodEnd2 + periodOffset * 100000;

      identity = await Identity.deployed();
      feeFormula = await FeeFormula.deployed();
      avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
      controller = await ControllerInterface.at(await avatar.owner());
      absoluteVote = await AbsoluteVote.deployed();
      token = await GoodDollar.at(await avatar.nativeToken());

      await identity.addWhitelisted(whitelisted);
      await identity.addWhitelisted(whitelisted4);

      ubi = await UBI.new(
        avatar.address,
        identity.address,
        helpers.toGD("3"),
        periodStart2,
        periodEnd2
      );
      reserveUBI = await UBI.new(
        avatar.address,
        identity.address,
        web3.utils.toWei("300000"),
        periodStart2,
        periodEnd2
      );
      emptyUBI = await UBI.new(
        avatar.address,
        identity.address,
        helpers.toGD("0"),
        periodStart,
        periodEnd
      );
      fixedUBI = await FixedUBI.new(
        avatar.address,
        identity.address,
        helpers.toGD("0"),
        periodEnd2,
        periodEnd3,
        helpers.toGD("1")
      );

      vanillaFixedUBI = await FixedUBI.deployed();

      reserveRelayer = await ReserveRelayer.new(
        avatar.address,
        identity.address,
        fixedUBI.address,
        periodEnd2,
        periodEnd3
      );
    });

    it("should not allow creating fixed UBI contract with zero distribution", async () => {
      const periodStart = (await web3.eth.getBlock("latest")).timestamp + periodOffset;
      const periodEnd = periodStart + periodOffset;

      await helpers.assertVMException(
        FixedUBI.new(
          avatar.address,
          identity.address,
          helpers.toGD("0"),
          periodStart,
          periodEnd,
          helpers.toGD("0")
        ),
        "Distribution cannot be zero"
      );
    });

    it("should end UBI scheme with no remaining reserve", async () => {
      // Propose it
      const schemeRegistrar = await SchemeRegistrar.deployed();
      let transaction = await schemeRegistrar.proposeScheme(
        avatar.address,
        emptyUBI.address,
        helpers.NULL_HASH,
        "0x00000010",
        helpers.NULL_HASH
      );

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(
        e => e.event === "ExecuteProposal"
      );

      // Verifies that the ExecuteProposal event has been emitted
      assert(executeProposalEventExists);

      await helpers.assertVMException(emptyUBI.start(), "not in period");
      await helpers.increaseTime(periodOffset * 1.1);
      assert(await emptyUBI.start());

      await helpers.assertVMException(emptyUBI.end(), "period has not ended");
      await helpers.increaseTime(periodOffset);

      const reserve = await token.balanceOf(emptyUBI.address);

      expect(reserve.toString()).to.be.equal("0");
      assert(await emptyUBI.end());
    });

    it("should perform transactions and increase fee reserve", async () => {
      const oldReserve = await token.balanceOf(avatar.address);
      await token.transfer(whitelisted, helpers.toGD("300"));

      // Check that reserve has received fees
      const reserve = (await token.balanceOf(avatar.address)) as any;

      const reserveDiff = reserve.sub(oldReserve);
      const txFee = (await (token as any) //fix overload issue
        .getFees(helpers.toGD("300"))) as any;
      const totalFees = txFee["0"];
      expect(reserveDiff.toString()).to.be.equal(totalFees.toString());
    });

    it("should correctly propose UBI scheme", async () => {
      // Propose it
      const schemeRegistrar = await SchemeRegistrar.deployed();
      const transaction = await schemeRegistrar.proposeScheme(
        avatar.address,
        ubi.address,
        helpers.NULL_HASH,
        "0x00000010",
        helpers.NULL_HASH
      );

      proposalId = transaction.logs[0].args._proposalId;
    });

    it("should correctly register UBI scheme", async () => {
      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(
        e => e.event === "ExecuteProposal"
      );

      // Verifies that the ExecuteProposal event has been emitted
      assert(executeProposalEventExists);
    });

    it("should start UBI period", async () => {
      await helpers.assertVMException(ubi.start(), "not in period");
      await helpers.increaseTime(periodOffset);
      assert(await ubi.start());
    });

    it("should allow non-whitelisted to checkEntitlement after it started", async () => {
      await vanillaFixedUBI.start();
      const claimAmount = await vanillaFixedUBI.checkEntitlement({
        from: nonWhitelisted
      });
      expect(claimAmount.toString()).to.be.equal(helpers.toGD("1"));

      const claimAmount2 = await vanillaFixedUBI.checkEntitlement({
        from: whitelisted
      });
      expect(claimAmount2.toString()).to.be.equal(helpers.toGD("1"));
    });

    it("should not allow starting scheme without enough funds", async () => {
      const schemeRegistrar = await SchemeRegistrar.deployed();
      let transaction = await schemeRegistrar.proposeScheme(
        avatar.address,
        reserveUBI.address,
        helpers.NULL_HASH,
        "0x00000010",
        helpers.NULL_HASH
      );

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(
        e => e.event === "ExecuteProposal"
      );

      // Verifies that the ExecuteProposal event has been emitted
      assert(executeProposalEventExists);

      await helpers.assertVMException(reserveUBI.start(), "Not enough funds to start");
    });

    it("should register fixed claim scheme and add whitelisteds", async () => {
      const schemeRegistrar = await SchemeRegistrar.deployed();
      let transaction = await schemeRegistrar.proposeScheme(
        avatar.address,
        fixedUBI.address,
        helpers.NULL_HASH,
        "0x00000010",
        helpers.NULL_HASH
      );

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(
        e => e.event === "ExecuteProposal"
      );

      // Verifies that the ExecuteProposal event has been emitted
      assert(executeProposalEventExists);

      await identity.addWhitelisted(whitelisted2);
      await identity.addWhitelisted(whitelisted3);
    });

    it("should correctly claim UBI", async () => {
      const oldWhitelistedBalance = await token.balanceOf(whitelisted);
      const now = (await web3.eth.getBlock("latest")).timestamp;
      assert(await ubi.claim({ from: whitelisted }));
      const amountClaimed = await ubi.getClaimAmount(0);

      // Check that whitelisted has received the claimed amount
      const claimDistribution = (await ubi.claimDistribution()) as any;

      const whitelistedBalance = (await token.balanceOf(whitelisted)) as any;
      const whitelistedBalanceDiff = whitelistedBalance.sub(oldWhitelistedBalance);

      const lastClaimed = (await ubi.lastClaimed(whitelisted)).toNumber();
      expect(lastClaimed).to.be.gte(now);
      expect(whitelistedBalanceDiff.toString()).to.be.equal(claimDistribution.toString());
      expect(whitelistedBalanceDiff.toString()).to.be.equal(claimDistribution.toString());
      expect(whitelistedBalanceDiff.toString()).to.be.equal(amountClaimed.toString());
    });

    it("should show amount of whitelisteds", async () => {
      const whitelistedAmount = await ubi.getClaimerCount(0);
      expect(whitelistedAmount.toString()).to.be.equal("1");
    });

    it("should show amount claimed", async () => {
      const amountClaimed = await ubi.getClaimAmount(0);

      const distribution = (await ubi.claimDistribution()) as any;

      expect(distribution.toString()).to.be.equal(amountClaimed.toString());
    });

    it("should not allow to claim twice", async () => {
      await helpers.assertVMException(
        ubi.claim({ from: whitelisted }),
        "has already claimed"
      );
    });

    it("should not allow non-whitelisted to claim", async () => {
      await helpers.assertVMException(
        ubi.claim({ from: nonWhitelisted }),
        "is not whitelisted"
      );
    });

    it("should not allow new whitelisted to claim", async () => {
      await helpers.increaseTime(periodOffset);
      await identity.addWhitelisted(stranger);

      await helpers.assertVMException(
        ubi.claim({ from: stranger }),
        "Was not added within period"
      );
    });

    it("should end UBI period", async () => {
      await helpers.assertVMException(ubi.end(), "period has not ended");
      await helpers.increaseTime(periodOffset);
      assert(await ubi.end());
    });

    it("should allow starting fixed claim scheme", async () => {
      assert(await fixedUBI.start());
    });

    it("should correctly register ReserveRelayer scheme and transfer new fees to fixed UBI", async () => {
      await token.transfer(whitelisted, helpers.toGD("10"));
      await token.transfer(whitelisted, helpers.toGD("10"));
      await token.transfer(avatar.address, helpers.toGD("100"));

      const schemeRegistrar = await SchemeRegistrar.deployed();
      const transaction = await schemeRegistrar.proposeScheme(
        avatar.address,
        reserveRelayer.address,
        helpers.NULL_HASH,
        "0x00000010",
        helpers.NULL_HASH
      );

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(
        e => e.event === "ExecuteProposal"
      );

      assert(executeProposalEventExists);
      assert(await reserveRelayer.start());
    });

    it("should allow claiming from fixed UBI", async () => {
      assert(await fixedUBI.claim({ from: whitelisted3 }));
    });

    it("should not allow claiming on same day from fixed UBI", async () => {
      await helpers.assertVMException(
        fixedUBI.claim({ from: whitelisted3 }),
        "Has claimed within a day"
      );
    });

    it("should not allow to claim for more than one day", async () => {
      await helpers.increaseTime(periodOffset * 5);
      await token.burn(await token.balanceOf(whitelisted3), {
        from: whitelisted3
      });
      const oldBalancewhitelisted3 = await token.balanceOf(whitelisted3);
      expect(oldBalancewhitelisted3.toString()).to.be.equal(helpers.toGD("0"));

      const claimAmount = await fixedUBI.checkEntitlement({
        from: whitelisted3
      });
      expect(claimAmount.toString()).to.be.equal(helpers.toGD("1"));

      const now = (await web3.eth.getBlock("latest")).timestamp;
      await fixedUBI.claim({ from: whitelisted3 });

      const newBalancewhitelisted3 = await token.balanceOf(whitelisted3);

      const maxValue = helpers.toGD("1") as any;
      expect(newBalancewhitelisted3.toString()).to.be.equal(maxValue.toString());

      const lastClaimed = (await fixedUBI.lastClaimed(whitelisted3)).toNumber();
      expect(lastClaimed).to.be.gte(now);
    });

    it("should get daily stats", async () => {
      const res = await fixedUBI.getDailyStats();

      const maxValue = helpers.toGD("1") as any;

      expect(res[0].toString()).to.be.equal("1");
      expect(res[1].toString()).to.be.equal(maxValue.toString());
    });
  }
);

export {};
