// import { GReputationInstance } from "../types/GReputation";
import MerkleTree from "merkle-tree-solidity";
import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { sign } from "crypto";
import { expect } from "chai";
import { GReputation } from "../../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

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
let signers: SignerWithAddress[], founder, repOwner, rep1, rep2, rep3, delegatee;

const fuseHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fuse"));
describe("GReputation", () => {
  let merkleRoot: any, proof: any;
  before(async () => {
    const GReputation = await ethers.getContractFactory("GReputation");
    signers = await ethers.getSigners();
    [founder, repOwner, rep1, rep2, rep3] = signers.map(_ => _.address);
    delegatee = ethers.Wallet.createRandom().connect(ethers.provider);
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

  describe("delegation", async () => {
    it("should allow delegation", async () => {
      expect(
        await grep["balanceOfAt(address,bool,bool,uint256)"](
          rep3,
          false, //without delegation
          true,
          ethers.constants.MaxUint256
        )
      ).to.be.eq(BN.from(0));
      await grep.connect(signers[2]).delegateTo(rep3); //rep1 -> rep3
      expect(
        await grep["balanceOfAt(address,bool,bool,uint256)"](
          rep3,
          false, //without delegation
          true,
          ethers.constants.MaxUint256
        )
      ).to.be.eq(BN.from(0));
      expect(await grep.balanceOf(rep3)).to.be.eq(await grep.balanceOf(rep1)); //with delegation
      expect(await grep.delegatees(rep3, 0)).to.be.eq(rep1);
    });

    it("should allow multiple delegators", async () => {
      const { merkleRoot, proof } = getMerkleAndProof(
        [
          [rep1, 1],
          [rep2, 2]
        ],
        1
      );
      await grep.proveBalanceOfAtBlockchain("fuse", rep2, 2, proof);
      await grep.connect(signers[3]).delegateTo(rep3); //rep2 -> rep3

      //verify delegatees list has been updated
      expect(await grep.delegatees(rep3, 0)).to.be.eq(rep1);
      expect(await grep.delegatees(rep3, 1)).to.be.eq(rep2);

      //verify delegator balance is updated
      expect(await grep.balanceOf(rep3)).to.be.eq(
        BN.from(3) //rep1 + rep2
      );
    });

    it("should allow to change delegator", async () => {
      expect(await grep.balanceOf(rep1)).to.be.eq(BN.from(1)); //proof was submitted
      await grep.connect(signers[3]).delegateTo(rep1); //rep2 -> rep1
      expect(await grep.balanceOf(rep3)).to.be.eq(BN.from(1)); //previous delegator should now be 1 bcause it has only rep1
      expect(await grep.balanceOf(rep1)).to.be.eq(
        BN.from(3) //rep1 + rep2
      );
      expect(await grep.delegatees(rep3, 0)).to.be.eq(rep1); //rep3 had rep1+rep2 now only rep1
      expect(await grep.delegatees(rep1, 0)).to.be.eq(rep2);
      expect(await grep.delegators(rep2)).to.be.eq(rep1);
      expect(await grep.delegators(rep1)).to.be.eq(rep3);
    });

    it("should allow undelegation", async () => {
      await grep.connect(signers[2]).undelegate(); //rep1 -> remove delegattion to rep3
      expect(await grep.balanceOf(rep3)).to.be.eq(BN.from(0));
      expect(await grep.delegators(rep1)).to.be.eq(NULL_ADDRESS);
      expect(await grep.delegatees(rep3, 0).catch(e => true)).to.be.true; //accessing empty array throws
    });
  });

  describe("delegateBySig", () => {
    const Domain = async gov => ({
      name: await grep.name(),
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: grep.address
    });
    const Types = {
      Delegation: [
        { name: "delegator", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" }
      ]
    };

    it("reverts if the signatory is invalid", async () => {
      const delegator = founder,
        nonce = 0,
        expiry = 0;
      await expect(
        grep.delegateBySig(
          delegator,
          nonce,
          expiry,
          0,
          ethers.utils.hexZeroPad("0xbadd", 32),
          ethers.utils.hexZeroPad("0xbadd", 32)
        )
      ).to.revertedWith("revert GReputation::delegateBySig: invalid signature");
    });

    it("reverts if the nonce is bad ", async () => {
      const delegator = founder,
        nonce = 1,
        expiry = 0;

      const signature = await delegatee._signTypedData(await Domain(grep), Types, {
        delegator,
        nonce,
        expiry
      });

      const sig = ethers.utils.splitSignature(signature);
      await expect(
        grep.delegateBySig(delegator, nonce, expiry, sig.v, sig.r, sig.s)
      ).to.revertedWith("revert GReputation::delegateBySig: invalid nonce");
    });

    it("reverts if the signature has expired", async () => {
      const delegator = founder,
        nonce = 0,
        expiry = 0;
      const signature = await delegatee._signTypedData(await Domain(grep), Types, {
        delegator,
        nonce,
        expiry
      });

      const sig = ethers.utils.splitSignature(signature);
      await expect(
        grep.delegateBySig(delegator, nonce, expiry, sig.v, sig.r, sig.s)
      ).to.revertedWith("revert GReputation::delegateBySig: signature expired");
    });

    it("delegates on behalf of the signatory", async () => {
      const delegator = founder,
        nonce = 0,
        expiry = 10e9;
      const signature = await delegatee._signTypedData(await Domain(grep), Types, {
        delegator,
        nonce,
        expiry
      });

      const sig = ethers.utils.splitSignature(signature);
      expect(await grep.delegators(delegatee.address)).to.equal(
        ethers.constants.AddressZero
      );
      const tx = await (
        await grep.delegateBySig(delegator, nonce, expiry, sig.v, sig.r, sig.s)
      ).wait();
      expect(tx.gasUsed).to.lt(120000);
      expect(await grep.delegators(delegatee.address)).to.equal(founder);
    });
  });

  describe("after setting a new merkle hash", async () => {
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
    });

    it("should reset balance to 0 before proof of new state", async () => {
      //before proving new rep in new root balance should be 0
      const newRep = await grep.balanceOf(rep1);
      expect(newRep.toNumber()).to.be.equal(0);
      const newRep2 = await grep.balanceOf(rep2);
      expect(newRep2.toNumber()).to.be.equal(0);
    });

    it("should prove balance in new state", async () => {
      const { proof } = getMerkleAndProof(
        [
          [rep1, 100],
          [rep2, 200]
        ],
        1
      );

      await grep.proveBalanceOfAtBlockchain("fuse", rep2, 200, proof);
      const newRep3 = await grep.balanceOf(rep2);
      expect(newRep3.toNumber()).to.be.equal(200);
    });

    it("should allow delegation of new state balance", async () => {
      expect(await grep.balanceOf(rep3)).to.be.eq(BN.from(0));
      await grep.connect(signers[3]).delegateTo(rep3); //rep2=signers[3]
      expect(await grep.balanceOf(rep3)).to.be.eq(await grep.balanceOf(rep2));
    });

    it("should zero delegator balance after new state hash", async () => {
      const { merkleRoot, proof } = getMerkleAndProof(
        [
          [rep1, 100],
          [rep2, 200],
          [rep3, 10]
        ],
        1
      );
      await grepWithOwner.setBlockchainStateHash(
        "fuse",
        "0x" + merkleRoot.toString("hex"),
        200
      );
      expect(await grep.balanceOf(rep3)).to.be.eq(BN.from(0));
    });

    it("should still be delegated after new state", async () => {
      const { merkleRoot, proof } = getMerkleAndProof(
        [
          [rep1, 100],
          [rep2, 200],
          [rep3, 10]
        ],
        1
      );
      await grep.proveBalanceOfAtBlockchain("fuse", rep2, 200, proof);
      expect(await grep.balanceOf(rep3)).to.be.eq(BN.from(200)); //be equal to rep2
    });

    it("should include own rep in delegated balance after new state", async () => {
      const { merkleRoot, proof } = getMerkleAndProof(
        [
          [rep1, 100],
          [rep2, 200],
          [rep3, 10]
        ],
        2
      );
      await grep.proveBalanceOfAtBlockchain("fuse", rep3, 10, proof);
      expect(await grep.balanceOf(rep3)).to.be.eq(BN.from(210)); //be equal to rep2  + rep3
    });
  });
});
