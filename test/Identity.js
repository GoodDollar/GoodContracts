const Identity = artifacts.require("Identity");
const GoodDollar = artifacts.require("GoodDollar");
const GoodDollarReserve = artifacts.require("GoodDollarReserve");
const OneTimePaymentLinks = artifacts.require("OneTimePaymentLinks");
const RedemptionFunctional = artifacts.require("RedemptionFunctional");
// TODO integrate tests from https://github.com/ConsenSys/Tokens/blob/master/test/eip20/eip20.js

contract("Identity", accounts => {
  it("Should have whitelisted contracts default", async () => {
    let instance = await Identity.deployed();
    let contracts = [GoodDollar,GoodDollarReserve,OneTimePaymentLinks]
    await Promise.all(contracts.map(async (c) => {
      let result = await instance.isWhitelisted(c.address)
      assert.equal(result, true)
    }))
    
  });

  it("Should owner whitelisted by default", async () => {
    let instance = await Identity.deployed();
    let result = await instance.isWhitelisted(accounts[0])
    assert.equal(result, true)
    
  });

  it("Should allow owner to whitelist", async () => {
    let instance = await Identity.deployed();
    await instance.blackListUser(accounts[9])
    let count = await instance.whiteListedCount()
    await instance.whiteListUser(accounts[9],'did:gd')
    let countAfter = await instance.whiteListedCount()
    let result = await instance.isWhitelisted(accounts[9])

    assert.equal(result, true)
    assert.equal(countAfter.toNumber(),count.toNumber()+1)
    
  });

  it("Should allow to renounce", async () => {
    let instance = await Identity.deployed();
    let count = await instance.whiteListedCount()
    await instance.renounceWhitelisted({from:accounts[9]});
    let countAfter = await instance.whiteListedCount()
    let result = await instance.isWhitelisted(accounts[9])

    assert.equal(result, false)
    assert.equal(countAfter.toNumber(),count.toNumber()-1)
    
  });

  it("Should register with profile", async () => {
    let instance = await Identity.deployed();
    await instance.addWhitelistedWithDID(accounts[8],'did:gooddollar:epxuhtuejmdc')
    let result = await instance.isWhitelisted(accounts[8])
    assert.equal(result,true)
    let didHash = web3.utils.sha3('did:gooddollar:epxuhtuejmdc')
    assert.equal(await instance.didHashToAddress(didHash),accounts[8])
    assert.equal(await instance.addrToDID(accounts[8]),'did:gooddollar:epxuhtuejmdc')
  });

  it("Should transfer account", async () => {
    let instance = await Identity.deployed();
    await instance.transferAccount(accounts[7],{ from: accounts[8] })
    let result = await instance.isWhitelisted(accounts[7])
    assert.equal(result,true)
    let didHash = web3.utils.sha3('did:gooddollar:epxuhtuejmdc')
    assert.equal(await instance.didHashToAddress(didHash),accounts[7])
    assert.equal(await instance.addrToDID(accounts[7]),'did:gooddollar:epxuhtuejmdc')
  });

})