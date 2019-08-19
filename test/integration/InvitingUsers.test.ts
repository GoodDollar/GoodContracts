import * as helpers from '../helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const InviteUser = artifacts.require("InviteUser");

contract("Integration - awarding invitational bonus", ([founder, claimer, claimer2, nonClaimer]) => {

    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
    let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
    let inviteUser: helpers.ThenArg<ReturnType<typeof InviteUser['new']>>;

    let proposalId: string;

    before(async () => {
      identity = await Identity.deployed();
      avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
      controller = await ControllerInterface.at(await avatar.owner());
      absoluteVote = await AbsoluteVote.deployed();
      token = await GoodDollar.at(await avatar.nativeToken());
      inviteUser = await InviteUser.new(avatar.address, identity.address, 5, 3);

      await identity.addClaimer(claimer);
    });

    it("should not allow claiming before starting scheme", async () => {
      await helpers.assertVMException(inviteUser.claimReward({ from: claimer }), "Scheme is not registered")
    })

    it("should start InviteUser scheme", async () => {
      const schemeRegistrar = await SchemeRegistrar.deployed();
      const transaction = await schemeRegistrar.proposeScheme(avatar.address, inviteUser.address,
        helpers.NULL_HASH, "0x0000010", helpers.NULL_HASH);

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

       // Verifies that the ExecuteProposal event has been emitted
      assert(executeProposalEventExists);
    });

    it("Should invite user", async () => {
      assert(await inviteUser.inviteUser(claimer2, {from: claimer }));
    });

    it("should not allow inviting twice", async () => {
      await helpers.assertVMException(inviteUser.inviteUser(claimer2, { from: claimer }), "User already invited");
    });

    it("should not allow inviting registered claimer", async () => {
      await helpers.assertVMException(inviteUser.inviteUser(claimer), "User already in system");
    });

    it("should allow registered claimer to claim", async () => {
      assert(await inviteUser.claimReward({ from: claimer }));
    });

    it("should not allow claimer to claim twice", async () => {
      await helpers.assertVMException(inviteUser.claimReward({ from: claimer }), "Cannot claim twice");
    })

    it("should allow to claim after registering", async () => {
      await helpers.assertVMException(inviteUser.claimReward({ from: claimer2 }), "User not in system");

      await identity.addClaimer(claimer2);

      assert(await inviteUser.claimReward({ from: claimer2 }));
    })

    it("should end InviteUser scheme", async () => {
      const schemeRegistrar = await SchemeRegistrar.deployed();
      const transaction = await schemeRegistrar.proposeToRemoveScheme(avatar.address, inviteUser.address,
          helpers.NULL_HASH);

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

      assert(executeProposalEventExists);
    });
});

export{}