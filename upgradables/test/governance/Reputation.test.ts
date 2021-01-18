import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { Reputation } from "../../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { sign } from "crypto";

describe("Reputation", () => {
  let reputation: Reputation;
  let root, acct, signers;

  before(async () => {
    [root, acct, ...signers] = await ethers.getSigners();
  });

  beforeEach(async () => {
    reputation = (await (
      await ethers.getContractFactory("Reputation")
    ).deploy()) as Reputation;
    await reputation.initialize(root.address);
  });

  it("test setting and getting reputation by the owner", async () => {
    let value;
    await reputation.mint(acct.address, 3131);

    value = await reputation.balanceOf(acct.address);
    expect(value).to.equal(3131);
  });

  it("should be owned by the main account", async () => {
    let owner = await reputation.owner();
    expect(owner).to.equal(root.address);
  });

  it("check permissions", async () => {
    await reputation.mint(signers[1].address, 1000);

    // only the owner can call mint
    await expect(reputation.connect(signers[2]).mint(signers[2], 1000)).to.reverted;

    let account0Rep = await reputation.balanceOf(signers[0].address);
    let account1Rep = await reputation.balanceOf(signers[1].address);
    let account2Rep = await reputation.balanceOf(signers[2].address);
    let totalRep = await reputation.totalSupply();

    expect(account1Rep).to.equal(1000, "account 1 reputation should be 1000");
    expect(account2Rep).to.equal(0, "account 2 reputation should be 0");

    expect(totalRep).to.equal(
      account0Rep.add(account1Rep),
      "total reputation should be sum of account0 and account1"
    );
  });

  it("check total reputation", async () => {
    await reputation.mint(signers[0].address, 2000);
    await reputation.mint(signers[1].address, 1000);
    await reputation.mint(signers[1].address, 500);
    await reputation.mint(signers[2].address, 3000);

    // this tx should have no effect
    let account0Rep = await reputation.balanceOf(signers[0].address);
    let account1Rep = await reputation.balanceOf(signers[1].address);
    let account2Rep = await reputation.balanceOf(signers[2].address);

    // expect(account0Rep, 2001, "account 0 reputation should be 2000");
    expect(account1Rep).to.equal(1500, "account 1 reputation should be 1000 + 500");
    expect(account2Rep).to.equal(3000, "account 2 reputation should be 3000");

    let totalRep = await reputation.totalSupply();

    expect(totalRep).to.equal(
      account0Rep.add(account1Rep).add(account2Rep),
      "total reputation should be sum of accounts"
    );
  });

  it("check total reputation overflow", async () => {
    let BigNumber = ethers.BigNumber;
    let bigNum = BigNumber.from(2)
      .pow(128)
      .sub(1)
      .toString();

    await reputation.mint(signers[0].address, bigNum);

    let totalRepBefore = await reputation.totalSupply();

    await expect(reputation.mint(signers[1].address, 1)).to.reverted;

    let totalRepAfter = await reputation.totalSupply();

    expect(totalRepBefore).to.equal(totalRepAfter);
  });

  it("test reducing reputation", async () => {
    let value;
    await reputation.mint(signers[1].address, 1500);
    await reputation.burn(signers[1].address, 500);

    value = await reputation.balanceOf(signers[1].address);
    let totalRepSupply = await reputation.totalSupply();

    expect(value).to.equal(1000);
    expect(totalRepSupply).to.equal(1000);
  });

  it("totalSupply is 0 on init", async () => {
    const totalSupply = await reputation.totalSupply();

    expect(totalSupply).to.equal(0);
  });

  it("log the Mint event on mint", async () => {
    let tx = await (await reputation.mint(signers[1].address, 1000)).wait();

    expect(tx.events.length).to.eq(1);
    expect(tx.events[0].event).to.eq("Mint");
    expect(tx.events[0].args._to).to.eq(signers[1].address);
    expect(tx.events[0].args._amount).to.eq(1000);
  });

  it("log negative Mint event on negative mint", async () => {
    await reputation.mint(signers[1].address, 1000);
    let tx = await (await reputation.burn(signers[1].address, 200)).wait();

    expect(tx.events.length).to.equal(1);
    expect(tx.events[0].event).to.equal("Burn");
    expect(tx.events[0].args._from).to.equal(signers[1].address);
    expect(tx.events[0].args._amount).to.equal(200);

    tx = await (await reputation.burn(signers[1].address, 1000)).wait();

    expect(tx.events.length).to.equal(1);
    expect(tx.events[0].event).to.equal("Burn");
    expect(tx.events[0].args._from).to.equal(signers[1].address);
    expect(tx.events[0].args._amount).to.equal(800);
  });

  it("mint (plus) should be reflected in totalSupply", async () => {
    await reputation.mint(signers[1].address, 1000);
    let totalSupply = await reputation.totalSupply();

    expect(totalSupply).to.equal(1000);

    await reputation.mint(signers[2].address, 500);
    totalSupply = await reputation.totalSupply();

    expect(totalSupply).to.equal(1500);
  });

  it("mint (plus) should be reflected in balances", async () => {
    await reputation.mint(signers[1].address, 1000);

    const amount = await reputation.balanceOf(signers[1].address);

    expect(amount).to.equal(1000);
  });

  it("mint (minus) should be reflected in totalSupply", async () => {
    await reputation.mint(signers[1].address, 1000);
    let totalSupply = await reputation.totalSupply();
    expect(totalSupply).to.equal(1000);

    await reputation.burn(signers[1].address, 500);
    totalSupply = await reputation.totalSupply();
    expect(totalSupply).to.equal(500);

    await reputation.burn(signers[1].address, 700);
    totalSupply = await reputation.totalSupply();
    expect(totalSupply).to.equal(0);
  });

  it("mint (minus) should be reflected in balances", async () => {
    await reputation.mint(signers[1].address, 1000);
    await reputation.burn(signers[1].address, 500);

    let amount = await reputation.balanceOf(signers[1].address);

    expect(amount).to.equal(500);

    await reputation.burn(signers[1].address, 700);
    amount = await reputation.balanceOf(signers[1].address);
    expect(amount).to.equal(0);
  });

  it("account balance cannot be negative", async () => {
    await reputation.mint(signers[1].address, 1);

    let amount = await reputation.balanceOf(signers[1].address);
    expect(amount).to.equal(1);
    await reputation.burn(signers[1].address, 2);
    let rep = await reputation.balanceOf(signers[1].address);
    expect(rep).to.equal(0);
  });

  it("totalSupply cannot be negative", async () => {
    await reputation.mint(signers[1].address, 1);
    let amount = await reputation.totalSupply();
    expect(amount).to.equal(1);
    await reputation.burn(signers[1].address, 2);
    let rep = await reputation.totalSupply();
    expect(rep).to.equal(0);
  });

  it("balanceOf = balances", async () => {
    const rep1 = Math.floor(Math.random() * 1e6);
    const rep2 = Math.floor(Math.random() * 1e6);
    const rep3 = Math.floor(Math.random() * 1e6);

    await reputation.mint(signers[1].address, rep1);
    await reputation.mint(signers[2].address, rep2);
    await reputation.mint(signers[3].address, rep3);

    const balanceOf1 = await reputation.balanceOf(signers[1].address);
    const balanceOf2 = await reputation.balanceOf(signers[2].address);
    const balanceOf3 = await reputation.balanceOf(signers[3].address);

    expect(balanceOf1).to.equal(rep1);
    expect(balanceOf2).to.equal(rep2);
    expect(balanceOf3).to.equal(rep3);
  });

  it("reputation at ", async () => {
    const rep1 = Math.floor(Math.random() * 1e6);
    await reputation.mint(signers[1].address, rep1);
    var tx = await (await reputation.mint(signers[1].address, rep1)).wait();
    await reputation.mint(signers[3].address, rep1);
    expect(await reputation.totalSupply()).to.equal(rep1 + rep1 + rep1);
    expect(await reputation.totalSupplyAt(tx.blockNumber)).to.equal(rep1 + rep1);
    expect(await reputation.totalSupplyAt(tx.blockNumber - 1)).to.equal(rep1);
    expect(await reputation.balanceOfAt(signers[1].address, tx.blockNumber)).to.equal(
      rep1 + rep1
    );
    expect(await reputation.balanceOfAt(signers[1].address, tx.blockNumber - 1)).to.equal(
      rep1
    );
    expect(await reputation.balanceOfAt(signers[3].address, tx.blockNumber)).to.equal(0);
  });

  it("multible mint at the same block ", async () => {
    let reputationTestHelper = await (
      await ethers.getContractFactory("ReputationTestHelper")
    ).deploy(reputation.address);

    await reputation.transferOwnership(reputationTestHelper.address);
    var rep = 10;
    var times = 3;

    await reputationTestHelper.multipleMint(signers[1].address, rep, times);
    expect(await reputation.totalSupply()).to.equal(rep * times);
    expect(await reputation.balanceOf(signers[1].address)).to.equal(rep * times);

    await reputationTestHelper.multipleBurn(signers[1].address, rep, 2);
    expect(await reputation.totalSupply()).to.equal(rep);
    expect(await reputation.balanceOf(signers[1].address)).to.equal(rep);
  });

  it("balanceOfAt before first mint should be 0 ", async () => {
    const rep1 = Math.floor(Math.random() * 1e6);
    var tx = await (await reputation.mint(signers[1].address, rep1)).wait();
    expect(await reputation.totalSupply()).to.equal(rep1);
    expect(await reputation.totalSupplyAt(tx.blockNumber)).to.equal(rep1);
    expect(await reputation.totalSupplyAt(tx.blockNumber - 1)).to.equal(0);

    expect(await reputation.balanceOfAt(signers[1].address, tx.blockNumber)).to.equal(
      rep1
    );
    expect(await reputation.balanceOfAt(signers[1].address, tx.blockNumber - 1)).to.equal(
      0
    );
  });
});

// });
