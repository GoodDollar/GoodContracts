import assertRevert from "zeppelin-solidity/test/helpers/assertRevert";

const GoodReserve = artifacts.require("GoodDollarReserve");

contract("GoodDollarReserve", accounts => {
  it("Should print poolBalance()", async () => {
    let instance = await GoodReserve.deployed();
    let balance = await instance.poolBalance();
    console.log("balance ="+web3.utils.fromWei(balance.toString(),"ether"));
    assert.notEqual(balance,undefined);
  });

  it("Should sell GTC", async () => {
      let instance = await GoodReserve.deployed();
      let price = await instance.calculatePriceForSale(10000)
      console.log("price =",web3.utils.fromWei(price.toString(),"ether"));
      assert.notEqual(price,undefined);
  });

  
});

