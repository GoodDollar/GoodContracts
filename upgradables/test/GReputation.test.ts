// import { GReputationInstance } from "../types/GReputation";
import MerkleTree from "merkle-tree-solidity";
import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { sign } from "crypto";
import { expect } from "chai";
import { GReputation } from "../types";

const BN = ethers.BigNumber;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

type BlockChainState = {
  stateHash: string;
  hashType: BN;
  totalSupply: BN;
  blockNumber: BN;
};

const getMerkleAndProof = (data, proofIdx) => {
  const elements = data.map(e =>
    Buffer.from(
      ethers.utils
        .keccak256(
          ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [e[0], e[1]])
        )
        .slice(2),
      "hex"
    )
  );

  const merkleTree = new MerkleTree(elements);

  // get the merkle root
  // returns 32 byte buffer
  const merkleRoot = merkleTree.getRoot();

  // generate merkle proof
  // returns array of 32 byte buffers
  const proof = merkleTree.getProof(elements[proofIdx]);
  return { merkleRoot, proof };
};

let grep: GReputation, grepWithOwner: GReputation, identity, gd, bounty;
let founder, repOwner, rep1, rep2, rep3;

const fuseHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fuse"));
describe("GReputation", () => {
  let merkleRoot: any, proof: any;
  before(async () => {
    const GReputation = await ethers.getContractFactory("GReputation");
    let signers = await ethers.getSigners();
    [founder, repOwner, rep1, rep2, rep3] = signers.map(_ => _.address);
    let network = process.env.NETWORK;
    grep = (await upgrades.deployProxy(GReputation, [repOwner], {
      unsafeAllowCustomTypes: true
    })) as GReputation;

    grepWithOwner = await grep.connect(ethers.provider.getSigner(repOwner));
    // create merkle tree
    // expects unique 32 byte buffers as inputs (no hex strings)
    // if using web3.sha3, convert first -> Buffer(web3.sha3('a'), 'hex')
    const elements = [
      [rep1, 1],
      [rep2, 2]
    ].map(e =>
      Buffer.from(
        ethers.utils
          .keccak256(
            ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [e[0], e[1]])
          )
          .slice(2),
        "hex"
      )
    );

    const merkleTree = new MerkleTree(elements);

    // get the merkle root
    // returns 32 byte buffer
    merkleRoot = merkleTree.getRoot();

    // generate merkle proof
    // returns array of 32 byte buffers
    proof = merkleTree.getProof(elements[0]);
  });

  it("should have owner", async () => {
    // const invites = await Invites.deployed();
    expect(await grep.owner()).to.be.equal(repOwner);
  });

  it("should set state hash", async () => {
    const notOwner = await grep
      .setBlockchainStateHash("fuse", fuseHash, BN.from("100"))
      .catch(e => false);
    expect(notOwner).to.be.false;

    await grepWithOwner.setBlockchainStateHash("fuse", fuseHash, 100);
    const first = await grep.activeBlockchains(0);
    const state: BlockChainState = ((await grep.blockchainStates(
      fuseHash,
      0
    )) as unknown) as BlockChainState;
    expect(first).to.be.equal(fuseHash);
    expect(state.stateHash).to.be.equal(fuseHash);
    expect(state.totalSupply.toNumber()).to.be.equal(100);
    expect(state.blockNumber.toNumber()).to.be.greaterThan(0);
  });

  it("should get balanceOf", async () => {
    const repBalance = await grep.balanceOf(founder);
    expect(repBalance.toNumber()).to.be.equal(0);
  });

  it("should accept valid merkle proof", async () => {
    await grepWithOwner.setBlockchainStateHash(
      "fuse",
      "0x" + merkleRoot.toString("hex"),
      100
    );
    await grep.proveBalanceOfAtBlockchain("fuse", rep1, 1, proof);
    const newRep = await grep.balanceOf(rep1);
    expect(newRep.toNumber()).to.be.equal(1);
  });

  it("should reject invalid merkle proof", async () => {
    const e = await grep
      .proveBalanceOfAtBlockchain("fuse", rep3, 10, proof)
      .catch(e => e);
    expect(e.message).to.match(/invalid merkle proof/);
  });

  it("should set new merkle hash", async () => {
    const { merkleRoot, proof } = getMerkleAndProof(
      [
        [rep1, 100],
        [rep2, 200]
      ],
      1
    );
    await grepWithOwner.setBlockchainStateHash(
      "fuse",
      "0x" + merkleRoot.toString("hex"),
      200
    );

    //before proving new rep in new root balance should be 0
    const newRep = await grep.balanceOf(rep1);
    expect(newRep.toNumber()).to.be.equal(0);
    const newRep2 = await grep.balanceOf(rep2);
    expect(newRep2.toNumber()).to.be.equal(0);

    await grep.proveBalanceOfAtBlockchain("fuse", rep2, 200, proof);
    const newRep3 = await grep.balanceOf(rep2);
    expect(newRep3.toNumber()).to.be.equal(200);
  });
});
