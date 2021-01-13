import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { GReputation, CompoundVotingMachine } from "../../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { createDAO } from "../helpers";
const BN = ethers.BigNumber;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

let grep: GReputation, grepWithOwner: GReputation, identity, gd, bounty;
let signers: SignerWithAddress[], founder, repOwner, rep1, rep2, rep3;

const encodeParameters = (types, values) =>
  ethers.utils.defaultAbiCoder.encode(types, values);

describe("GovernorAlpha#propose", () => {
  let gov: CompoundVotingMachine, root: SignerWithAddress, acct: SignerWithAddress;

  let trivialProposal, targets, values, signatures, callDatas;
  let proposalBlock, proposalId, voteDelay, votePeriod;

  before(async () => {
    [root, acct, ...signers] = await ethers.getSigners();
    const GReputation = await ethers.getContractFactory("GReputation");
    const CompoundVotingMachine = await ethers.getContractFactory(
      "CompoundVotingMachine"
    );

    grep = (await upgrades.deployProxy(GReputation, [root.address], {
      unsafeAllowCustomTypes: true
    })) as GReputation;

    let { daoCreator } = await createDAO();
    let avatar = await daoCreator.avatar();
    gov = (await CompoundVotingMachine.deploy(
      avatar,
      grep.address,
      5760
    )) as CompoundVotingMachine;

    await grep.mint(root.address, ethers.BigNumber.from("1000000"));
    targets = [root.address];
    values = ["0"];
    signatures = ["getBalanceOf(address)"];
    callDatas = [encodeParameters(["address"], [acct.address])];

    await gov.propose(targets, values, signatures, callDatas, "do nothing");
    proposalBlock = +(await ethers.provider.getBlockNumber());
    proposalId = await gov.latestProposalIds(root.address);
    trivialProposal = await gov.proposals(proposalId);

    voteDelay = await gov.votingDelay().then(_ => _.toNumber());
    votePeriod = await gov.votingPeriod().then(_ => _.toNumber());
  });

  // it("Given the sender's GetPriorVotes for the immediately previous block is above the Proposal Threshold (e.g. 2%), the given proposal is added to all proposals, given the following settings", async () => {
  //   test.todo("depends on get prior votes and delegation and voting");
  // });

  it("reverts with pending", async () => {
    await expect(
      gov.propose(targets, values, signatures, callDatas, "do nothing")
    ).to.revertedWith(
      "revert CompoundVotingMachine::propose: one live proposal per proposer, found an already pending proposal"
    );
  });

  describe("simple initialization", async () => {
    it("ID is set to a globally unique identifier", async () => {
      expect(trivialProposal.id).to.equal(proposalId);
    });

    it("Proposer is set to the sender", async () => {
      expect(trivialProposal.proposer).to.equal(root.address);
    });

    it("Start block is set to the current block number plus vote delay", async () => {
      expect(trivialProposal.startBlock).to.equal(proposalBlock + voteDelay + "");
    });

    it("End block is set to the current block number plus the sum of vote delay and vote period", async () => {
      expect(trivialProposal.endBlock).to.equal(
        proposalBlock + voteDelay + votePeriod + ""
      );
    });

    it("ForVotes and AgainstVotes are initialized to zero", async () => {
      expect(trivialProposal.forVotes).to.equal("0");
      expect(trivialProposal.againstVotes).to.equal("0");
    });

    //   xit("Voters is initialized to the empty set", async () => {
    //     test.todo(
    //       "mmm probably nothing to prove here unless we add a counter or something"
    //     );
    //   });

    it("Executed and Canceled flags are initialized to false", async () => {
      expect(trivialProposal.canceled).to.equal(false);
      expect(trivialProposal.executed).to.equal(false);
    });

    it("ETA is initialized to zero", async () => {
      expect(trivialProposal.eta).to.equal("0");
    });

    it("Targets, Values, Signatures, Calldatas are set according to parameters", async () => {
      let dynamicFields = await gov.getActions(trivialProposal.id);
      expect(dynamicFields.targets).to.deep.equal(targets);
      expect(
        dynamicFields["1"].map(_ => _.toString()), //values is reserved word in ethersjs so we use array index
        "values not equal"
      ).to.deep.equal(values);
      expect(dynamicFields.signatures).to.deep.equal(signatures);
      expect(dynamicFields.calldatas).to.deep.equal(callDatas);
    });

    describe("if there exists a pending or active proposal from the same proposer, we must revert.", () => {
      it("reverts with active", async () => {
        await ethers.provider.send("evm_mine", []);
        await ethers.provider.send("evm_mine", []);

        await expect(
          gov.propose(targets, values, signatures, callDatas, "do nothing")
        ).to.revertedWith(
          "revert CompoundVotingMachine::propose: one live proposal per proposer, found an already active proposal"
        );
      });
    });

    describe("This function must revert if", () => {
      it("proposer doesnt pass votes threshold", async () => {
        await expect(
          gov
            .connect(signers[4])
            .propose(targets, values, signatures, callDatas, "do nothing")
        ).to.revertedWith(
          "revert CompoundVotingMachine::propose: proposer votes below proposal threshold"
        );
      });

      it("the length of the values, signatures or calldatas arrays are not the same length,", async () => {
        await expect(
          gov.propose(
            targets.concat(root.address),
            values,
            signatures,
            callDatas,
            "do nothing"
          )
        ).to.revertedWith(
          "revert CompoundVotingMachine::propose: proposal function information arity mismatch"
        );

        await expect(
          gov.propose(targets, values.concat(values), signatures, callDatas, "do nothing")
        ).to.revertedWith(
          "revert CompoundVotingMachine::propose: proposal function information arity mismatch"
        );

        await expect(
          gov.propose(
            targets,
            values,
            signatures.concat(signatures),
            callDatas,
            "do nothing"
          )
        ).to.revertedWith(
          "revert CompoundVotingMachine::propose: proposal function information arity mismatch"
        );

        await expect(
          gov.propose(
            targets,
            values,
            signatures,
            callDatas.concat(callDatas),
            "do nothing"
          )
        ).to.revertedWith(
          "revert CompoundVotingMachine::propose: proposal function information arity mismatch"
        );
      });

      it("or if that length is zero or greater than Max Operations.", async () => {
        await expect(gov.propose([], [], [], [], "do nothing")).to.revertedWith(
          "revert CompoundVotingMachine::propose: must provide actions"
        );
      });
    });

    it("This function returns the id of the newly created proposal. # proposalId(n) = succ(proposalId(n-1))", async () => {
      await grep.delegateTo(acct.address);

      await gov.connect(acct).propose(targets, values, signatures, callDatas, "yoot");

      expect(await gov.proposalCount()).to.equal(+trivialProposal.id + 1);
    });

    it("emits log with id and description", async () => {
      await grep.delegateTo(signers[0].address);
      let nextProposal = gov
        .connect(signers[0])
        .propose(targets, values, signatures, callDatas, "second proposal");

      let nextProposalId = await nextProposal
        .then(_ => _.wait())
        .then(_ => gov.proposalCount());
      let proposalBlock = +(await ethers.provider.getBlockNumber());

      expect(nextProposal)
        .to.emit(gov, "ProposalCreated")
        .withArgs(
          nextProposalId,
          signers[0].address,
          targets,
          values,
          signatures,
          callDatas,
          proposalBlock + voteDelay,
          proposalBlock + voteDelay + votePeriod,
          "second proposal"
        );
    });
  });
});
