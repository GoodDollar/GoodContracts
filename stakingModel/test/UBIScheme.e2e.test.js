const SimpleDAIStaking = artifacts.require("SimpleDAIStaking");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");
const GoodReserve = artifacts.require("GoodReserveCDai");
const GoodDollar = artifacts.require("GoodDollar");
const GoodFundsManager = artifacts.require("GoodFundManager");
const Controller = artifacts.require("Controller");
const Identity = artifacts.require("Identity");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const FundManagerSetReserve = artifacts.require("FundManagerSetReserve");
const UBI = artifacts.require("UBIScheme");
const FirstClaimPool = artifacts.require("FirstClaimPoolMock");
const AddMinter = artifacts.require("AddMinter");

const fse = require("fs-extra");

const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
export const NULL_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const NETWORK = "test";
const MAX_INACTIVE_DAYS = 15;

async function proposeAndRegister(
  addr,
  registrar,
  proposalId,
  absoluteVote,
  avatarAddress,
  fnd
) {
  const transaction = await registrar.proposeScheme(
    avatarAddress,
    addr,
    NULL_HASH,
    "0x00000010",
    NULL_HASH
  );
  proposalId = transaction.logs[0].args._proposalId;
  const voteResult = await absoluteVote.vote(proposalId, 1, 0, fnd);
  return voteResult.logs.some(e => e.event === "ExecuteProposal");
}

async function increaseDays(days = 1) {
  const id = await Date.now();
  const duration = days * 86400;
  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [duration],
      id: id + 1
    },
    () => {}
  );
  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_mine",
      id: id + 1
    },
    () => {}
  );
}

