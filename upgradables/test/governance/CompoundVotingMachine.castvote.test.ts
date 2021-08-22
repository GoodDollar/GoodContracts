import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
// import { deployContract, deployMockContract, MockContract } from "ethereum-waffle";
import { GReputation, CompoundVotingMachine } from "../../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { createDAO } from "../helpers";

const BN = ethers.BigNumber;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

let grep: GReputation, grepWithOwner: GReputation, identity, gd, bounty;
let signers: SignerWithAddress[], founder, repOwner, rep1, rep2, rep3;

const encodeParameters = (types, values) =>
  ethers.utils.defaultAbiCoder.encode(types, values);

describe("CompoundVotingMachine#CastVote", () => {
  let gov: CompoundVotingMachine, root: SignerWithAddress, acct: SignerWithAddress;

  let trivialProposal, targets, values, signatures, callDatas;
  let proposalBlock, proposalId, voteDelay, votePeriod;

  before(async () => {
    [root, acct, ...signers] = await ethers.getSigners();
    const GReputation = await ethers.getContractFactory("GReputation");
    const CompoundVotingMachine = await ethers.getContractFactory(
      "CompoundVotingMachine"
    );

    let { daoCreator } = await createDAO();

    grep = (await upgrades.deployProxy(GReputation, [root.address], {
      unsafeAllowCustomTypes: true,
      kind: "transparent"
    })) as GReputation;

    gov = (await CompoundVotingMachine.deploy(
      await daoCreator.avatar(),
      grep.address,
      5760
    )) as CompoundVotingMachine;

    await grep.mint(root.address, ethers.BigNumber.from("1000000"));
    targets = [acct.address];
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

  describe("We must revert if:", () => {
    it("There does not exist a proposal with matching proposal id where the current block number is between the proposal's start block (exclusive) and end block (inclusive)", async () => {
      await expect(gov.castVote(proposalId, true)).to.revertedWith(
        "CompoundVotingMachine::_castVote: voting is closed"
      );
    });

    it("Such proposal already has an entry in its voters set matching the sender", async () => {
      await gov.connect(signers[0]).castVote(proposalId, true);
      await expect(gov.connect(signers[0]).castVote(proposalId, true)).to.revertedWith(
        "CompoundVotingMachine::_castVote: voter already voted"
      );
    });
  });

  describe("Otherwise", () => {
    it("we add the sender to the proposal's voters set", async () => {
      let receipt = await gov.getReceipt(proposalId, signers[2].address);
      expect(receipt.hasVoted).to.equal(false);

      await gov.connect(signers[2]).castVote(proposalId, true);
      receipt = await gov.getReceipt(proposalId, signers[2].address);

      expect(receipt.hasVoted).to.equal(true);
    });

    describe("and we take the balance returned by GetPriorVotes for the given sender and the proposal's start block, which may be zero,", () => {
      it("and we add that ForVotes", async () => {
        let actor = signers[3];
        await grep.mint(actor.address, ethers.BigNumber.from("100001"));

        await gov
          .connect(actor)
          .propose(targets, values, signatures, callDatas, "do nothing");
        await ethers.provider.send("evm_mine", []);
        await ethers.provider.send("evm_mine", []);
        let proposalId = await gov.latestProposalIds(actor.address);

        let beforeFors = (await gov.proposals(proposalId)).forVotes;
        await gov.connect(actor).castVote(proposalId, true);

        let aftreFors = (await gov.proposals(proposalId)).forVotes;
        expect(aftreFors).to.equal(beforeFors.add(ethers.BigNumber.from("100001")));
      });

      it("or AgainstVotes corresponding to the caller's support flag.", async () => {
        let actor = signers[4];

        await grep.mint(actor.address, ethers.BigNumber.from("100001"));
        console.log(await grep.balanceOf(actor.address).then(_ => _.toString()));
        let tx = await gov
          .connect(actor)
          .propose(targets, values, signatures, callDatas, "do nothing");
        await ethers.provider.send("evm_mine", []);
        await ethers.provider.send("evm_mine", []);
        let proposalId = await gov.latestProposalIds(actor.address);

        let beforeAgainsts = (await gov.proposals(proposalId)).againstVotes;
        tx = await gov.connect(actor).castVote(proposalId, false);
        let afterAgainsts = (await gov.proposals(proposalId)).againstVotes;
        expect(afterAgainsts).to.equal(
          beforeAgainsts.add(ethers.BigNumber.from("100001"))
        );
      });

      describe("castVoteBySig", () => {
        const Domain = async gov => ({
          name: await gov.name(),
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: gov.address
        });
        const Types = {
          Ballot: [
            { name: "proposalId", type: "uint256" },
            { name: "support", type: "bool" }
          ]
        };

        it("reverts if the signatory is invalid", async () => {
          await expect(
            gov.castVoteBySig(
              proposalId,
              false,
              0,
              ethers.utils.hexZeroPad("0xbac", 32),
              ethers.utils.hexZeroPad("0xbada", 32)
            )
          ).to.revertedWith("CompoundVotingMachine::castVoteBySig: invalid signature");
        });

        describe("casts vote on behalf of the signatory", async () => {
          let receipt;
          it("should cast vote", async () => {
            let wallet = ethers.Wallet.createRandom({ gasPrice: 10000000 });
            await acct.sendTransaction({
              to: wallet.address,
              value: ethers.utils.parseEther("9999")
            });

            wallet = wallet.connect(ethers.provider);
            let actor = wallet;
            await grep.mint(actor.address, ethers.BigNumber.from("100001"));
            await gov
              .connect(actor)
              .propose(targets, values, signatures, callDatas, "do nothing");
            let proposalId = await gov.latestProposalIds(actor.address);

            const signature = await wallet._signTypedData(await Domain(gov), Types, {
              proposalId: proposalId,
              support: true
            });

            const sig = ethers.utils.splitSignature(signature);

            let beforeFors = (await gov.proposals(proposalId)).forVotes;
            await ethers.provider.send("evm_mine", []);
            let tx = await gov.castVoteBySig(proposalId, true, sig.v, sig.r, sig.s);
            receipt = await tx.wait();
            let afterFors = (await gov.proposals(proposalId)).forVotes;
            expect(afterFors).to.equal(beforeFors.add(ethers.BigNumber.from("100001")));
          });

          xit("gas costs for cast vote by sig", async () => {
            expect(receipt.gasUsed.toNumber()).to.be.lt(80000);
          });
        });

        // xit("gas costs for multiple sigs", async () => {
        //   let wallet = ethers.Wallet.createRandom();

        //   wallet = wallet.connect(ethers.provider);
        //   let actor = wallet;
        //   await grep.mint(actor.address, ethers.BigNumber.from("100001"));
        //   await gov
        //     .connect(actor)
        //     .propose(targets, values, signatures, callDatas, "do nothing");
        //   let proposalId = await gov.latestProposalIds(actor.address);

        //   const sigsFor = [];
        //   const sigsAgainst = [];
        //   const createSig = async () => {
        //     let wallet = ethers.Wallet.createRandom();
        //     wallet = wallet.connect(ethers.provider);
        //     let actor = wallet;
        //     // await grep.mint(actor.address, ethers.BigNumber.from("1"));
        //     let support = Math.random() < 0.5;
        //     const signature = await wallet._signTypedData(await Domain(gov), Types, {
        //       proposalId: proposalId,
        //       support
        //     });
        //     const sig = ethers.utils.splitSignature(signature);
        //     if (support)
        //       sigsFor.push({
        //         support,
        //         v: sig.v,
        //         r: sig.r,
        //         s: sig.s
        //       });
        //     else
        //       sigsAgainst.push({
        //         support,
        //         v: sig.v,
        //         r: sig.r,
        //         s: sig.s
        //       });
        //   };
        //   const ps = [];
        //   for (let i = 1; i < 100; i++) {
        //     ps.push(createSig());
        //   }
        //   await Promise.all(ps);

        //   await ethers.provider.send("evm_mine", []);

        //   let tx = await gov.ecRecoverTest(proposalId, sigsFor, sigsAgainst);
        //   let receipt = await tx.wait();
        //   console.log("gas for sigs:", {
        //     i: sigsFor.length + sigsAgainst.length,
        //     gas: receipt.gasUsed.toNumber()
        //   });
        // });
      });
    });
  });
});
