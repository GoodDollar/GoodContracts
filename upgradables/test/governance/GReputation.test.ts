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
let signers: SignerWithAddress[], founder, repOwner, rep1, rep2, rep3, delegator;

const fuseHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fuse"));
describe("GReputation", () => {
  let merkleRoot: any, proof: any;
  before(async () => {
    const GReputation = await ethers.getContractFactory("GReputation");
    signers = await ethers.getSigners();
    [founder, repOwner, rep1, rep2, rep3] = signers.map(_ => _.address);
    delegator = ethers.Wallet.createRandom().connect(ethers.provider);
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

  it("should get balanceOf", async () => {
    const repBalance = await grep.balanceOf(founder);
    expect(repBalance.toNumber()).to.be.equal(0);
  });

  it("should set rootState", async () => {
    await grepWithOwner.setBlockchainStateHash(
      "rootState",
      "0x" + merkleRoot.toString("hex"),
      100
    );
    await grep.proveBalanceOfAtBlockchain("rootState", rep1, 1, proof);

    //root states changes the core balance
    const newRep = await grep.balanceOf(rep1);
    expect(newRep.toNumber()).to.be.equal(1);

    const newVotes = await grep.getVotes(rep1);
    expect(newVotes.toNumber()).to.be.equal(1);
  });

  it("should reject invalid merkle proof", async () => {
    const e = await grep
      .proveBalanceOfAtBlockchain("rootState", rep3, 10, proof)
      .catch(e => e);
    expect(e.message).to.match(/invalid merkle proof/);
  });

  describe("delegation", async () => {
    it("should allow delegation", async () => {
      expect(await grep.balanceOf(rep3)).to.be.eq(BN.from(0));
      await grep.connect(signers[2]).delegateTo(rep3); //rep1 -> rep3

      expect(await grep.getVotes(rep3)).to.be.eq(await grep.balanceOf(rep1)); //with delegation
      expect(await grep.getVotes(rep1), "delegator should now have 0 votes").to.be.eq(
        BN.from(0)
      );
      expect(await grep.delegateOf(rep1)).to.be.eq(rep3);
    });

    it("should allow multiple delegates", async () => {
      const { merkleRoot, proof } = getMerkleAndProof(
        [
          [rep1, 1],
          [rep2, 2]
        ],
        1
      );
      await grep.proveBalanceOfAtBlockchain("rootState", rep2, 2, proof);
      await grep.connect(signers[3]).delegateTo(rep3); //rep2 -> rep3

      //verify delegators list has been updated
      expect(await grep.delegateOf(rep1)).to.be.eq(rep3);
      expect(await grep.delegateOf(rep2)).to.be.eq(rep3);

      //verify delegate balance is updated
      expect(await grep.getVotes(rep3)).to.be.eq(
        BN.from(3) //rep1 + rep2
      );

      //verify delegators dont have any votes
      expect(await grep.getVotes(rep1)).to.be.eq(BN.from(0));
      expect(await grep.getVotes(rep2)).to.be.eq(BN.from(0));
    });

    it("should allow to change delegate", async () => {
      expect(await grep.balanceOf(rep1)).to.be.eq(BN.from(1)); //proof was submitted
      await grep.connect(signers[3]).delegateTo(rep1); //rep2 -> rep1
      expect(await grep.getVotes(rep3)).to.be.eq(BN.from(1)); //previous delegate should now be 1 bcause it has only rep1
      expect(await grep.getVotes(rep1)).to.be.eq(
        BN.from(2) //rep2
      );

      expect(await grep.delegates(rep2)).to.be.eq(rep1);
      expect(await grep.delegates(rep1)).to.be.eq(rep3);
    });

    it("should allow undelegation", async () => {
      await grep.connect(signers[2]).undelegate(); //rep1 -> remove delegattion to rep3
      expect(await grep.balanceOf(rep3)).to.be.eq(BN.from(0));
      expect(await grep.getVotes(rep3)).to.be.eq(BN.from(0));
      expect(await grep.getVotes(rep1)).to.be.eq(BN.from(3)); //rep2 delegating to rep1 + rep1 votes
      expect(await grep.balanceOf(rep1)).to.be.eq(BN.from(1));

      expect(await grep.delegates(rep1)).to.be.eq(rep1);
    });

    it("should update delegate votes after mint to delegate", async () => {
      const delegateOf = await grep.delegates(rep2);
      const prevVotes = await grep.getVotes(delegateOf);
      await grepWithOwner.mint(rep2, 10);
      expect(await grep.getVotes(delegateOf)).to.be.eq(prevVotes.add(10));

      expect(await grep.delegates(rep1)).to.be.eq(rep1);
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
        { name: "delegate", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" }
      ]
    };

    it("reverts if the signatory is invalid", async () => {
      const delegate = founder,
        nonce = 0,
        expiry = 0;
      await expect(
        grep.delegateBySig(
          delegate,
          nonce,
          expiry,
          0,
          ethers.utils.hexZeroPad("0xbadd", 32),
          ethers.utils.hexZeroPad("0xbadd", 32)
        )
      ).to.revertedWith("revert GReputation::delegateBySig: invalid signature");
    });

    it("reverts if the nonce is bad ", async () => {
      const delegate = founder,
        nonce = 1,
        expiry = 0;

      const signature = await delegator._signTypedData(await Domain(grep), Types, {
        delegate,
        nonce,
        expiry
      });

      const sig = ethers.utils.splitSignature(signature);
      await expect(
        grep.delegateBySig(delegate, nonce, expiry, sig.v, sig.r, sig.s)
      ).to.revertedWith("revert GReputation::delegateBySig: invalid nonce");
    });

    it("reverts if the signature has expired", async () => {
      const delegate = founder,
        nonce = 0,
        expiry = 0;
      const signature = await delegator._signTypedData(await Domain(grep), Types, {
        delegate,
        nonce,
        expiry
      });

      const sig = ethers.utils.splitSignature(signature);
      await expect(
        grep.delegateBySig(delegate, nonce, expiry, sig.v, sig.r, sig.s)
      ).to.revertedWith("revert GReputation::delegateBySig: signature expired");
    });

    it("delegates on behalf of the signatory", async () => {
      const delegate = founder,
        nonce = 0,
        expiry = 10e9;
      const signature = await delegator._signTypedData(await Domain(grep), Types, {
        delegate,
        nonce,
        expiry
      });

      const sig = ethers.utils.splitSignature(signature);
      expect(await grep.delegates(delegator.address)).to.equal(
        ethers.constants.AddressZero
      );
      const tx = await (
        await grep.delegateBySig(delegate, nonce, expiry, sig.v, sig.r, sig.s)
      ).wait();
      expect(tx.gasUsed).to.lt(120050);
      expect(await grep.delegates(delegator.address)).to.equal(founder);
    });
  });

  describe("setting a blockchain merkle hash", async () => {
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

    it("should not reset core balance", async () => {
      //before proving new rep in new root balance should be 0
      const newRep = await grep.balanceOf(rep1);
      expect(newRep.toNumber()).to.be.gt(0);
      const newRep2 = await grep.balanceOf(rep2);
      expect(newRep2.toNumber()).to.be.gt(0);
    });

    it("should prove balance in new state", async () => {
      const prevRep = await grep.balanceOf(rep2);
      const prevVotes = await grep.getVotes(rep2);
      const { proof } = getMerkleAndProof(
        [
          [rep1, 100],
          [rep2, 200]
        ],
        1
      );

      await grep.proveBalanceOfAtBlockchain("fuse", rep2, 200, proof);
      const newRep = await grep.balanceOf(rep2);
      expect(newRep).to.be.equal(prevRep); //core rep should not change
      const newVotes = await grep.getVotes(rep2);

      expect(newVotes).to.be.equal(prevVotes.add(200));
    });

    it("should allow delegation of new state balance", async () => {
      expect(await grep.getVotes(rep3)).to.be.eq(BN.from(0));
      await grep.connect(signers[3]).delegateTo(rep3); //rep2=signers[3]
      expect(await grep.getVotes(rep3)).to.be.eq(await grep.balanceOf(rep2));
    });

    it("should not effect delegate balance after new state hash", async () => {
      const prevDelegated = await grep.getVotes(rep3);
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
      expect(await grep.getVotes(rep3)).to.be.eq(prevDelegated);
    });

    it("should not effect delegate balance after new blockchain proof", async () => {
      const prevVotes = await grep.getVotes(rep3);
      const { merkleRoot, proof } = getMerkleAndProof(
        [
          [rep1, 100],
          [rep2, 200],
          [rep3, 10]
        ],
        1
      );
      await grep.proveBalanceOfAtBlockchain("fuse", rep2, 200, proof);
      expect(await grep.getVotes(rep3)).to.be.eq(prevVotes); //be equal to rep2
    });

    it("should include own rep in votes balance after new state", async () => {
      const prevVotes = await grep.getVotes(rep3);
      const { merkleRoot, proof } = getMerkleAndProof(
        [
          [rep1, 100],
          [rep2, 200],
          [rep3, 10]
        ],
        2
      );
      await grep.proveBalanceOfAtBlockchain("fuse", rep3, 10, proof);
      expect(await grep.getVotes(rep3)).to.be.eq(prevVotes.add(10)); //add new blockchain rep
    });

    it("should report blockchain balance after proof of new state", async () => {
      //before proving new rep in new root balance should be 0
      const newRep = await grep.getVotesAtBlockchain(
        fuseHash,
        rep1,
        ethers.constants.MaxUint256
      );
      expect(newRep.toNumber()).to.be.equal(0); //not prooved

      const newRep2 = await grep.getVotesAtBlockchain(
        fuseHash,
        rep2,
        ethers.constants.MaxUint256
      );
      expect(newRep2.toNumber()).to.be.equal(200);

      const newRep3 = await grep.getVotesAtBlockchain(
        fuseHash,
        rep3,
        ethers.constants.MaxUint256
      );
      expect(newRep3.toNumber()).to.be.equal(10);
    });

    describe("overriding with a new state hash", async () => {
      it("should set a new state hash", async () => {
        const notOwner = await grep
          .setBlockchainStateHash("fuse", fuseHash, BN.from("100"))
          .catch(e => false);
        expect(notOwner).to.be.false;

        await grepWithOwner.setBlockchainStateHash("fuse", fuseHash, 100);
        const first = await grep.activeBlockchains(0);
        const state: BlockChainState = ((await grep.blockchainStates(
          fuseHash,
          2 //third state of fuse
        )) as unknown) as BlockChainState;
        expect(first).to.be.equal(fuseHash);
        expect(state.stateHash).to.be.equal(fuseHash);
        expect(state.totalSupply.toNumber()).to.be.equal(100);
        expect(state.blockNumber.toNumber()).to.be.greaterThan(0);
      });

      it("should reset blockchain balance to 0 before proof of new state", async () => {
        //before proving new rep in new root balance should be 0
        const newRep = await grep.getVotesAtBlockchain(
          fuseHash,
          rep1,
          ethers.constants.MaxUint256
        );
        expect(newRep.toNumber()).to.be.equal(0);
        const newRep2 = await grep.getVotesAtBlockchain(
          fuseHash,
          rep2,
          ethers.constants.MaxUint256
        );
        expect(newRep2.toNumber()).to.be.equal(0);
      });
    });
  });

  describe("real example of airdrop", async () => {
    it("should set a new state hash", async () => {
      expect(
        await grepWithOwner.setBlockchainStateHash(
          "realState",
          "0x5c42f9dd07d58ddfce08f39159eb5d1da7ce89e2f8ed4488c19163cffd9760c2",
          2400042
        )
      ).to.not.throw;
    });

    it("should prove real proof", async () => {
      const prevVotes = await grep.getVotes("0xe28f701A8a94E18220A5d800Bb06ae20e8eDd6c8");
      const proof = [
        "0x6429597531910c38ed2ac8f73a890245ef7f67db49e1a947049fe8d987b0ee09",
        "0x2225a8a896fbfc6d8b9d15574ff43d6025a1e811b790df431b84e08dc3287ce4",
        "0xa83c67b8ca77de2b6cd01571d03d21a61df664f8128c805b1b27c202862ac5f8",
        "0xb11cfc679f76ed949270ef345f8268571b9ed317f25970332a0e0fb3a4feaea8",
        "0xb93eefff7353452bcb68e1af11b94ac4aa0f59e3dc6770027a7f9ac3a8d55d87",
        "0xed638b497e00aec652c528d142de5f261238cf99395c93472820bcd8b55ef5bb",
        "0xfa3ef97384d7e03d0980873fd18ec3ae7f57d266f4d6495e631257c5b5c11081",
        "0x66cbd6385735911728866e1208db6ca94698c6ef726dd06334e80d81cf0e59e4",
        "0xf6c5fbaf4bd80f598dae62ca88af460bbdc618739959c1f0a00a8ecabe2be51d",
        "0x9fba3d9d96b8c268d322548cc41b1c9bb37b8bf7108184fc33784b3f089f45dc",
        "0x0582b0084b238128163879a707f336e6932ce8ddcfe1fdfce9dbc37ab7c430a5",
        "0x278db5f9072c404b1d8d9baba030c171943a4a5cdc51e8c9b21fee01f2fe32bd",
        "0xe3d136bf3ea1fbed0055294cd43a0fd4b52d6388ecb524627a88b73db57a3429",
        "0x2c8245c2d4c0e4ac0ae22754005d62d994aabe2bdb05f46cfe3ac63a4bf72a32"
      ];
      await grep.proveBalanceOfAtBlockchain(
        "realState",
        "0xe28f701A8a94E18220A5d800Bb06ae20e8eDd6c8",
        1199,
        proof
      );
      expect(await grep.getVotes("0xe28f701A8a94E18220A5d800Bb06ae20e8eDd6c8")).to.be.eq(
        prevVotes.add(1199)
      ); //add new blockchain rep
    });
  });
});
