import hre, { ethers, upgrades } from "hardhat";
import { expect } from "chai";
// import { deployContract, deployMockContract, MockContract } from "ethereum-waffle";
import { GReputation, CompoundVotingMachine } from "../../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Wallet } from "ethers";
import { deployMockContract, MockContract } from "ethereum-waffle";
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
  "ActiveTimelock",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Expired",
  "Executed"
];

describe("CompoundVotingMachine#DAOScheme", () => {
  let gov: CompoundVotingMachine, root: SignerWithAddress, acct: SignerWithAddress;

  let trivialProposal, targets, values, signatures, callDatas;
  let proposalBlock, proposalId, voteDelay, votePeriod, queuePeriod, gracePeriod;
  let wallet: Wallet;
  let avatar, mock, Controller;

  before(async () => {
    [root, acct, ...signers] = await ethers.getSigners();

    const GReputation = await ethers.getContractFactory("GReputation");
    const CompoundVotingMachine = await ethers.getContractFactory(
      "CompoundVotingMachine"
    );

    grep = (await upgrades.deployProxy(GReputation, [root.address], {
      unsafeAllowCustomTypes: true
    })) as GReputation;

    let { daoCreator, controller, avatar: av } = await createDAO();
    Controller = controller;
    avatar = av;
    gov = (await CompoundVotingMachine.deploy(
      avatar,
      grep.address,
      5760
    )) as CompoundVotingMachine;

    //set voting machiine as scheme with permissions
    await daoCreator.setSchemes(
      avatar,
      [gov.address],
      [ethers.constants.HashZero],
      ["0x0000001F"],
      ""
    );

    await grep.mint(root.address, ethers.BigNumber.from("1000000"));
    await grep.mint(acct.address, ethers.BigNumber.from("500000"));

    //set avatar as owner of rep
    await grep.transferOwnership(avatar);

    queuePeriod = await gov.queuePeriod().then(_ => _.toNumber());

    let mockABI = ["function rec() payable"];
    mock = await deployMockContract(root, mockABI);
    mock.mock.rec.returns();
  });

  it("Should have genericCall Permission", async () => {
    let targets = [grep.address];
    let values = ["0"];
    let signatures = ["mint(address,uint256)"];
    let callDatas = [
      encodeParameters(
        ["address", "uint256"],
        [acct.address, ethers.BigNumber.from("500000")]
      )
    ];

    await gov.propose(targets, values, signatures, callDatas, "mint rep");
    let proposalBlock = +(await ethers.provider.getBlockNumber());
    let proposalId = await gov.latestProposalIds(root.address);
    await advanceBlocks(1);
    await gov.castVote(proposalId, true);
    await increaseTime(queuePeriod);
    expect(states[await gov.state(proposalId)]).to.equal("Succeeded");
    await gov.execute(proposalId);
    expect(states[await gov.state(proposalId)]).to.equal("Executed");

    //acct should now have 1M after proposal minted rep
    expect(await grep.balanceOf(acct.address)).to.equal(ethers.BigNumber.from("1000000"));
  });

  it("Should use value passed to execute", async () => {
    let wallet = ethers.Wallet.createRandom();
    let targets = [mock.address];
    let values = [ethers.utils.parseEther("1")];
    let signatures = ["rec()"];
    let callDatas = ["0x00"];

    await gov.propose(targets, values, signatures, callDatas, "send eth");
    let proposalBlock = +(await ethers.provider.getBlockNumber());
    let proposalId = await gov.latestProposalIds(root.address);
    await advanceBlocks(1);
    await gov.castVote(proposalId, true);
    await increaseTime(queuePeriod);
    expect(states[await gov.state(proposalId)]).to.equal("Succeeded");
    await gov.execute(proposalId, { value: ethers.utils.parseEther("1") });
    expect(states[await gov.state(proposalId)]).to.equal("Executed");

    //acct should now have 1M after proposal minted rep
    const balance = await ethers.provider.getBalance(mock.address);
    const avatarBalance = await ethers.provider.getBalance(avatar);

    expect(avatarBalance).to.eq(0);
    expect(balance).to.eq(ethers.utils.parseEther("1"));
  });

  it("should be able to call Controller permissioned methods", async () => {
    let wallet = ethers.Wallet.createRandom();
    let u = await hre.artifacts.readArtifact("Controller");
    let c = new ethers.Contract(Controller, u.abi, root);
    expect(await c.isSchemeRegistered(gov.address, avatar)).to.eq(true);

    let targets = [Controller];
    let values = ["0"];
    let signatures = ["unregisterSelf(address)"];
    let callDatas = [encodeParameters(["address"], [avatar])];

    await gov.propose(targets, values, signatures, callDatas, "send eth");
    let proposalBlock = +(await ethers.provider.getBlockNumber());
    let proposalId = await gov.latestProposalIds(root.address);
    await advanceBlocks(1);
    await gov.castVote(proposalId, true);
    await increaseTime(queuePeriod);

    const tx = await (await gov.execute(proposalId)).wait();
    expect(states[await gov.state(proposalId)]).to.equal("Executed");
    expect(await c.isSchemeRegistered(gov.address, avatar)).to.eq(false);
  });
});
