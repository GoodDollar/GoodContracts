const MarketMaker = artifacts.require("GoodMarketMaker");

const GoodDollar = artifacts.require("GoodDollar");
const Bancor = artifacts.require("BancorFormula");

const Identity = artifacts.require("Identity");
const Formula = artifacts.require("FeeFormula");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");
const avatarMock = artifacts.require("AvatarMock");
const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

contract(
  "GoodMarketMaker - calculate gd value at reserve",
  ([founder, staker]) => {
    let goodDollar, identity, formula, marketMaker, dai, cDAI, avatar, bancor;

    before(async () => {
      dai = await DAIMock.new();
      [cDAI, avatar, identity, formula] = await Promise.all([
        cDAIMock.new(dai.address),
        avatarMock.new("", NULL_ADDRESS, NULL_ADDRESS),
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
      marketMaker = await MarketMaker.new(goodDollar.address, founder, 999388834642296, 1e15, avatar.address);
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
      const toMint = await marketMaker.calculateMintInterest(cDAI.address, "100000000");
      const expectedTotalMinted = 10 ** 8 / gdPrice.toNumber(); //1cdai divided by gd price;
      expect(expectedTotalMinted).to.be.equal(10000); //1k GD since price is 0.0001 cdai for 1 gd
      expect(toMint.toString()).to.be.equal(
        (expectedTotalMinted * 100).toString()
      ); //add 2 decimals precision
    });

    it("should be able to calculate and update bonding curve gd balance based on oncoming cDAI and the price stays the same", async () => {
      const priceBefore = await marketMaker.currentPrice(cDAI.address);
      await marketMaker.mintInterest(
        cDAI.address,
        web3.utils.numberToHex(1e8)
      );
      expect((Math.floor((await marketMaker.currentPrice(cDAI.address)) / 100)).toString()).to.be.equal((Math.floor(priceBefore.toNumber() / 100)).toString());
    });

    it("should mint 0 gd tokens if the add token supply is 0", async () => {
      const error = await marketMaker.mintInterest(
                            cDAI.address,
                            "0"
                          ).catch(e => e);
      expect(error.message).to.have.string("added supply must be above 0");
    });

    it("should be able to update the reserve ratio only by the owner", async () => {
      let error = await marketMaker.expandReserveRatio(
                    cDAI.address, {
                      from: staker
                    }
                  ).catch(e => e);
      expect(error.message).not.to.be.empty;
    });

    it("should be able to update the bonding curve only by the owner", async () => {
      let error = await marketMaker.mintInterest(
                    cDAI.address,
                    web3.utils.numberToHex(1e8), {
                      from: staker
                    }
                  ).catch(e => e);
      expect(error.message).not.to.be.empty;
    });

    it("should be able to update the bonding curve only by the owner", async () => {
      let error = await marketMaker.mintExpansion(
                    cDAI.address,
                    web3.utils.numberToHex(1e8), {
                      from: staker
                    }
                  ).catch(e => e);
      expect(error.message).not.to.be.empty;
    });

    it("should be able to calculate minted gd based on expansion of reserve ratio, the price stays the same", async () => {
      let reserveTokenBefore = await marketMaker.reserveTokens(cDAI.address);
      let reserveRatioBefore = reserveTokenBefore.reserveRatio;
      const priceBefore = await marketMaker.currentPrice(cDAI.address);
      const toMint = await marketMaker.calculateMintExpansion(cDAI.address);
      expect(toMint.toString()).not.to.be.equal("0");
      const newRR = await marketMaker.calculateNewReserveRatio(cDAI.address);
      expect(reserveRatioBefore.toString()).not.to.be.equal(newRR.toString());
      const priceAfter = await marketMaker.currentPrice(cDAI.address);
      expect(priceAfter.toString()).to.be.equal(priceBefore.toString());
    });

    it("should be able to calculate and update gd supply based on expansion of reserve ratio, the price stays the same", async () => {
      let reserveTokenBefore = await marketMaker.reserveTokens(cDAI.address);
      let gdSupplyBefore = reserveTokenBefore.gdSupply;
      let reserveRatioBefore = reserveTokenBefore.reserveRatio;
      const priceBefore = await marketMaker.currentPrice(cDAI.address);
      await marketMaker.mintExpansion(cDAI.address);
      let reserveTokenAfter = await marketMaker.reserveTokens(cDAI.address);
      let gdSupplyAfter = reserveTokenAfter.gdSupply;
      let reserveRatioAfter = reserveTokenAfter.reserveRatio;
      const priceAfter = await marketMaker.currentPrice(cDAI.address);
      expect(priceAfter.toString()).to.be.equal(priceBefore.toString());
      expect(gdSupplyBefore.toString()).not.to.be.equal(gdSupplyAfter.toString());
      expect(reserveRatioBefore.toString()).not.to.be.equal(reserveRatioAfter.toString());
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
      // sell formula (as in calculateSaleReturn):
      // return = reserveBalance * (1 - (1 - sellAmount / supply) ^ (1000000 / reserveRatio))
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
      // sell formula (as in calculateSaleReturn):
      // return = reserveBalance * (1 - (1 - sellAmount / supply) ^ (1000000 / reserveRatio))
      const expectedReturn = reserveBalance * (1 - (1 - sellAmount / supply) ** (1000000 / rr));
      expect(gDReturn.toNumber()).to.be.equal(
        Math.floor(expectedReturn)
      );
    });

    it("should be able to update balances based on buy return calculation", async () => {
      let reserveToken = await marketMaker.reserveTokens(dai.address);
      let reserveBalanceBefore = reserveToken.reserveSupply;
      let supplyBefore = reserveToken.gdSupply; 
      let rrBefore = reserveToken.reserveRatio; 
      let amount = web3.utils.toWei("1", "ether");
      let transaction = await marketMaker.buy(
                          dai.address,
                          web3.utils.toWei("1", "ether") //1Dai
                        );
      reserveToken = await marketMaker.reserveTokens(dai.address);
      let reserveBalanceAfter = reserveToken.reserveSupply;
      let supplyAfter = reserveToken.gdSupply; 
      let rrAfter = reserveToken.reserveRatio; 
      expect(transaction.logs[0].event).to.be.equal("BalancesUpdated");
      expect((reserveBalanceAfter - reserveBalanceBefore).toString()).to.be.equal(amount.toString());
      expect((supplyAfter - supplyBefore).toString()).to.be.equal(transaction.logs[0].args.returnAmount.toString());
      expect((rrAfter).toString()).to.be.equal(rrBefore.toString());
    });

    it("should be able to update balances based on sell return calculation", async () => {
      let reserveToken = await marketMaker.reserveTokens(dai.address);
      let reserveBalanceBefore = reserveToken.reserveSupply;
      let supplyBefore = reserveToken.gdSupply; 
      let rrBefore = reserveToken.reserveRatio; 
      let amount = 100;
      let transaction = await marketMaker.sell(
                          dai.address,
                          100
                        );
      reserveToken = await marketMaker.reserveTokens(dai.address);
      let reserveBalanceAfter = reserveToken.reserveSupply;
      let supplyAfter = reserveToken.gdSupply;
      let rrAfter = reserveToken.reserveRatio;
      expect(transaction.logs[0].event).to.be.equal("BalancesUpdated");
      expect((reserveBalanceAfter.add(transaction.logs[0].args.returnAmount)).toString()).to.be.equal(reserveBalanceBefore.toString());
      expect((supplyBefore - supplyAfter).toString()).to.be.equal(amount.toString());
      expect((rrAfter).toString()).to.be.equal(rrBefore.toString());
    });

    it("should be able to update balances based on sell with contribution return calculation", async () => {
      let reserveToken = await marketMaker.reserveTokens(dai.address);
      let reserveBalanceBefore = reserveToken.reserveSupply;
      let supplyBefore = reserveToken.gdSupply; 
      let rrBefore = reserveToken.reserveRatio; 
      let amount = 100;
      let transaction = await marketMaker.sellWithContribution(
                          dai.address,
                          100,
                          80
                        );
      reserveToken = await marketMaker.reserveTokens(dai.address);
      let reserveBalanceAfter = reserveToken.reserveSupply;
      let supplyAfter = reserveToken.gdSupply;
      let rrAfter = reserveToken.reserveRatio;
      expect(transaction.logs[0].event).to.be.equal("BalancesUpdated");
      expect((reserveBalanceAfter.add(transaction.logs[0].args.returnAmount)).toString()).to.be.equal(reserveBalanceBefore.toString());
      expect((supplyBefore - supplyAfter).toString()).to.be.equal(amount.toString());
      expect((rrAfter).toString()).to.be.equal(rrBefore.toString());
    });

    it("should not be able to calculate the buy return in gd and update the bonding curve params by a non-owner account", async () => {
      let error = await marketMaker.buy(
                          dai.address,
                          web3.utils.toWei("1", "ether"), {
                            from: staker
                        }).catch(e => e);
      expect(error.message).not.to.be.empty;
    });

    it("should not be able to calculate the sell return in reserve token and update the bonding curve params by a non-owner account", async () => {
      let error = await marketMaker.sell(
                          dai.address,
                          100, {
                            from: staker
                        }).catch(e => e);
      expect(error.message).not.to.be.empty;
    });

    it("should be able to buy only with active token", async () => {
      let reserveToken = await marketMaker.reserveTokens(cDAI.address);
      let gdSupplyBefore = reserveToken.gdSupply;
      let reserveSupplyBefore = reserveToken.reserveSupply;
      let reserveRatioBefore = reserveToken.reserveRatio;
      await marketMaker.initializeToken(
        cDAI.address,
        "0",
        reserveSupplyBefore.toString(),
        reserveRatioBefore.toString()
      );
      let error = await marketMaker.buy(
                          cDAI.address,
                          web3.utils.toWei("1", "ether")
                        ).catch(e => e);
      expect(error.message).to.have.string(
        "Reserve token not initialized"
      );
      await marketMaker.initializeToken(
        cDAI.address,
        gdSupplyBefore,
        reserveSupplyBefore.toString(),
        reserveRatioBefore.toString()
      );
    });

    it("should be able to buy only with active token", async () => {
      let error = await marketMaker.sell(
                          NULL_ADDRESS,
                          web3.utils.toWei("1", "ether")
                        ).catch(e => e);
      expect(error.message).to.have.string(
        "Reserve token not initialized"
      );
    });

    it("should be able to sell gd only when the amount is lower than the total supply", async () => {
      let reserveToken = await marketMaker.reserveTokens(cDAI.address);
      let gdSupply = reserveToken.gdSupply;
      let error = await marketMaker.sell(
                          cDAI.address,
                          (gdSupply + 1).toString()
                        ).catch(e => e);
      expect(error.message).to.have.string(
        "GD amount is higher than the total supply"
      );
    });

    it("should set reserve ratio daily expansion", async () => {
      let denom = new BN(1e15).toString();
      let currentReserveRatioDailyExpansion = await marketMaker.reserveRatioDailyExpansion();
      let encodedCall = web3.eth.abi.encodeFunctionCall({
                          name: 'setReserveRatioDailyExpansion',
                          type: 'function',
                          inputs: [{
                              type: 'uint256',
                              name: '_nom'
                          },{
                              type: 'uint256',
                              name: '_denom'
                          }]
                      }, ['1', denom]);
      await avatar.genericCall(marketMaker.address, encodedCall, 0);
      let newReserveRatioDailyExpansion = await marketMaker.reserveRatioDailyExpansion();
      expect(newReserveRatioDailyExpansion).not.to.be.equal(currentReserveRatioDailyExpansion);
      encodedCall = web3.eth.abi.encodeFunctionCall({
                  name: 'setReserveRatioDailyExpansion',
                  type: 'function',
                  inputs: [{
                      type: 'uint256',
                      name: '_nom'
                  },{
                      type: 'uint256',
                      name: '_denom'
                  }]
              }, ['999388834642296', denom]);
      await avatar.genericCall(marketMaker.address, encodedCall, 0);
      let reserveRatioDailyExpansion = await marketMaker.reserveRatioDailyExpansion();
      expect(reserveRatioDailyExpansion).not.to.be.equal(currentReserveRatioDailyExpansion);
    });

    it("should be able to set the reserve ratio daily expansion only by the owner", async () => {
      let error = await marketMaker.setReserveRatioDailyExpansion(1, 1e15).catch(e => e);
      expect(error.message).to.have.string("only Avatar can call this method");
    });

    it("should calculate amount of gd to mint based on incoming cDAI without effecting bonding curve price", async () => {
      const priceBefore = await marketMaker.currentPrice(dai.address);
      const toMint = await marketMaker.calculateMintInterest(
        dai.address,
        web3.utils.numberToHex(1e18), {
          from: staker
        }
      );
      const totalMinted = 1e18 / priceBefore.toNumber();
      expect(toMint.toString()).to.be.equal((Math.floor(totalMinted * 100)).toString());
      const priceAfter = await marketMaker.currentPrice(dai.address);
      expect(priceBefore.toString()).to.be.equal(priceAfter.toString());
    });

    it("should not change the reserve ratio when calculate how much decrease it for the reservetoken", async () => {
      let reserveTokenBefore = await marketMaker.reserveTokens(cDAI.address);
      let reserveRatioBefore = reserveTokenBefore.reserveRatio;
      await marketMaker.calculateNewReserveRatio(cDAI.address);
      let reserveTokenAfter = await marketMaker.reserveTokens(cDAI.address);
      let reserveRatioAfter = reserveTokenAfter.reserveRatio;
      expect(reserveRatioBefore.toString()).to.be.equal(reserveRatioAfter.toString());
    });

    it("should not change the gd supply when calculate how much gd to mint based on added token supply from interest", async () => {
      let reserveTokenBefore = await marketMaker.reserveTokens(cDAI.address);
      let gdSupplyBefore = reserveTokenBefore.gdSupply;
      await marketMaker.calculateMintInterest(cDAI.address, "100000000");
      let reserveTokenAfter = await marketMaker.reserveTokens(cDAI.address);
      let gdSupplyAfter = reserveTokenAfter.gdSupply;
      expect(gdSupplyAfter.toString()).to.be.equal(gdSupplyBefore.toString());
    });

    it("should not change the gd supply when calculate how much gd to mint based on expansion change", async () => {
      let reserveTokenBefore = await marketMaker.reserveTokens(cDAI.address);
      let gdSupplyBefore = reserveTokenBefore.gdSupply;
      await marketMaker.calculateMintExpansion(cDAI.address);
      let reserveTokenAfter = await marketMaker.reserveTokens(cDAI.address);
      let gdSupplyAfter = reserveTokenAfter.gdSupply;
      expect(gdSupplyAfter.toString()).to.be.equal(gdSupplyBefore.toString());
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
