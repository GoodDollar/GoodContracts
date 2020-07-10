//filename starts with Z so it runs last. since this ends all schemes
const GoodCompoundStaking = artifacts.require("GoodCompoundStaking");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");
const GoodReserve = artifacts.require("GoodReserveCDai");
const MarketMaker = artifacts.require("GoodMarketMaker");
const GoodDollar = artifacts.require("GoodDollar");
const GoodFundsManager = artifacts.require("GoodFundManager");
const Controller = artifacts.require("Controller");
const Identity = artifacts.require("Identity");
const ContributionCalculation = artifacts.require("ContributionCalculation");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const UBI = artifacts.require("UBIScheme");
const FirstClaimPool = artifacts.require("FirstClaimPool");
const AddMinter = artifacts.require("AddMinter");
const EndContract = artifacts.require("EndContract");
const { increase_days } = require("./helpers");

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

contract(
  "Contracts inactivation network e2e tests - reserve, fundmanager, pool and ubi",
  ([founder]) => {
    let dai,
      cDAI,
      simpleStaking,
      goodReserve,
      goodFundManager,
      goodDollar,
      marketMaker,
      contribution,
      controller,
      ubi,
      firstClaimPool,
      identity;
    let deploy_settings,
      ubiBridgeRecipient,
      avatarAddress,
      registrar,
      absoluteVote,
      proposalId,
      addMinter,
      endUbiPool,
      endReserve,
      endFundManager,
      endUbi;

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
      ubiBridgeRecipient = staking_addresses.UBIScheme;
      dai = await DAIMock.at(staking_addresses.DAI);
      cDAI = await cDAIMock.at(staking_addresses.cDAI);
      simpleStaking = await GoodCompoundStaking.at(staking_addresses.DAIStaking);
      goodReserve = await GoodReserve.at(staking_addresses.Reserve);
      goodFundManager = await GoodFundsManager.at(staking_addresses.FundManager);
      marketMaker = await MarketMaker.at(staking_addresses.MarketMaker);
      contribution = await ContributionCalculation.at(staking_addresses.Contribution);
      controller = await Controller.at(dao_addresses.Controller);
      ubi = await UBI.at(staking_addresses.UBIScheme);
      firstClaimPool = await FirstClaimPool.at(staking_addresses.FirstClaimPool);
      identity = await Identity.at(dao_addresses.Identity);
      goodDollar = await GoodDollar.at(dao_addresses.GoodDollar);
      registrar = await SchemeRegistrar.at(dao_addresses.SchemeRegistrar);
      absoluteVote = await AbsoluteVote.at(dao_addresses.AbsoluteVote);
      deploy_settings = await fse.readFile("../migrations/deploy-settings.json", "utf8");
      // schemes
      addMinter = await AddMinter.new(avatarAddress, goodReserve.address);
      endUbiPool = await EndContract.new(avatarAddress, firstClaimPool.address);
      endReserve = await EndContract.new(avatarAddress, goodReserve.address);
      endFundManager = await EndContract.new(avatarAddress, goodFundManager.address);
      endUbi = await EndContract.new(avatarAddress, ubi.address);

      let isMinter = await goodDollar.isMinter(goodReserve.address);
      if (!isMinter) {
        await proposeAndRegister(
          addMinter.address,
          registrar,
          proposalId,
          absoluteVote,
          avatarAddress,
          founder
        );
        await addMinter.addMinter();
      }
      let amount = 1e8;
      await dai.mint(web3.utils.toWei("1000", "ether"));
      dai.approve(cDAI.address, web3.utils.toWei("1000", "ether"));
      await cDAI.mint(web3.utils.toWei("1000", "ether"));
      await cDAI.approve(goodReserve.address, amount);
      await goodReserve.buy(cDAI.address, amount, 0);
      let gdbalance = await goodDollar.balanceOf(founder);
      let cdaibalance = await cDAI.balanceOf(founder);
      await cDAI.transfer(
        goodReserve.address,
        Math.floor(cdaibalance.toNumber() / 2).toString()
      );
      await cDAI.transfer(
        goodFundManager.address,
        Math.floor(cdaibalance.toNumber() / 2).toString()
      );
      await goodDollar.transfer(
        firstClaimPool.address,
        Math.floor(gdbalance.toNumber() / 2).toString()
      );
      await goodDollar.transfer(
        goodFundManager.address,
        Math.floor(gdbalance.toNumber() / 2).toString()
      );
    });

    it("should start the reserve", async () => {
      let isActive = await goodReserve.isActive();
      if (!isActive) await goodReserve.start();
      isActive = await goodReserve.isActive();
      expect(isActive).to.be.true;
    });

    it("should start the fundmanager", async () => {
      let isActive = await goodFundManager.isActive();
      if (!isActive) await goodFundManager.start();
      isActive = await goodFundManager.isActive();
      expect(isActive).to.be.true;
    });

    it("should start the ubi", async () => {
      let isActive = await ubi.isActive();
      if (!isActive) await ubi.start();
      isActive = await ubi.isActive();
      expect(isActive).to.be.true;
    });

    it("should start the pool", async () => {
      let isActive = await firstClaimPool.isActive();
      if (!isActive) await firstClaimPool.start();
      isActive = await firstClaimPool.isActive();
      expect(isActive).to.be.true;
    });

    it("should not be able to make the reserve contract inactive by calling end if the sender is not the avatar", async () => {
      let error = await goodReserve.end().catch(e => e);
      expect(error.message).to.have.string("only Avatar");
    });

    it("should not be able to make the fundmanager contract inactive by calling end if the sender is not the avatar", async () => {
      let error = await goodFundManager.end().catch(e => e);
      expect(error.message).to.have.string("only Avatar");
    });

    it("should not be able to make the pool contract inactive by calling end if the sender is not the avatar", async () => {
      let error = await firstClaimPool.end().catch(e => e);
      expect(error.message).to.have.string("only Avatar");
    });

    it("should be able to make the reserve contract inactive and the avatar should recieved the funds from the contract", async () => {
      let contractbalance = await cDAI.balanceOf(goodReserve.address);
      let avatarbalance1 = await cDAI.balanceOf(avatarAddress);
      await proposeAndRegister(
        endReserve.address,
        registrar,
        proposalId,
        absoluteVote,
        avatarAddress,
        founder
      );
      await endReserve.end();
      let avatarbalance2 = await cDAI.balanceOf(avatarAddress);
      let code = await web3.eth.getCode(goodReserve.address);
      expect(code.toString()).to.be.equal("0x");
      expect(await marketMaker.owner()).to.be.equal(avatarAddress);
      expect(avatarbalance2.sub(avatarbalance1).toString()).to.be.equal(
        contractbalance.toString()
      );
    });

    it("should be able to make the fundmanager contract inactive and the avatar should recieved the funds from the contract", async () => {
      let contractcdaibalance = await cDAI.balanceOf(goodFundManager.address);
      let contractgdbalance = await goodDollar.balanceOf(goodFundManager.address);
      let avatarcdaibalance1 = await cDAI.balanceOf(avatarAddress);
      let avatargdbalance1 = await goodDollar.balanceOf(avatarAddress);
      await proposeAndRegister(
        endFundManager.address,
        registrar,
        proposalId,
        absoluteVote,
        avatarAddress,
        founder
      );
      await endFundManager.end();
      let avatarcdaibalance2 = await cDAI.balanceOf(avatarAddress);
      let avatargdbalance2 = await goodDollar.balanceOf(avatarAddress);
      let code = await web3.eth.getCode(goodFundManager.address);
      expect(code.toString()).to.be.equal("0x");
      expect(avatarcdaibalance2.sub(avatarcdaibalance1).toString()).to.be.equal(
        contractcdaibalance.toString()
      );
      expect(avatargdbalance2.sub(avatargdbalance1).toString()).to.be.equal(
        contractgdbalance.toString()
      );
    });

    it("should be able to make the pool contract inactive and the avatar should recieved the funds from the contract", async () => {
      let contractbalance = await goodDollar.balanceOf(firstClaimPool.address);
      let avatarbalance1 = await goodDollar.balanceOf(avatarAddress);
      await proposeAndRegister(
        endUbiPool.address,
        registrar,
        proposalId,
        absoluteVote,
        avatarAddress,
        founder
      );
      await endUbiPool.end();
      let avatarbalance2 = await goodDollar.balanceOf(avatarAddress);
      let code = await web3.eth.getCode(firstClaimPool.address);
      expect(code.toString()).to.be.equal("0x");
      expect(avatarbalance2.sub(avatarbalance1).toString()).to.be.equal(
        contractbalance.toString()
      );
    });

    it("should be able to make the ubi contract inactive and the avatar should recieved the funds from the contract", async () => {
      await increase_days(365); // the period has been ended before executing `end`
      let contractbalance = await goodDollar.balanceOf(ubi.address);
      let avatarbalance1 = await goodDollar.balanceOf(avatarAddress);
      await proposeAndRegister(
        endUbi.address,
        registrar,
        proposalId,
        absoluteVote,
        avatarAddress,
        founder
      );
      await endUbi.end();
      let avatarbalance2 = await goodDollar.balanceOf(avatarAddress);
      let code = await web3.eth.getCode(ubi.address);
      expect(code.toString()).to.be.equal("0x");
      expect(avatarbalance2.sub(avatarbalance1).toString()).to.be.equal(
        contractbalance.toString()
      );
    });

    it("should be able to remove the reserve contract from the whitelist", async () => {
      let iswhitelisted = await identity.isWhitelisted(goodReserve.address);
      expect(iswhitelisted).to.be.false;
    });

    it("should be able to remove the fundmanager contract from the whitelist", async () => {
      let iswhitelisted = await identity.isWhitelisted(goodFundManager.address);
      expect(iswhitelisted).to.be.false;
    });

    it("should be able to remove the ubi contract from the whitelist", async () => {
      let iswhitelisted = await identity.isWhitelisted(ubi.address);
      expect(iswhitelisted).to.be.false;
    });

    it("should be able to remove the pool contract from the whitelist", async () => {
      let iswhitelisted = await identity.isWhitelisted(firstClaimPool.address);
      expect(iswhitelisted).to.be.false;
    });
  }
);
