require("openzeppelin-solidity/build/contracts/TokenTimelock.json");
const GoodReserve = artifacts.require("GoodReserveCDai");
const MarketMaker = artifacts.require("GoodMarketMaker");

const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");
const Identity = artifacts.require("Identity");
const Formula = artifacts.require("FeeFormula");

const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("GoodReserve - staking with cDAI mocks", ([founder, staker]) => {
  let dai;
  let cDAI;
  let goodReserve;
  let goodDollar, identity, formula, marketMaker;

  before(async () => {
    dai = await DAIMock.new();
    [cDAI, identity, formula] = await Promise.all([
      cDAIMock.new(dai.address),
      Identity.new(),
      Formula.new(0)
    ]);
    goodDollar = await GoodDollar.new(
      "GoodDollar",
      "GDD",
      "0",
      formula.address,
      identity.address,
      NULL_ADDRESS
    );
    marketMaker = await MarketMaker.new(goodDollar.address);
    goodReserve = await GoodReserve.new(
      dai.address,
      cDAI.address,
      goodDollar.address,
      founder,
      founder,
      marketMaker.address
    );
    goodDollar.addMinter(goodReserve.address);
    dai.mint(cDAI.address, web3.utils.toWei("100000000", "ether"));
  });

  xit("should set marketmaker by owner", async () => {
    await goodReserve.setMarketMaker(marketMaker.address);
    const newMM = await goodReserve.marketMaker();
    expect(newMM.toString()).to.be.equal(marketMaker.address);
  });

  xit("should returned fixed 0.0001 market price", async () => {
    const gdPrice = await goodReserve.currentPrice(cDAI.address);
    const cdaiWorthInGD = gdPrice.mul(new BN("100000000", 10));
    const gdFloatPrice = gdPrice.toNumber() / 10 ** 8; //cdai 8 decimals
    expect(gdFloatPrice).to.be.equal(0.0001);
    expect(cdaiWorthInGD.toString()).to.be.equal("1000000000000"); //in 8 decimals precision
    expect(cdaiWorthInGD.toNumber() / 10 ** 8).to.be.equal(10000);
  });

  xit("should calculate mint UBI correctly for 8 decimals precision", async () => {
    const gdPrice = await marketMaker.currentPrice(cDAI.address);
    const toMint = await marketMaker.shouldMint(cDAI.address, "100000000");
    const expectedTotalMinted = 10 ** 8 / gdPrice.toNumber();
    expect(expectedTotalMinted).to.be.equal(10000); //10k GD
    expect(toMint.toString()).to.be.equal(
      (expectedTotalMinted * 100).toString()
    ); //add 2 decimals precision
  });

  xit("should calculate mint UBI correctly for 18 decimals precision", async () => {
    const gdPrice = await marketMaker.currentPrice(dai.address);
    const toMint = await marketMaker.shouldMint(
      dai.address,
      web3.utils.toWei("1", "ether")
    );
    console.log(gdPrice.toString(), toMint.toString());
    const expectedTotalMinted = 10 ** 18 / gdPrice.toNumber();

    expect(expectedTotalMinted).to.be.equal(1000000000); //10k GD with 2 decimals
    expect(toMint.toString()).to.be.equal(
      (expectedTotalMinted * 100).toString()
    );
  });

  xit("should calculate mint UBI correctly for 18 decimals precision", async () => {
    const gdPrice = await marketMaker.currentPrice(dai.address);
    const toMint = await marketMaker.shouldMint(
      dai.address,
      web3.utils.toWei("1", "ether")
    );
    await goodReserve.mintInterestAndUBI(cDAI.address, "100000000", "0");
    const expectedTotalMinted = gdPrice.mul("100000000").div("1000000");
    const gdBalanceFund = await goodDollar.balanceOf(founder);
    expect(gdBalanceFund.toString()).to.be.equal(
      expectedTotalMinted.toString()
    );
  });
});
