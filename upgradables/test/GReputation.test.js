const { default: MerkleTree } = require("merkle-tree-solidity");
const { deployProxy, upgradeProxy } = require("@openzeppelin/truffle-upgrades");
const GReputation = artifacts.require("GReputation.sol");
const Identity = artifacts.require("IIdentity");
const ERC20 = artifacts.require("GoodDollar");

const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("GReputation", ([founder, repOwner, rep1, rep2]) => {
  let grep, identity, gd, bounty;
  before(async () => {
    let network = process.env.NETWORK;
    const cur = await GReputation.deployed().catch(e => {
      if (network === "tdd") return;
      throw e;
    });
    grep = cur;
    //if using tdd we reset and redeploy
    if (network === "tdd") {
      // grep = await GReputation.new();
      grep = await deployProxy(GReputation, [repOwner], {
        unsafeAllowCustomTypes: true
      });
    }
  });

  it("should have owner", async () => {
    // const invites = await Invites.deployed();
    expect(await grep.owner()).to.be.equal(repOwner);
  });

  it("should set state hash", async () => {
    const notOwner = await grep
      .setBlockchainStateHash("fuse", web3.utils.sha3("fuse"), 100)
      .catch(e => false);
    expect(notOwner).to.be.false;
    await grep.setBlockchainStateHash("fuse", web3.utils.sha3("fuse"), 100, {
      from: repOwner
    });
    const first = await grep.activeBlockchains(0);
    const state = await grep.blockchainStates(web3.utils.sha3("fuse"), 0);
    expect(first).to.be.equal(web3.utils.sha3("fuse"));
    expect(state.stateHash).to.be.equal(web3.utils.sha3("fuse"));
    expect(state.totalSupply.toNumber()).to.be.equal(100);
    expect(state.blockNumber.toNumber()).to.be.greaterThan(0);
  });

  it("should get balanceOf", async () => {
    const repBalance = await grep.balanceOf(founder);
    expect(repBalance.toNumber()).to.be.equal(0);
  });

  // create merkle tree
  // expects unique 32 byte buffers as inputs (no hex strings)
  // if using web3.sha3, convert first -> Buffer(web3.sha3('a'), 'hex')
  const elements = [
    [rep1, 1],
    [rep2, 2]
  ].map(e =>
    Buffer.from(
      web3.utils
        .sha3(web3.eth.abi.encodeParameters(["address", "uint256"], [e[0], e[1]]))
        .slice(2),
      "hex"
    )
  );

  const merkleTree = new MerkleTree(elements);

  // get the merkle root
  // returns 32 byte buffer
  const root = merkleTree.getRoot();

  // generate merkle proof
  // returns array of 32 byte buffers
  const proof = merkleTree.getProof(elements[0]);
  it("should accept valid merkle proof", async () => {
    await grep.setBlockchainStateHash("fuse", "0x" + root.toString("hex"), 100, {
      from: repOwner
    });
    await grep.proveBalanceOfAtBlockchain("fuse", rep1, 1, 1, proof);
    const newRep = await grep.balanceOf(rep1);
    expect(newRep.toNumber()).to.be.equal(1);
  });

  it("should reject invalid merkle proof", async () => {
    const e = await grep
      .proveBalanceOfAtBlockchain("fuse", rep1, 10, 1, proof)
      .catch(e => e);
    expect(e.message).to.match(/invalid merkle proof/);
  });
});
