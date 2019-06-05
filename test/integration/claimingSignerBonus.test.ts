import * as helpers from '../helpers';

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const SignerBonus = artifacts.require("SignerBonus");

contract("Integration - Claiming signer bonus", ([founder, claimer, claimer2, nonClaimer]) => {

    let identity: helpers.ThenArg<ReturnType<typeof Identity['new']>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar['new']>>;
    let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface['new']>>;
    let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote['new']>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar['new']>>;
    let signerBonus: helpers.ThenArg<ReturnType<typeof SignerBonus['new']>>;

    let proposalId: string;

    before(async () => {
      identity = await Identity.deployed();
      avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
      controller = await ControllerInterface.at(await avatar.owner());
      absoluteVote = await AbsoluteVote.deployed();
      token = await GoodDollar.at(await avatar.nativeToken());
      signerBonus = await SignerBonus.new(avatar.address, identity.address, 5);

      await identity.addClaimer(claimer);
      await identity.addClaimer(claimer2);
    });

    it("should not allow claimer to claim before starting scheme", async () => {
      await helpers.assertVMException(signerBonus.claim({ from: claimer }), "scheme is not registered")
    })

    it("should start SignerBonus scheme", async () => {
      const schemeRegistrar = await SchemeRegistrar.deployed();
      const transaction = await schemeRegistrar.proposeScheme(avatar.address, signerBonus.address,
        helpers.NULL_HASH, "0x0000010", helpers.NULL_HASH);

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

       // Verifies that the ExecuteProposal event has been emitted
      assert(executeProposalEventExists);
    });

    it("should not allow non-claimer to claim", async () => {
      await helpers.assertVMException(signerBonus.claim({ from: nonClaimer }), "is not claimer");
    })

    it("should allow claimer to claim", async () => {
      let oldBalance = await token.balanceOf(claimer);
      expect(oldBalance.toString()).to.be.equal("0");
      await signerBonus.claim({ from: claimer });

      let newBalance = await token.balanceOf(claimer);
      expect(newBalance.toString()).to.be.equal("5");
    })

    it("should not allow claimer to claim twice", async() => {
      await helpers.assertVMException(signerBonus.claim({ from: claimer}), "has already claimed");
    });

    it("should end SignerBonus scheme", async () => {
      const schemeRegistrar = await SchemeRegistrar.deployed();
      const transaction = await schemeRegistrar.proposeToRemoveScheme(avatar.address, signerBonus.address,
          helpers.NULL_HASH);

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(e => e.event === 'ExecuteProposal');

      assert(executeProposalEventExists);
    });

    it("should not allow claimer to claim after scheme is unregistered", async () => {
      await helpers.assertVMException(signerBonus.claim({ from: claimer2 }), "scheme is not registered");
    })
});

export{}