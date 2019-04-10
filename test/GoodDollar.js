const GoodDollar = artifacts.require("GoodDollar");
const GoodDollarReserve = artifacts.require("GoodDollarReserve");
const UBI = artifacts.require("UBI");
const Identity = artifacts.require("Identity");
let WEB3 = require('web3')
// let myweb3 = new WEB3(web3.currentProvider)

// TODO integrate tests from https://github.com/ConsenSys/Tokens/blob/master/test/eip20/eip20.js
// GoodDollar.deployed().then(x => x.contract.events.Transfer({fromBlock:0},console.log))
contract("GoodDollar", accounts => {
  // let mygdcontract = new myweb3.eth.Contract(
  //   GoodDollar.abi,
  //   GoodDollar.address,
  //   { from: accounts[0] }
  // )

  it("Should make first account an owner", async () => {
    let instance = await GoodDollar.deployed();
    let instanceUBI = await UBI.deployed();
    let owner = await instanceUBI.owner();
    console.log(owner,accounts);
    assert.equal(owner, accounts[0]);
    
  });

  it("Should give the owner 0 tokens", async () => {
    let instance = await GoodDollar.deployed();
    let instanceUBI = await UBI.deployed();
    let owner = await instanceUBI.owner();
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
    let identity = await Identity.deployed()
    let whitelisted = await identity.isWhitelisted(accounts[1])
    assert.equal(whitelisted, false);
  });

  it("Should whitelist a user by a whitelisted user", async () => {
    let instance = await GoodDollar.deployed();
    let identity = await Identity.deployed()
    await identity.whiteListUser(accounts[1],'did:gd')
    let whitelisted = await identity.isWhitelisted(accounts[1])
    assert.equal(whitelisted, true);
  });

  it("Should entitle a first-time users to tokens", async () => {
    let instance = await GoodDollar.deployed();
    let UBIInstance = await UBI.deployed();
    let identity = await Identity.deployed()
    await identity.whiteListUser(accounts[1],'did:gd')
    let entitlement = (await UBIInstance.checkEntitlement.call({from:accounts[1]})).toNumber();
    assert(entitlement>0);
  });



  it("Should withdraw your entitlement", async () => {
    let instance = await GoodDollar.deployed();
    let UBIInstance = await UBI.deployed();
    await UBIInstance.claimTokens.sendTransaction( {from: accounts[1]});
    let balance = (await instance.balanceOf(accounts[1])).toNumber();
    assert(balance>=100);
  });

  it("Should allow transfer from whitelisted to non whitelisted", async () => {
    let instance = await GoodDollar.deployed();
    let tx = await instance.transfer(accounts[2],5,{from: accounts[1]})
    let balance = (await instance.balanceOf(accounts[2])).toNumber();
    assert(balance==5);
  })

  it("Should not allow transfer from non-whitelisted", async () => {
    let instance = await GoodDollar.deployed();
    let txFailed = false
    try
    {
      let tx = await instance.transfer(accounts[1],5,{from: accounts[2]})
    }    
    catch (e) {
      txFailed = true
    }
    let balance = (await instance.balanceOf(accounts[2])).toNumber();
    assert.equal(balance,5);
    assert.equal(txFailed,true);
  })

  // it("Has bug: doesn't return Transfer event in getPastEvents for latest web3", async () => {
    
  //   let instance = await GoodDollar.deployed();
    
  //   let tx = await instance.transfer(accounts[2],5,{from: accounts[1]})
  //   let events = await mygdcontract.getPastEvents('Transfer',{fromBlock:0,toBlock:'latest'})
  //   assert(events==undefined || events.length==0)
  // })
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
