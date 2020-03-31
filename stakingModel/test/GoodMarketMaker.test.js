const MarketMaker = artifacts.require("GoodMarketMaker");

const GoodDollar = artifacts.require("GoodDollar");
const Bancor = artifacts.require("BancorFormula");

const Identity = artifacts.require("Identity");
const Formula = artifacts.require("FeeFormula");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");
const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

contract(
  "GoodMarketMaker - calculate gd value at reserve",
  ([founder, staker]) => {
    let goodDollar, identity, formula, marketMaker, dai, cDAI, bancor;

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
      marketMaker = await MarketMaker.new(goodDollar.address, founder);
    });

    it("should initialize token with price", async () => {
      const expansion = await marketMaker.initializeToken(
        cDAI.address,
        "100", //1gd
        "10000", //0.0001 cDai
        "1000000" //100% rr
      );
      const price = await marketMaker.currentPrice(cDAI.address);
      expect(price.toString()).to.be.equal("10000"); //1gd is equal 0.0001 cDAI = 100000 wei;
      const onecDAIReturn = await marketMaker.buyReturn(
        cDAI.address,
        "100000000" //1cDai
      );
      expect(onecDAIReturn.toNumber() / 100).to.be.equal(10000); //0.0001 cdai is 1 gd, so for 1eth you get 10000 gd (divide by 100 to account for 2 decimals precision)
    });

    it("should update reserve ratio by yearly rate", async () => {
      const expansion = await marketMaker.reserveRatioDailyExpansion();
      expect(expansion.toString()).to.be.equal("999388834642296000000000000");
      await marketMaker.expandReserveRatio(cDAI.address);
      const daytwoRR = await marketMaker.reserveTokens(cDAI.address);
      expect(daytwoRR["1"].toString()).to.be.equal("999388");
      await marketMaker.expandReserveRatio(cDAI.address);
      const daythreeRR = await marketMaker.reserveTokens(cDAI.address);
      expect(daythreeRR["1"].toString()).to.be.equal("998777");
    });

    it("should calculate mint UBI correctly for 8 decimals precision", async () => {
      const gdPrice = await marketMaker.currentPrice(cDAI.address);
      const toMint = await marketMaker.calculateToMint(cDAI.address, "100000000");
      const expectedTotalMinted = 10 ** 8 / gdPrice.toNumber(); //1cdai divided by gd price;
      expect(expectedTotalMinted).to.be.equal(10000); //1k GD since price is 0.0001 cdai for 1 gd
      expect(toMint.toString()).to.be.equal(
        (expectedTotalMinted * 100).toString()
      ); //add 2 decimals precision
    });

    it("should have new return amount when RR is not 100%", async () => {
      const expansion = await marketMaker.initializeToken(
        dai.address,
        "100", //1gd
        web3.utils.toWei("0.0001", "ether"), //0.0001 dai
        "800000" //80% rr
      );
      const price = await marketMaker.currentPrice(dai.address);
      expect(price.toString()).to.be.equal("100000000000000"); //1gd is equal 0.0001 dai = 1000000000000000 wei;
      const oneDAIReturn = await marketMaker.buyReturn(
        dai.address,
        web3.utils.toWei("1", "ether") //1Dai
      );
      //bancor formula to calcualte return
      //gd return = gdsupply * ((1+tokenamount/tokensupply)^rr -1)
      const expectedReturn = 1 * ((1 + 1 / 0.0001) ** 0.8 - 1);
      expect(oneDAIReturn.toNumber() / 100).to.be.equal(
        Math.floor(expectedReturn * 100) / 100
      );
    });

    it("should calculate sell return with cDAI", async () => {
      const gDReturn = await marketMaker.sellReturn(
        cDAI.address,
        10 //0.1 gd
      );
      let reserveToken = await marketMaker.reserveTokens(cDAI.address);
      let reserveBalance = reserveToken.reserveSupply.toString();
      let sellAmount = 10;
      let supply = reserveToken.gdSupply.toString(); 
      let rr = reserveToken.reserveRatio.toNumber(); 
      const expectedReturn = reserveBalance * (1 - (1 - sellAmount / supply) ** (1000000 / rr));
      expect(gDReturn.toNumber()).to.be.equal(
        Math.floor(expectedReturn)
      );
    });

    it("should calculate sell return with DAI", async () => {
      const gDReturn = await marketMaker.sellReturn(
        dai.address,
        10 //0.1 gd
      );
      let reserveToken = await marketMaker.reserveTokens(dai.address);
      let reserveBalance = reserveToken.reserveSupply.toString();
      let sellAmount = 10;
      let supply = reserveToken.gdSupply.toString(); 
      let rr = reserveToken.reserveRatio.toNumber(); 
      const expectedReturn = reserveBalance * (1 - (1 - sellAmount / supply) ** (1000000 / rr));
      expect(gDReturn.toNumber()).to.be.equal(
        Math.floor(expectedReturn)
      );
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
  }
);
