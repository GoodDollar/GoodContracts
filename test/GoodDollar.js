const GoodDollar = artifacts.require("GoodDollar");
const GoodDollarReserve = artifacts.require("GoodDollarReserve");
const RedemptionFunctional = artifacts.require("RedemptionFunctional");
const Identity = artifacts.require("Identity");

// TODO integrate tests from https://github.com/ConsenSys/Tokens/blob/master/test/eip20/eip20.js

contract("GoodDollar", accounts => {
  it("Should make first account an owner", async () => {
    let instance = await GoodDollar.deployed();
    let instanceRedemptionFunctional = await RedemptionFunctional.deployed();
    let owner = await instanceRedemptionFunctional.owner();
    console.log(owner,accounts);
    assert.equal(owner, accounts[0]);
    
  });

  it("Should give the owner 0 tokens", async () => {
    let instance = await GoodDollar.deployed();
    let instanceRedemptionFunctional = await RedemptionFunctional.deployed();
    let owner = await instanceRedemptionFunctional.owner();
    let balance = (await instance.balanceOf.call(accounts[0])).toNumber();

    assert.equal(balance, 0);
  });

  it("Should give a first-time user a zero-balance", async () => {
    let instance = await GoodDollar.deployed();
    let balance = (await instance.balanceOf.call(accounts[1])).toNumber();

    assert.equal(balance, 0);
  });

  it("Should not whitelist a first-time user", async () => {
    let instance = await GoodDollar.deployed();
    let instanceRedemptionFunctional = await RedemptionFunctional.deployed();
    let identity = await Identity.deployed()
    let whitelisted = await identity.isVerified(accounts[1])
    assert.equal(whitelisted, false);
  });

  it("Should whitelist a user by a whitelisted user", async () => {
    let instance = await GoodDollar.deployed();
    let instanceRedemptionFunctional = await RedemptionFunctional.deployed();
    let identity = await Identity.deployed()
    await identity.whiteListUser(accounts[1])
    let whitelisted = await identity.isVerified(accounts[1])
    assert.equal(whitelisted, true);
  });

  it("Should entitle a first-time users to tokens", async () => {
    let instance = await GoodDollar.deployed();
    let instanceRedemptionFunctional = await RedemptionFunctional.deployed();
    let owner = await instanceRedemptionFunctional.owner();
    let identity = await Identity.deployed()
    await identity.whiteListUser(accounts[1])
    let entitlement = (await instanceRedemptionFunctional.checkEntitlement.call({from:accounts[1]})).toNumber();
    assert(entitlement>0);
  });



  it("Should withdraw your entitlement", async () => {
    let instance = await GoodDollar.deployed();
    let instanceRedemptionFunctional = await RedemptionFunctional.deployed();
    let entitlement = 33333
    await instanceRedemptionFunctional.claimTokens.sendTransaction( {from: accounts[1]});
    let balance = (await instance.balanceOf(accounts[1])).toNumber();

    assert(balance>0);
  });

  
  // it("Should entitle you to ~1 token per second after the first withdrawal", async () => {
  //   let instance = await GoodDollar.deployed();
  //   await instance.withdrawTokens( {from: accounts[1]});
  //   await setTimeout(function(){
  //   }, 1000);
  //   let entitlement = (await instance.checkEntitlement.call(accounts[1])).toNumber();

  //   assert.equal(entitlement, 0);
  // });


// last claim date


  // can make transfers

  // only owner can minted

  // owner can change MINTING_COEFFICIENT


});
