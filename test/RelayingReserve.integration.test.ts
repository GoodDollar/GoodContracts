import * as helpers from "./helpers";

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const ReserveRelayer = artifacts.require("ReserveRelayer");

contract(
  "ReserveRelayer - Transferring reserve",
  ([founder, whitelisted, receiver]) => {
    let identity: helpers.ThenArg<ReturnType<typeof Identity["new"]>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar["new"]>>;
    let controller: helpers.ThenArg<
      ReturnType<typeof ControllerInterface["new"]>
    >;
    let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote["new"]>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar["new"]>>;
    let reserveRelayer: helpers.ThenArg<
      ReturnType<typeof ReserveRelayer["new"]>
    >;

    let proposalId: string;

    const periodOffset = 60000;

    before(async () => {
      const periodStart =
        (await web3.eth.getBlock("latest")).timestamp + periodOffset;
      const periodEnd = periodStart + periodOffset;

      identity = await Identity.deployed();
      avatar = await Avatar.at(
        await (await DaoCreatorGoodDollar.deployed()).avatar()
      );
      controller = await ControllerInterface.at(await avatar.owner());
      absoluteVote = await AbsoluteVote.deployed();
      token = await GoodDollar.at(await avatar.nativeToken());
      reserveRelayer = await ReserveRelayer.new(
        avatar.address,
        identity.address,
        receiver,
        periodStart,
        periodEnd
      );
      await identity.addWhitelisted(whitelisted);
    });

    it("should not allow relayer with null address receiver", async () => {
      const periodStart =
        (await web3.eth.getBlock("latest")).timestamp + periodOffset;
      const periodEnd = periodStart + periodOffset;
      helpers.assertVMException(
        ReserveRelayer.new(
          avatar.address,
          identity.address,
          helpers.NULL_ADDRESS,
          periodStart,
          periodEnd
        ),
        "receiver cannot be null address"
      );
    });

    it("should perform transactions and increase fee reserve", async () => {
      const oldReserve = await token.balanceOf(avatar.address);

      await token.transfer(whitelisted, helpers.toGD("10"));
      await token.transfer(whitelisted, helpers.toGD("10"));
      await token.transfer(whitelisted, helpers.toGD("10"));

      // Check that reserve has received fees
      const reserve = (await token.balanceOf(avatar.address)) as any;

      const reserveDiff = reserve.sub(oldReserve);
      const totalFees = ((await token
        .getFees(helpers.toGD("10"))
        .then(_ => _[0])) as any).mul(new (web3 as any).utils.BN("3"));
      expect(reserveDiff.toString()).to.be.equal(totalFees.toString());
    });

    it("should correctly propose ReserveRelayer scheme", async () => {
      const schemeRegistrar = await SchemeRegistrar.deployed();
      const transaction = await schemeRegistrar.proposeScheme(
        avatar.address,
        reserveRelayer.address,
        helpers.NULL_HASH,
        "0x00000010",
        helpers.NULL_HASH
      );

      proposalId = transaction.logs[0].args._proposalId;
    });

    it("should correctly register ReserveRelayer scheme", async () => {
      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(
        e => e.event === "ExecuteProposal"
      );

      assert(executeProposalEventExists);
    });

    it("should start, transfer reserve and then end", async () => {
      await helpers.assertVMException(reserveRelayer.start(), "not in period");
      await helpers.increaseTime(periodOffset * 1.5);

      const oldBalance = await token.balanceOf(receiver);
      expect(oldBalance.toString()).to.be.equal("0");

      const reserve = (await token.balanceOf(avatar.address)) as any;

      assert(await reserveRelayer.start());

      const newBalance = await token.balanceOf(receiver);

      expect(newBalance.toString()).to.be.equal(reserve.toString());
    });
  }
);
