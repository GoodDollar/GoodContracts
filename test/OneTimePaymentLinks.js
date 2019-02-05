
// const Web3 = require('web3')
const OTPL = artifacts.require("OneTimePaymentLinks");
const GoodDollar = artifacts.require("GoodDollar");
const RedemptionFunctional = artifacts.require("RedemptionFunctional");
const Identity = artifacts.require("Identity");

contract("OneTimePaymentLinks", accounts => {
  before("topup wallet",async () => {
    let instance = await GoodDollar.deployed();
    let identity = await Identity.deployed()
    await identity.whiteListUser(accounts[3])    
    let instanceRedemptionFunctional = await RedemptionFunctional.deployed();
    await instanceRedemptionFunctional.claimTokens.sendTransaction( {from: accounts[3]});
  });

  it("Should deposit funds", async () => {
    let instance = await OTPL.deployed();
    let gdInstance = await GoodDollar.deployed()
    gdInstance.approve(instance.address,"10",{from:accounts[3]})
    instance.deposit(accounts[3],web3.utils.sha3('234'),"10",{from: accounts[3]})
    let balance = (await gdInstance.balanceOf(instance.address)).toNumber();
    console.log("balance ="+web3.utils.fromWei(balance.toString(),"ether"));

    assert.equal(balance,10);
  });

  it("Should not deposit funds to existing link", async () => {
    let instance = await OTPL.deployed();
    let gdInstance = await GoodDollar.deployed()
    gdInstance.approve(instance.address,"20",{from:accounts[3]})
    let result = await instance.deposit(accounts[3],web3.utils.sha3('234'),"10",{from: accounts[3]}).then(x => "success").catch(x => "failure")
    assert.equal(result,"failure");
  });

  it("Should withdraw funds", async () => {
    let instance = await OTPL.deployed();
    let gdInstance = await GoodDollar.deployed()
    await instance.withdraw("234",{from: accounts[4]})
    let balance = (await gdInstance.balanceOf(accounts[4])).toNumber();
    console.log("balance ="+web3.utils.fromWei(balance.toString(),"ether"));
    assert.equal(balance,10);
    let balanceContract = (await gdInstance.balanceOf(instance.address)).toNumber();
    assert.equal(balanceContract,0);
  });
  

  it("Should approve and deposit (ERC827)", async () => {
    let amount = 5
    let instance = await OTPL.deployed()
    let gdInstance = await GoodDollar.deployed()
    let encodedABI = await instance.contract.methods.deposit(accounts[4],web3.utils.sha3("23511"),amount).encodeABI()
    let balancePre = (await gdInstance.balanceOf(accounts[4])).toNumber();
    // console.log(encodedABI,accounts[3],accounts[4],balancePre)
    let tx = await gdInstance.approveAndCall(instance.address,amount, encodedABI ,{from : accounts[4]})
    let balance = (await gdInstance.balanceOf(instance.address)).toNumber();
    let balanceUser = (await gdInstance.balanceOf(accounts[4])).toNumber();
    // console.log("balance ="+web3.utils.fromWei(balance.toString(),"ether"));
    assert.equal(balance,amount);
    assert.equal(balanceUser,5);
  });

  it("Should not withdraw funds twice", async () => {
    let instance = await OTPL.deployed();
    let gdInstance = await GoodDollar.deployed()
    let result = await instance.withdraw("234",{from: accounts[4]}).then(x => "success").catch(x => "failure")
    console.log(result)
    assert.equal(result,"failure");
  });

})