async function next_interval() {
  let blocks = 5760;
  let batch = web3.createBatch();
  for (let i = 0; i < blocks; ++i)
    batch.add(web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine", id: 123 }, () => {}));
  batch.execute();
}

contract("UBIScheme - network e2e tests", ([founder, claimer, fisherman]) => {
  let dai,
    cDAI,
    simpleStaking,
    goodReserve,
    goodFundManager,
    goodDollar,
    controller,
    ubi,
    firstClaimPool,
    identity;
  let avatarAddress, registrar, absoluteVote, proposalId, setReserve, addMinter;

  before(async function() {
    let network = process.env.NETWORK;
    if (network === "tdd") {
      this.skip();
    }
    const staking_file = await fse.readFile("releases/deployment.json", "utf8");
    const dao_file = await fse.readFile("../releases/deployment.json", "utf8");
    const staking_deployment = await JSON.parse(staking_file);
    const dao_deployment = await JSON.parse(dao_file);
    const staking_addresses = staking_deployment[NETWORK];
    const dao_addresses = dao_deployment[NETWORK];
    avatarAddress = dao_addresses.Avatar;
    dai = await DAIMock.at(staking_addresses.DAI);
    cDAI = await cDAIMock.at(staking_addresses.cDAI);
    simpleStaking = await SimpleDAIStaking.at(staking_addresses.DAIStaking);
    goodReserve = await GoodReserve.at(staking_addresses.Reserve);
    goodFundManager = await GoodFundsManager.at(staking_addresses.FundManager);
    controller = await Controller.at(dao_addresses.Controller);
    ubi = await UBI.at(staking_addresses.UBIScheme);
    firstClaimPool = await FirstClaimPool.at(staking_addresses.FirstClaimPool);
    identity = await Identity.at(dao_addresses.Identity);
    goodDollar = await GoodDollar.at(dao_addresses.GoodDollar);
    registrar = await SchemeRegistrar.at(dao_addresses.SchemeRegistrar);
    absoluteVote = await AbsoluteVote.at(dao_addresses.AbsoluteVote);
    await identity.addWhitelisted(claimer);
    // schemes
    addMinter = await AddMinter.new(avatarAddress, goodReserve.address);
    setReserve = await FundManagerSetReserve.new(
      avatarAddress,
      goodFundManager.address,
      goodReserve.address
    );
    // sets the reserve in the fundmanager
    await proposeAndRegister(
      setReserve.address,
      registrar,
      proposalId,
      absoluteVote,
      avatarAddress,
      founder
    );
    await setReserve.setReserve();
    let amount = 1e8;
    await dai.mint(web3.utils.toWei("1000", "ether"));
    dai.approve(cDAI.address, web3.utils.toWei("1000", "ether"));
    await cDAI.mint(web3.utils.toWei("1000", "ether"));
    await cDAI.approve(goodReserve.address, amount);
    await goodReserve.buy(cDAI.address, amount, 0);
    let gdbalance = await goodDollar.balanceOf(founder);
    await goodDollar.transfer(firstClaimPool.address, gdbalance.toString());
    await next_interval();
    // transfers funds to the ubi
    await goodFundManager.transferInterest(simpleStaking.address);
  });

  it("should award a new user with the award amount on first time execute claim", async () => {
    await increaseDays();
    await identity.authenticate(claimer);
    let claimerBalance1 = await goodDollar.balanceOf(claimer);
    let ce = await ubi.checkEntitlement({ from: claimer });
    await ubi.claim({ from: claimer });
    let claimerBalance2 = await goodDollar.balanceOf(claimer);
    expect(claimerBalance2.sub(claimerBalance1).toNumber()).to.be.equal(ce.toNumber());
  });

  it("should not be able to fish an active user", async () => {
    let error = await ubi.fish(claimer, { from: fisherman }).catch(e => e);
    await goodDollar.balanceOf(fisherman);
    expect(error.message).to.have.string("is not an inactive user");
  });

  it("should be able to fish inactive user", async () => {
    await increaseDays(MAX_INACTIVE_DAYS);
    let balance1 = await goodDollar.balanceOf(fisherman);
    await ubi.fish(claimer, { from: fisherman });
    let isFished = await ubi.fishedUsersAddresses(claimer);
    let balance2 = await goodDollar.balanceOf(fisherman);
    let dailyUbi = await ubi.dailyUbi();
    expect(isFished).to.be.true;
    expect(balance2.toNumber() - balance1.toNumber()).to.be.equal(dailyUbi.toNumber());
  });

  it("should not be able to fish the same user twice", async () => {
    let error = await ubi.fish(claimer, { from: fisherman }).catch(e => e);
    expect(error.message).to.have.string("already fished");
  });

  it("should recieves a claim reward when call claim after being fished", async () => {
    let activeUsersCountBefore = await ubi.activeUsersCount();
    let claimerBalanceBefore = await goodDollar.balanceOf(claimer);
    await identity.authenticate(claimer);
    await ubi.claim({ from: claimer });
    let claimerBalanceAfter = await goodDollar.balanceOf(claimer);
    let activeUsersCountAfter = await ubi.activeUsersCount();
    expect(
      activeUsersCountAfter.toNumber() - activeUsersCountBefore.toNumber()
    ).to.be.equal(1);
    expect(claimerBalanceAfter.toNumber() - claimerBalanceBefore.toNumber()).to.be.equal(
      100
    );
  });

  it("should be able to fish by calling fishMulti", async () => {
    await increaseDays(MAX_INACTIVE_DAYS);
    let amount = 1e8;
    await dai.mint(web3.utils.toWei("1000", "ether"));
    dai.approve(cDAI.address, web3.utils.toWei("1000", "ether"));
    await cDAI.mint(web3.utils.toWei("1000", "ether"));
    await cDAI.approve(goodReserve.address, amount);
    await goodReserve.buy(cDAI.address, amount, 0);
    let gdbalance = await goodDollar.balanceOf(founder);
    await goodDollar.transfer(
      firstClaimPool.address,
      Math.floor(gdbalance.toNumber() / 2).toString()
    );
    await goodDollar.transfer(
      ubi.address,
      Math.floor(gdbalance.toNumber() / 2).toString()
    );
    await identity.authenticate(claimer);
    let balanceBefore = await goodDollar.balanceOf(fisherman);
    await ubi.fishMulti([claimer], { from: fisherman });
    let balanceAfter = await goodDollar.balanceOf(fisherman);
    let dailyUbi = await ubi.dailyUbi();
    expect(balanceAfter.toNumber() - balanceBefore.toNumber()).to.be.equal(
      dailyUbi.toNumber()
    );
  });
});
