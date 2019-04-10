const GoodDollar = artifacts.require("GoodDollar");
const GoodDollarReserve = artifacts.require("GoodDollarReserve");
const UBI = artifacts.require("UBI");
const Identity = artifacts.require("Identity");

// TODO integrate tests from https://github.com/ConsenSys/Tokens/blob/master/test/eip20/eip20.js

contract("GoodDollarReserve", accounts => {
  before("Set fees",async () => {
    let gd = await GoodDollar.deployed()
    let instance = await GoodDollarReserve.deployed()
    instance.setFees(20000,20000)
    let identity = await Identity.deployed()
    await identity.whiteListUser(accounts[1],'did:gd')
    let ubi = await UBI.deployed();
    await ubi.claimTokens({from: accounts[1]})
    console.log("Before Balance:",(await gd.balanceOf(accounts[0])).toNumber(), (await gd.balanceOf(accounts[1])).toNumber())

    // await instance.buy({value:web3.utils.toWei("1","gwei")})
    // console.log("After Buy Balance:",(await gd.balanceOf(accounts[0])).toNumber())

  })
  it("Should calculate fees correctly", async () => {
    let instance = await GoodDollarReserve.deployed();
    for (let i = 0; i<10;i++)
    {
      let amount = Math.pow(10,i);
      let result1 = await instance.calcFees(amount)
      // console.log(amount,amount*0.02,result1.txFee.toNumber(),result1.burn.toNumber());
      if(i>=2)
      {
        assert.equal(result1.txFee.toNumber(), amount*0.02);
        assert.equal(result1.burn.toNumber(), amount*0.02);

      }
      else
      {
        assert.equal(result1.txFee.toNumber(), 0);
        assert.equal(result1.burn.toNumber(), 0);
      }

    }
    
  });

  it("Should not allow transfer if cant pay TX fee", async () => {
    let gd = await GoodDollar.deployed()
    let result = await gd.transfer(accounts[0],(await gd.balanceOf(accounts[1])).toNumber(),{from: accounts[1]}).then(x => "success").catch(x => "failure")
    console.log(result)
    assert.equal(result,"failure")
  })
  
  it("Should charge fees correctly", async () => {
    let gd = await GoodDollar.deployed()
    let totalSupplyBefore = (await gd.totalSupply()).toNumber()
    let result = await gd.transfer(accounts[4],50, {from: accounts[1]})
    let feesResult = result.logs.find(log => log.event=='TransactionFees')
    let totalSupplyAfter = (await gd.totalSupply()).toNumber()
    console.log(feesResult.args.fee.toNumber(),feesResult.args.burned.toNumber(),{totalSupplyAfter,totalSupplyBefore})
    assert.equal(feesResult.args.fee.toNumber(),1)
    assert.equal(feesResult.args.burned.toNumber(),1)
    assert.equal(totalSupplyAfter, totalSupplyBefore - feesResult.args.burned.toNumber())
    
  })

  it("Should not allow transfer from unverified accounts", async () => {
    let gd = await GoodDollar.deployed()
    let result = await gd.transfer(accounts[0],50,{from: accounts[4]}).then(x => "success").catch(x => "failure")
    console.log(result)
    assert.equal(result,"failure")
  })

  

})