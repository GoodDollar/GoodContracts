
// const Web3 = require('web3')
const OTPL = artifacts.require("OneTimePaymentLinks");
const GoodDollar = artifacts.require("GoodDollar");
const UBI = artifacts.require("UBI");
const Identity = artifacts.require("Identity");

contract("OneTimePaymentLinks", accounts => {
  before("topup wallet",async () => {
    let instance = await GoodDollar.deployed();
    let identity = await Identity.deployed()
    await identity.whiteListUser(accounts[1],'did:gd')
    await identity.whiteListUser(accounts[2],'did:gd')
    let instanceUBI = await UBI.deployed();
    await instanceUBI.claimTokens( {from: accounts[1]});
    await instanceUBI.claimTokens( {from: accounts[2]});
  });

  it("Should deposit funds", async () => {
    let instance = await OTPL.deployed();
    let gdInstance = await GoodDollar.deployed()
    gdInstance.approve(instance.address,"10",{from:accounts[1]})
    instance.deposit(accounts[1],web3.utils.sha3('234'),"10",{from: accounts[1]})
    let balance = (await gdInstance.balanceOf(instance.address)).toNumber();
    console.log("balance ="+web3.utils.fromWei(balance.toString(),"ether"));

    assert.equal(balance,10);
  });

  it("Should not deposit funds to existing link", async () => {
    let instance = await OTPL.deployed();
    let gdInstance = await GoodDollar.deployed()
    gdInstance.approve(instance.address,"20",{from:accounts[1]})
    let result = await instance.deposit(accounts[1],web3.utils.sha3('234'),"10",{from: accounts[1]}).then(x => "success").catch(x => "failure")
    assert.equal(result,"failure");
  });

  it("Should withdraw funds", async () => {
    let instance = await OTPL.deployed();
    let gdInstance = await GoodDollar.deployed()
    let preOTPLBalance = (await gdInstance.balanceOf(instance.address)).toNumber();
    let preUserBalance = (await gdInstance.balanceOf(accounts[2])).toNumber();
    await instance.withdraw("234",{from: accounts[2]})
    let postUserBalance = (await gdInstance.balanceOf(accounts[2])).toNumber();
    let postOTPLBalance = (await gdInstance.balanceOf(instance.address)).toNumber();
    assert.equal(postUserBalance - preUserBalance,10);
    assert.equal(preOTPLBalance - postOTPLBalance,10);
  });
  

//   it("Should approve and deposit (ERC827)", async () => {
//     let amount = 5
//     let instance = await OTPL.deployed()
//     let gdInstance = await GoodDollar.deployed()
//     let encodedABI = await instance.contract.methods.deposit(accounts[2],web3.utils.sha3("23511"),amount).encodeABI()
//     let balancePre = (await gdInstance.balanceOf(accounts[2])).toNumber();
//     let tx = await gdInstance.approveAndCall(instance.address,amount, encodedABI ,{from : accounts[2]})
//     let balance = (await gdInstance.balanceOf(instance.address)).toNumber();
//     let balanceUser = (await gdInstance.balanceOf(accounts[2])).toNumber();
//     assert.equal(balance,amount);
//     assert.equal(balanceUser,5);
//   });

  it("Should transferAndCall deposit (ERC677)", async () => {
      let amount = 100
      let instance = await OTPL.deployed()
      let gdInstance = await GoodDollar.deployed()
      let encodedABI = await instance.contract.methods.deposit(accounts[2],web3.utils.sha3("23511"),amount).encodeABI()
      let balancePre = (await gdInstance.balanceOf(accounts[2])).toNumber();
      let preOTPLBalance = (await gdInstance.balanceOf(instance.address)).toNumber();
      let tx = await gdInstance.transferAndCall(instance.address,amount, encodedABI ,{from : accounts[2]})
      // console.log({tx,logs:tx.events})
      // console.log(await web3.eth.getTransactionReceipt(tx.transactionHash))
      // console.log(await instance.getPastEvents('PaymentDeposit',{filter: {from:accounts[2]}}))
      let postOTPLBalance = (await gdInstance.balanceOf(instance.address)).toNumber();
      let balanceUser = (await gdInstance.balanceOf(accounts[2])).toNumber();
      let deposit = await instance.payments(web3.utils.sha3("23511"))
      let txFee = amount * 0.01
      assert.equal(amount, deposit)
      assert.equal(postOTPLBalance - preOTPLBalance,amount);
      assert.equal(balancePre - balanceUser,amount + txFee);
  });
  it("Should withdraw a transferAndCall deposit (ERC677)", async () => {
    let instance = await OTPL.deployed();
    let gdInstance = await GoodDollar.deployed()
    let result = await instance.withdraw("23511",{from: accounts[2]}).then(x => "success").catch(x => "failure")
    let balanceUser = (await gdInstance.balanceOf(accounts[2])).toNumber();
    let balanceOTPL = (await gdInstance.balanceOf(instance.address)).toNumber();
    console.log({result, balanceUser, balanceOTPL})
    assert.equal(result,"success");
  });
  it("Should not withdraw funds twice", async () => {
    let instance = await OTPL.deployed();
    let gdInstance = await GoodDollar.deployed()
    let result = await instance.withdraw("234",{from: accounts[2]}).then(x => "success").catch(x => "failure")
    console.log(result)
    assert.equal(result,"failure");
  });

})