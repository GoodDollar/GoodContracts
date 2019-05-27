import * as helpers from '../helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const UBI = artifacts.require("UBI");

type ThenArg<T> = T extends Promise<infer U> ? U :
  T extends (...args: any[]) => Promise<infer U> ? U :
  T;

contract("Integration - Claiming UBI", ([founder, whitelisted]) => {

  let identity: ThenArg<ReturnType<typeof Identity['new']>>;
  let avatar: ThenArg<ReturnType<typeof Avatar['new']>>;
  let controller: ThenArg<ReturnType<typeof ControllerInterface['new']>>;
  let absoluteVote: ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
  let token: ThenArg<ReturnType<typeof GoodDollar['new']>>;
  let ubi: ThenArg<ReturnType<typeof UBI['new']>>;

  let proposalId: string;

  const periodOffset = 60000;

  before(async () => {
    const periodStart = (await web3.eth.getBlock('latest')).timestamp + periodOffset;
    const periodEnd = periodStart + periodOffset;

    identity = await Identity.deployed();
    avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
    controller = await ControllerInterface.at(await avatar.owner());
    absoluteVote = await AbsoluteVote.deployed();
    token = await GoodDollar.at(await avatar.nativeToken());
    ubi = await UBI.new(avatar.address, identity.address, web3.utils.toWei("1000"), periodStart, periodEnd);

    await identity.addIdentity(whitelisted, true);
    await identity.addIdentity(ubi.address, false);
  });

  it("should perform transactions and increase fee reserve", async () => {
    const oldReserve = await token.balanceOf(avatar.address);
    expect(oldReserve.toString()).to.be.equal(web3.utils.toWei("0"));

    await token.transfer(whitelisted, web3.utils.toWei("10"));
    await token.transfer(whitelisted, web3.utils.toWei("10"));
    await token.transfer(whitelisted, web3.utils.toWei("10"));

    // Check that reserve has received fees
    const reserve = (await token.balanceOf(avatar.address)) as any;

    const reserveDiff = reserve.sub(oldReserve);
    const totalFees = ((await token.getFees()) as any).mul(new web3.utils.BN("3"));
    expect(reserveDiff.toString()).to.be.equal(totalFees.toString());
  });

  it("should correctly propose UBI scheme", async () => {
    // Propose it
    const schemeRegistrar = await SchemeRegistrar.deployed();
    const transaction = await schemeRegistrar.proposeScheme(avatar.address, ubi.address, 
      helpers.NULL_HASH, "0x00000010", helpers.NULL_HASH);

    proposalId = transaction.logs[0].args._proposalId;
  });

  it("should correctly register UBI scheme", async () => {
    const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
    const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

    // Verifies that the ExecuteProposal event has been emitted
    assert(executeProposalEventExists);
  });

  it("should start UBI period", async () => {
    await helpers.assertVMException(ubi.start());
    await helpers.increaseTime(periodOffset*1.5);
    assert(await ubi.start());
  });

  it("should correctly claim UBI", async () => {
    const oldWhitelistedBalance = await token.balanceOf(whitelisted);

    assert(await ubi.claim({ from: whitelisted }));

    // Check that whitelisted has received the claimed amount
    const fee = await token.getFees();
    const claimDistributionMinusFee = ((await ubi.claimDistribution()) as any).sub(fee);

    const whitelistedBalance = (await token.balanceOf(whitelisted)) as any;
    const whitelistedBalanceDiff = whitelistedBalance.sub(oldWhitelistedBalance);

    expect(whitelistedBalanceDiff.toString()).to.be.equal(claimDistributionMinusFee.toString());
  });

  it("should end UBI period", async () => {
     await helpers.assertVMException(ubi.end());
     await helpers.increaseTime(periodOffset);
     assert(await ubi.end());
  });
});

// Important see: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}