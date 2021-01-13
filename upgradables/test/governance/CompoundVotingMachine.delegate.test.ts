import { ethers, upgrades } from "hardhat";
import { TypedDataUtils } from "ethers-eip712";
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

const advanceBlocks = async (blocks: number) => {
  let ps = [];
  for (let i = 0; i < blocks; i++) {
    ps.push(ethers.provider.send("evm_mine", []));
    if (i % 5000 === 0) {
      await Promise.all(ps);
      ps = [];
    }
  }
};

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await advanceBlocks(1);
}

async function setTime(seconds) {
  await ethers.provider.send("evm_setTime", [new Date(seconds * 1000)]);
}

const states = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Expired",
  "Executed"
];

describe("CompoundVotingMachine#Delegation", () => {
  let gov: CompoundVotingMachine, root: SignerWithAddress, acct: SignerWithAddress;

  let trivialProposal, targets, values, signatures, callDatas;
  let proposalBlock, proposalId, voteDelay, votePeriod, queuePeriod, gracePeriod;

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
    await grep.mint(acct.address, ethers.BigNumber.from("500000"));

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
    queuePeriod = await gov.queuePeriod().then(_ => _.toNumber());
    gracePeriod = await gov.gracePeriod().then(_ => _.toNumber());
  });

  it("vote with delegated", async () => {
    await grep.delegateTo(acct.address);
    await gov.connect(acct).castVote(proposalId, true);
    expect((await gov.proposals(proposalId)).forVotes).to.eq(BN.from(1500000)); //root + acct
    expect((await gov.getReceipt(proposalId, acct.address)).votes).to.eq(
      BN.from(1500000)
    ); //root + acct
    const delegateeReceipt = await gov.getReceipt(proposalId, root.address);
    expect(delegateeReceipt.votes).to.eq(BN.from(0));
    expect(delegateeReceipt.delegator).to.eq(acct.address);
    expect(delegateeReceipt.hasVoted).to.eq(true);
  });

  it("should revert when voter already voted through delegator", async () => {
    await grep.delegateTo(acct.address);
    await expect(gov.castVote(proposalId, true)).to.revertedWith(
      "CompoundVotingMachine::_castVote: voter already voted"
    );
  });

  it("cancel when undelegated", async () => {
    await grep.delegateTo(signers[4].address);

    await gov
      .connect(signers[4])
      .propose(targets, values, signatures, callDatas, "do nothing");
    let proposalId = await gov.latestProposalIds(signers[4].address);
    await advanceBlocks(1);
    await grep.undelegate();
    await gov.cancel(proposalId);
    expect(states[await gov.state(proposalId)]).to.equal("Canceled");
  });

  it("should not count delegatees that voted", async () => {
    await gov.connect(acct).propose(targets, values, signatures, callDatas, "do nothing");
    let proposalId = await gov.latestProposalIds(acct.address);
    await advanceBlocks(1);
    await gov.castVote(proposalId, false);
    await gov.connect(acct).castVote(proposalId, false);

    expect((await gov.getReceipt(proposalId, acct.address)).votes).to.eq(BN.from(500000));

    const delegateeReceipt = await gov.getReceipt(proposalId, root.address);
    expect(delegateeReceipt.votes).to.eq(BN.from(1000000));
    expect(delegateeReceipt.delegator).to.eq(ethers.constants.AddressZero);
    expect(delegateeReceipt.hasVoted).to.eq(true);
  });
});
