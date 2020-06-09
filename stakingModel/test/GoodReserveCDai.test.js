require("openzeppelin-solidity/build/contracts/TokenTimelock.json");
const GoodReserve = artifacts.require("GoodReserveCDai");
const MarketMaker = artifacts.require("GoodMarketMaker");

const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const DAIMock = artifacts.require("DAIMock");
const cDAIMock = artifacts.require("cDAIMock");
const avatarMock = artifacts.require("AvatarMock");
const ControllerMock = artifacts.require("ControllerMock");
const Identity = artifacts.require("Identity");
const Formula = artifacts.require("FeeFormula");
const ContributionCalculation = artifacts.require("ContributionCalculation");

const BN = web3.utils.BN;
export const BLOCK_INTERVAL = 1;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("GoodReserve - staking with cDAI mocks", ([founder, staker]) => {
  let dai;
  let cDAI;
  let goodReserve;
  let goodDollar, avatar, identity, formula, marketMaker, contribution, controller;

  before(async () => {
    dai = await DAIMock.new();
    [cDAI, avatar, identity, formula] = await Promise.all([
      cDAIMock.new(dai.address),
      avatarMock.new("", NULL_ADDRESS, NULL_ADDRESS),
      Identity.new(),
      Formula.new(0)
    ]);
    controller = await ControllerMock.new(avatar.address);
    await avatar.transferOwnership(controller.address);
    goodDollar = await GoodDollar.new(
      "GoodDollar",
      "GDD",
      "0",
      formula.address,
      identity.address,
      NULL_ADDRESS
    );
    marketMaker = await MarketMaker.new(
      goodDollar.address,
      999388834642296,
      1e15,
      avatar.address
    );
    contribution = await ContributionCalculation.new(avatar.address, 0, 1e15);
    goodReserve = await GoodReserve.new(
      dai.address,
      cDAI.address,
      goodDollar.address,
      founder,
      avatar.address,
      identity.address,
      marketMaker.address,
      contribution.address,
      BLOCK_INTERVAL
    );
    await goodReserve.start();
    dai.mint(cDAI.address, web3.utils.toWei("100000000", "ether"));

    await marketMaker.initializeToken(
      cDAI.address,
      "100", //1gd
      "10000", //0.0001 cDai
      "1000000" //100% rr
    );

    await marketMaker.initializeToken(dai.address, "100", "1000000000", "1000000");
  });

  it("should set marketmaker in the reserve by avatar", async () => {
    let encodedCall = web3.eth.abi.encodeFunctionCall(
      {
        name: "setMarketMaker",
        type: "function",
        inputs: [
          {
            type: "address",
            name: "_marketMaker"
          }
        ]
      },
      [marketMaker.address]
    );
    await controller.genericCall(goodReserve.address, encodedCall, avatar.address, 0);
    const newMM = await goodReserve.marketMaker();
    expect(newMM.toString()).to.be.equal(marketMaker.address);
  });

  it("should returned true for isActive", async () => {
    const isActive = await goodReserve.isActive();
    expect(isActive.toString()).to.be.equal("true");
  });

  it("should returned fixed 0.0001 market price", async () => {
    const gdPrice = await goodReserve.currentPrice(cDAI.address);
    const cdaiWorthInGD = gdPrice.mul(new BN("100000000", 10));
    const gdFloatPrice = gdPrice.toNumber() / 10 ** 8; //cdai 8 decimals
    expect(gdFloatPrice).to.be.equal(0.0001);
    expect(cdaiWorthInGD.toString()).to.be.equal("1000000000000"); //in 8 decimals precision
    expect(cdaiWorthInGD.toNumber() / 10 ** 8).to.be.equal(10000);
  });

  it("should not be able to buy gd if the minter is not the reserve", async () => {
    await marketMaker.transferOwnership(goodReserve.address);
    let amount = 1e8;
    await cDAI.approve(goodReserve.address, amount);
    const gdBalanceBefore = await goodDollar.balanceOf(founder);
    const cDAIBalanceBefore = await cDAI.balanceOf(founder);
    let error = await goodReserve.buy(cDAI.address, amount, 0).catch(e => e);
    const gdBalanceAfter = await goodDollar.balanceOf(founder);
    const cDAIBalanceAfter = await cDAI.balanceOf(founder);
    goodDollar.addMinter(goodReserve.address);
    expect(error.message).not.to.be.empty;
    expect(gdBalanceAfter.toString()).to.be.equal(gdBalanceBefore.toString());
    expect(cDAIBalanceAfter.toString()).to.be.equal(cDAIBalanceBefore.toString());
  });

  it("should calculate mint UBI correctly for 18 decimals precision and no interest", async () => {
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceBefore = reserveToken.reserveSupply;
    let supplyBefore = reserveToken.gdSupply;
    const gdPriceBefore = await marketMaker.currentPrice(cDAI.address);
    const tx = await goodReserve.mintInterestAndUBI(
      cDAI.address,
      web3.utils.toWei("1", "ether"),
      "0"
    );
    const gdBalanceFund = await goodDollar.balanceOf(founder);
    const gdPriceAfter = await marketMaker.currentPrice(cDAI.address);
    reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceAfter = reserveToken.reserveSupply;
    let supplyAfter = reserveToken.gdSupply;
    let rrAfter = reserveToken.reserveRatio;
    // expected that minted token will be added to the previous supply
    expect(supplyAfter.toString()).to.be.equal(
      tx.logs[0].args.gdInterestMinted
        .add(tx.logs[0].args.gdExpansionMinted)
        .add(supplyBefore)
        .toString()
    );
    // expected that the new reserve balance will include
    // the new 1e18 cdai which transferred
    expect(reserveBalanceAfter.toString()).to.be.equal(
      (reserveBalanceBefore.toNumber() + 1e18).toString()
    );
    // the new reserve ratio should be effected from the mintExpansion by:
    // the daily change that was set up in the constructor (999388834642296)
    expect(rrAfter.toString()).to.be.equal("999388");
    // the price should be the same
    expect(gdPriceAfter.toString()).to.be.equal(gdPriceBefore.toString());
    expect(gdBalanceFund.toString()).to.be.equal(
      tx.logs[0].args.gdInterestMinted.add(tx.logs[0].args.gdExpansionMinted).toString()
    );
  });

  it("should calculate mint UBI correctly for 18 decimals precision and partial interest", async () => {
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceBefore = reserveToken.reserveSupply;
    let supplyBefore = reserveToken.gdSupply;
    const gdBalanceFundBefore = await goodDollar.balanceOf(founder);
    const gdBalanceAvatarBefore = await goodDollar.balanceOf(avatar.address);
    const gdPriceBefore = await marketMaker.currentPrice(cDAI.address);
    const tx = await goodReserve.mintInterestAndUBI(
      cDAI.address,
      web3.utils.toWei("10000", "gwei"),
      "10000"
    ); // interest is 0.0001 cDai which equal to 1 gd
    const gdBalanceFundAfter = await goodDollar.balanceOf(founder);
    const gdBalanceAvatarAfter = await goodDollar.balanceOf(avatar.address);
    const gdPriceAfter = await marketMaker.currentPrice(cDAI.address);
    reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceAfter = reserveToken.reserveSupply;
    let supplyAfter = reserveToken.gdSupply;
    let rrAfter = reserveToken.reserveRatio;
    let et = new BN(web3.utils.toWei("10000", "gwei"));
    const toMint = tx.logs[0].args.gdInterestMinted.add(
      tx.logs[0].args.gdExpansionMinted
    );
    expect(reserveBalanceAfter.toString()).to.be.equal(
      et.add(reserveBalanceBefore).toString()
    );
    expect(supplyAfter.toString()).to.be.equal(toMint.add(supplyBefore).toString());
    expect(gdPriceAfter.toString()).to.be.equal(gdPriceBefore.toString());
    expect((gdBalanceAvatarAfter - gdBalanceAvatarBefore).toString()).to.be.equal("0"); // 1 gd
    expect((gdBalanceFundAfter - gdBalanceFundBefore).toString()).to.be.equal(
      toMint.toString()
    );
    expect(rrAfter.toString()).to.be.equal("998777");
  });

  it("should not mint UBI if the reserve is not cDAI", async () => {
    let error = await goodReserve
      .mintInterestAndUBI(dai.address, web3.utils.toWei("1", "ether"), "0")
      .catch(e => e);
    expect(error.message).not.to.be.empty;
  });

  it("should not mint UBI if the caller is not the fund manager", async () => {
    let error = await goodReserve
      .mintInterestAndUBI(cDAI.address, web3.utils.toWei("1", "ether"), "0", {
        from: staker
      })
      .catch(e => e);
    expect(error.message).not.to.be.empty;
  });

  it("should set block interval by avatar", async () => {
    let encodedCall = web3.eth.abi.encodeFunctionCall(
      {
        name: "setBlockInterval",
        type: "function",
        inputs: [
          {
            type: "uint256",
            name: "_blockInterval"
          }
        ]
      },
      [100]
    );
    await controller.genericCall(goodReserve.address, encodedCall, avatar.address, 0);
    const newBI = await goodReserve.blockInterval();
    expect(newBI.toString()).to.be.equal("100");
  });

  it("should not mint UBI if not in the interval", async () => {
    const gdBalanceFundBefore = await goodDollar.balanceOf(founder);
    const gdBalanceAvatarBefore = await goodDollar.balanceOf(avatar.address);
    const error = await goodReserve
      .mintInterestAndUBI(cDAI.address, web3.utils.toWei("10000", "gwei"), "10000")
      .catch(e => e);
    const gdBalanceFundAfter = await goodDollar.balanceOf(founder);
    const gdBalanceAvatarAfter = await goodDollar.balanceOf(avatar.address);
    expect(error.message).to.have.string("wait for the next interval");
    expect(gdBalanceFundAfter.toString()).to.be.equal(gdBalanceFundBefore.toString());
    expect(gdBalanceAvatarAfter.toString()).to.be.equal(gdBalanceAvatarBefore.toString());
  });

  it("should be able to buy gd with cDAI", async () => {
    let amount = 1e8;
    await dai.mint(web3.utils.toWei("100", "ether"));
    dai.approve(cDAI.address, web3.utils.toWei("100", "ether"));
    await cDAI.mint(web3.utils.toWei("100", "ether"));
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceBefore = reserveToken.reserveSupply;
    let supplyBefore = reserveToken.gdSupply;
    let rrBefore = reserveToken.reserveRatio;
    const gdBalanceBefore = await goodDollar.balanceOf(founder);
    const cDAIBalanceBefore = await cDAI.balanceOf(founder);
    const cDAIBalanceReserveBefore = await cDAI.balanceOf(goodReserve.address);
    const priceBefore = await goodReserve.currentPrice(cDAI.address);
    await cDAI.approve(goodReserve.address, amount);
    let transaction = await goodReserve.buy(cDAI.address, amount, 0);
    reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceAfter = reserveToken.reserveSupply;
    let supplyAfter = reserveToken.gdSupply;
    let rrAfter = reserveToken.reserveRatio;
    const gdBalanceAfter = await goodDollar.balanceOf(founder);
    const cDAIBalanceAfter = await cDAI.balanceOf(founder);
    const cDAIBalanceReserveAfter = await cDAI.balanceOf(goodReserve.address);
    const priceAfter = await goodReserve.currentPrice(cDAI.address);
    expect((cDAIBalanceReserveAfter - cDAIBalanceReserveBefore).toString()).to.be.equal(
      amount.toString()
    );
    expect((reserveBalanceAfter - reserveBalanceBefore).toString()).to.be.equal(
      amount.toString()
    );
    expect(supplyAfter.sub(supplyBefore).toString()).to.be.equal(
      gdBalanceAfter.sub(gdBalanceBefore).toString()
    );
    expect(rrAfter.toString()).to.be.equal(rrBefore.toString());
    expect(gdBalanceAfter.gt(gdBalanceBefore)).to.be.true;
    expect(cDAIBalanceBefore.gt(cDAIBalanceAfter)).to.be.true;
    expect(priceAfter.toString()).to.be.equal(priceBefore.toString());
    expect(transaction.logs[0].event).to.be.equal("TokenPurchased");
  });

  it("should be able to buy gd with cDAI with generic amount of cdai tokens", async () => {
    await dai.mint(web3.utils.toWei("4895", "ether"));
    dai.approve(cDAI.address, web3.utils.toWei("4895", "ether"));
    let cdaibefore = await cDAI.balanceOf(founder);
    await cDAI.mint(web3.utils.toWei("4895", "ether"));
    let cdaiafter = await cDAI.balanceOf(founder);
    let amount = (cdaiafter.sub(cdaibefore)).toNumber();
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceBefore = reserveToken.reserveSupply;
    let supplyBefore = reserveToken.gdSupply;
    const gdBalanceBefore = await goodDollar.balanceOf(founder);
    const cDAIBalanceReserveBefore = await cDAI.balanceOf(goodReserve.address);
    await cDAI.approve(goodReserve.address, amount);
    let transaction = await goodReserve.buy(cDAI.address, amount, 0);
    reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceAfter = reserveToken.reserveSupply;
    let supplyAfter = reserveToken.gdSupply;
    const gdBalanceAfter = await goodDollar.balanceOf(founder);
    const cDAIBalanceReserveAfter = await cDAI.balanceOf(goodReserve.address);
    // actual cdai balance
    expect((cDAIBalanceReserveAfter.sub(cDAIBalanceReserveBefore)).toString()).to.be.equal(
      amount.toString()
    );
    // cdai balance according to the market maker
    expect(reserveBalanceAfter.sub(reserveBalanceBefore).toString()).to.be.equal(
      amount.toString()
    );
    expect(supplyAfter.sub(supplyBefore).toString()).to.be.equal(
      gdBalanceAfter.sub(gdBalanceBefore).toString()
    );
    expect(transaction.logs[0].event).to.be.equal("TokenPurchased");
  });

  it("should not be able to buy gd with other tokens beside cDAI", async () => {
    let amount = 1e8;
    await dai.approve(goodReserve.address, amount);
    let error = await goodReserve.buy(dai.address, amount, 0).catch(e => e);
    expect(error.message).to.have.string("Only cDAI is supported");
  });

  it("should not be able to buy gd without cDAI allowance", async () => {
    let amount = 1e8;
    await cDAI.approve(goodReserve.address, "0");
    let error = await goodReserve.buy(cDAI.address, amount, 0).catch(e => e);
    expect(error.message).to.have.string("You need to approve cDAI transfer first");
  });

  it("should not be able to buy gd without enough cDAI funds", async () => {
    let amount = 1e8;
    const cDAIBalanceBeforeTransfer = await cDAI.balanceOf(founder);
    await cDAI.transfer(staker, cDAIBalanceBeforeTransfer.toString());
    await cDAI.approve(goodReserve.address, amount);
    const gdBalanceBefore = await goodDollar.balanceOf(founder);
    const cDAIBalanceBefore = await cDAI.balanceOf(founder);
    let error = await goodReserve.buy(cDAI.address, amount, 0).catch(e => e);
    const gdBalanceAfter = await goodDollar.balanceOf(founder);
    const cDAIBalanceAfter = await cDAI.balanceOf(founder);
    expect(error.message).not.to.be.empty;
    expect(gdBalanceAfter.toString()).to.be.equal(gdBalanceBefore.toString());
    expect(cDAIBalanceAfter.toString()).to.be.equal(cDAIBalanceBefore.toString());
    await cDAI.transfer(founder, cDAIBalanceBeforeTransfer.toString(), {
      from: staker
    });
  });

  it("should not be able to buy gd when the minimum return is higher than the actual return", async () => {
    let amount = 1e8;
    await cDAI.approve(goodReserve.address, amount);
    const gdBalanceBefore = await goodDollar.balanceOf(founder);
    const cDAIBalanceBefore = await cDAI.balanceOf(founder);
    let error = await goodReserve.buy(cDAI.address, amount, 2000000).catch(e => e);
    const gdBalanceAfter = await goodDollar.balanceOf(founder);
    const cDAIBalanceAfter = await cDAI.balanceOf(founder);
    expect(error.message).to.have.string("GD return must be above the minReturn");
    expect(gdBalanceAfter.toString()).to.be.equal(gdBalanceBefore.toString());
    expect(cDAIBalanceAfter.toString()).to.be.equal(cDAIBalanceBefore.toString());
  });

  it("should be able to sell gd to cDAI without contribution", async () => {
    let amount = 1e4;
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceBefore = reserveToken.reserveSupply;
    let supplyBefore = reserveToken.gdSupply;
    let reserveRatio = reserveToken.reserveRatio;
    const gdBalanceBefore = await goodDollar.balanceOf(founder);
    const cDAIBalanceBefore = await cDAI.balanceOf(founder);
    const cDAIBalanceReserveBefore = await cDAI.balanceOf(goodReserve.address);
    await goodDollar.approve(goodReserve.address, amount);
    let transaction = await goodReserve.sell(cDAI.address, amount, 0);
    reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceAfter = reserveToken.reserveSupply;
    let supplyAfter = reserveToken.gdSupply;
    const gdBalanceAfter = await goodDollar.balanceOf(founder);
    const cDAIBalanceAfter = await cDAI.balanceOf(founder);
    const cDAIBalanceReserveAfter = await cDAI.balanceOf(goodReserve.address);
    // according to the initialization settings reserve ratio is 100%. the calculation is:
    // Return = _reserveBalance * (1 - (1 - _sellAmount / _supply) ^ (1000000 / _reserveRatio))
    const expectedReturn = await marketMaker.calculateSaleReturn(
      supplyBefore.toString(),
      reserveBalanceBefore.toString(),
      reserveRatio.toString(),
      amount);
    expect((cDAIBalanceAfter - cDAIBalanceBefore).toString()).to.be.equal(expectedReturn.toString());
    expect((cDAIBalanceReserveBefore - cDAIBalanceReserveAfter).toString()).to.be.equal(
      expectedReturn.toString()
    );
    expect(reserveBalanceBefore.sub(reserveBalanceAfter).toString()).to.be.equal(
      expectedReturn.toString()
    );
    // 1e4 gd sold (burn from the supply)
    expect((supplyBefore - supplyAfter).toString()).to.be.equal(amount.toString());
    expect(gdBalanceBefore.gt(gdBalanceAfter)).to.be.true;
    expect(cDAIBalanceAfter.gt(cDAIBalanceBefore)).to.be.true;
    expect(transaction.logs[0].event).to.be.equal("TokenSold");
  });

  it("should set sell contribution ratio by avatar", async () => {
    let nom = new BN(2e14).toString();
    let denom = new BN(1e15).toString();
    let encodedCall = web3.eth.abi.encodeFunctionCall(
      {
        name: "setContributionRatio",
        type: "function",
        inputs: [
          {
            type: "uint256",
            name: "_nom"
          },
          {
            type: "uint256",
            name: "_denom"
          }
        ]
      },
      [nom, denom]
    );
    await controller.genericCall(contribution.address, encodedCall, avatar.address, 0);
    const newRatio = await contribution.sellContributionRatio();
    expect(newRatio.toString()).to.be.equal("200000000000000000000000000");
  });

  it("should not be able to set the sell contribution ratio if not avatar", async () => {
    let error = await contribution.setContributionRatio(2e14, 1e15).catch(e => e);
    expect(error.message).to.have.string("only Avatar can call this method");
  });

  it("should not be able to set the contribution contract address if not avatar", async () => {
    let error = await goodReserve.setContributionAddress(NULL_ADDRESS).catch(e => e);
    expect(error.message).to.have.string("only Avatar can call this method");
  });

  it("should set contribution contract address by avatar", async () => {
    const currentAddress = await goodReserve.contribution();
    let encodedCall = web3.eth.abi.encodeFunctionCall(
      {
        name: "setContributionAddress",
        type: "function",
        inputs: [
          {
            type: "address",
            name: "_contribution"
          }
        ]
      },
      [NULL_ADDRESS]
    );
    await controller.genericCall(goodReserve.address, encodedCall, avatar.address, 0);
    let newAddress = await goodReserve.contribution();
    expect(newAddress).to.be.equal(NULL_ADDRESS);
    encodedCall = web3.eth.abi.encodeFunctionCall(
      {
        name: "setContributionAddress",
        type: "function",
        inputs: [
          {
            type: "address",
            name: "_contribution"
          }
        ]
      },
      [currentAddress]
    );
    await controller.genericCall(goodReserve.address, encodedCall, avatar.address, 0);
    newAddress = await goodReserve.contribution();
    expect(newAddress).to.be.equal(currentAddress);
  });

  it("should calculate the sell contribution", async () => {
    let nom = new BN(2e14).toString();
    let denom = new BN(1e15).toString();
    let actual = await contribution.calculateContribution(
      marketMaker.address,
      goodReserve.address,
      founder,
      cDAI.address,
      1e4
    );
    expect(actual.toString()).to.be.equal(((1e4 * nom) / denom).toString());
  });

  it("should be able to sell gd to cDAI with contribution of 20%", async () => {
    let amount = 1e4; // 100 gd
    // deduced amount, ie. return minus contribution. reserve ratio is 100%.
    // example without deduction:
    // 1 gd (100) equals to 0.0001 cDai (10000) so 100 gd (10k) equals to 0.01 cDai (1m)
    // since there is 20% contribution the return is 0.008 cDai (800k)
    let expectedReturn = 800000;
    let reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceBefore = reserveToken.reserveSupply;
    let supplyBefore = reserveToken.gdSupply;
    let rrBefore = reserveToken.reserveRatio;
    const gdBalanceBefore = await goodDollar.balanceOf(founder);
    const cDAIBalanceBefore = await cDAI.balanceOf(founder);
    const cDAIBalanceReserveBefore = await cDAI.balanceOf(goodReserve.address);
    const priceBefore = await goodReserve.currentPrice(cDAI.address);
    await goodDollar.approve(goodReserve.address, amount);
    let transaction = await goodReserve.sell(cDAI.address, amount, 0);
    reserveToken = await marketMaker.reserveTokens(cDAI.address);
    let reserveBalanceAfter = reserveToken.reserveSupply;
    let supplyAfter = reserveToken.gdSupply;
    let rrAfter = reserveToken.reserveRatio;
    const gdBalanceAfter = await goodDollar.balanceOf(founder);
    const cDAIBalanceAfter = await cDAI.balanceOf(founder);
    const cDAIBalanceReserveAfter = await cDAI.balanceOf(goodReserve.address);
    const priceAfter = await goodReserve.currentPrice(cDAI.address);
    expect((cDAIBalanceAfter - cDAIBalanceBefore).toString()).to.be.equal(
      expectedReturn.toString()
    );
    expect((cDAIBalanceReserveBefore - cDAIBalanceReserveAfter).toString()).to.be.equal(
      expectedReturn.toString()
    );
    expect(reserveBalanceBefore.sub(reserveBalanceAfter).toString()).to.be.equal(
      expectedReturn.toString()
    );
    expect((supplyBefore - supplyAfter).toString()).to.be.equal(amount.toString());
    expect(rrAfter.toString()).to.be.equal(rrBefore.toString());
    expect(gdBalanceBefore.gt(gdBalanceAfter)).to.be.true;
    expect(cDAIBalanceAfter.gt(cDAIBalanceBefore)).to.be.true;
    expect(priceAfter.toString()).to.be.equal(priceBefore.toString());
    expect(transaction.logs[0].event).to.be.equal("TokenSold");
  });

  it("should not be able to sell gd to other tokens beside cDAI", async () => {
    let amount = 1e8;
    await dai.approve(goodReserve.address, amount);
    let error = await goodReserve.sell(dai.address, amount, 0).catch(e => e);
    expect(error.message).to.have.string("Only cDAI is supported");
  });

  it("should not be able to sell gd without gd allowance", async () => {
    let amount = 1e4;
    await goodDollar.approve(goodReserve.address, "0");
    const gdBalanceBefore = await goodDollar.balanceOf(founder);
    const cDAIBalanceBefore = await cDAI.balanceOf(founder);
    let error = await goodReserve.sell(cDAI.address, amount, 0).catch(e => e);
    const gdBalanceAfter = await goodDollar.balanceOf(founder);
    const cDAIBalanceAfter = await cDAI.balanceOf(founder);
    expect(error.message).not.to.be.empty;
    expect(gdBalanceAfter.toString()).to.be.equal(gdBalanceBefore.toString());
    expect(cDAIBalanceAfter.toString()).to.be.equal(cDAIBalanceBefore.toString());
  });

  it("should not be able to sell gd without enough gd funds", async () => {
    let amount = 1e4;
    const gdBalanceBeforeTransfer = await goodDollar.balanceOf(founder);
    await goodDollar.transfer(staker, gdBalanceBeforeTransfer.toString());
    await goodDollar.approve(goodReserve.address, amount);
    const gdBalanceBefore = await goodDollar.balanceOf(founder);
    const cDAIBalanceBefore = await cDAI.balanceOf(founder);
    let error = await goodReserve.sell(cDAI.address, amount, 0).catch(e => e);
    const gdBalanceAfter = await goodDollar.balanceOf(founder);
    const cDAIBalanceAfter = await cDAI.balanceOf(founder);
    expect(error.message).not.to.be.empty;
    expect(gdBalanceAfter.toString()).to.be.equal(gdBalanceBefore.toString());
    expect(cDAIBalanceAfter.toString()).to.be.equal(cDAIBalanceBefore.toString());
    await goodDollar.transfer(founder, gdBalanceBeforeTransfer.toString(), {
      from: staker
    });
  });

  it("should not be able to sell gd when the minimum return is higher than the actual return", async () => {
    let amount = 1e4;
    await goodDollar.approve(goodReserve.address, amount);
    const gdBalanceBefore = await goodDollar.balanceOf(founder);
    const cDAIBalanceBefore = await cDAI.balanceOf(founder);
    let error = await goodReserve.sell(cDAI.address, amount, 2000000).catch(e => e);
    const gdBalanceAfter = await goodDollar.balanceOf(founder);
    const cDAIBalanceAfter = await cDAI.balanceOf(founder);
    expect(error.message).to.have.string("Token return must be above the minReturn");
    expect(gdBalanceAfter.toString()).to.be.equal(gdBalanceBefore.toString());
    expect(cDAIBalanceAfter.toString()).to.be.equal(cDAIBalanceBefore.toString());
  });

  it("should not be able to destroy if not avatar", async () => {
    let avatarBalanceBefore = await cDAI.balanceOf(avatar.address);
    let reserveBalanceBefore = await cDAI.balanceOf(goodReserve.address);
    let error = await goodReserve.end().catch(e => e);
    expect(error.message).to.have.string("only Avatar can call this method");
    let avatarBalanceAfter = await cDAI.balanceOf(avatar.address);
    let reserveBalanceAfter = await cDAI.balanceOf(goodReserve.address);
    let isActive = await goodReserve.isActive();
    let newMMOwner = await marketMaker.owner();
    expect((avatarBalanceAfter - avatarBalanceBefore).toString()).to.be.equal("0");
    expect(reserveBalanceAfter.toString()).to.be.equal(reserveBalanceBefore.toString());
    expect(newMMOwner).to.be.equal(goodReserve.address);
    expect(isActive.toString()).to.be.equal("true");
  });

  it("should destroy the contract and transfer cDAI funds to the given destination and transfer marker maker ownership", async () => {
    let avatarBalanceBefore = await cDAI.balanceOf(avatar.address);
    let reserveBalanceBefore = await cDAI.balanceOf(goodReserve.address);
    let encodedCall = web3.eth.abi.encodeFunctionCall(
      {
        name: "end",
        type: "function",
        inputs: []
      },
      []
    );
    await controller.genericCall(goodReserve.address, encodedCall, avatar.address, 0);
    let avatarBalanceAfter = await cDAI.balanceOf(avatar.address);
    let reserveBalanceAfter = await cDAI.balanceOf(goodReserve.address);
    let code = await web3.eth.getCode(goodReserve.address);
    let newMMOwner = await marketMaker.owner();
    expect((avatarBalanceAfter - avatarBalanceBefore).toString()).to.be.equal(
      reserveBalanceBefore.toString()
    );
    expect(reserveBalanceAfter.toString()).to.be.equal("0");
    expect(newMMOwner).to.be.equal(avatar.address);
    expect(code.toString()).to.be.equal("0x");
  });

  it("should not be able to call destory twice", async () => {
    let avatarBalanceBefore = await cDAI.balanceOf(avatar.address);
    let reserveBalanceBefore = await cDAI.balanceOf(goodReserve.address);
    let encodedCall = web3.eth.abi.encodeFunctionCall(
      {
        name: "end",
        type: "function",
        inputs: []
      },
      []
    );
    await controller.genericCall(goodReserve.address, encodedCall, avatar.address, 0);
    let avatarBalanceAfter = await cDAI.balanceOf(avatar.address);
    let reserveBalanceAfter = await cDAI.balanceOf(goodReserve.address);
    let newMMOwner = await marketMaker.owner();
    expect((avatarBalanceAfter - avatarBalanceBefore).toString()).to.be.equal("0");
    expect(reserveBalanceAfter.toString()).to.be.equal(reserveBalanceBefore.toString());
    expect(newMMOwner).to.be.equal(avatar.address);
  });
});
