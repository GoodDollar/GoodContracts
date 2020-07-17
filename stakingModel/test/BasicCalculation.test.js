const InterestDistributionMock = artifacts.require("InterestDistributionMock");

const BN = web3.utils.BN;


contract("InterestDistribution - Basic calculations", ([user1]) => {
  

  let interestDistribution;
  before(async () => {
    interestDistribution = await InterestDistributionMock.new();
    
  });

  // it("", async () => {
  //   // let lowWeiAmount = web3.utils.toWei("99", "ether");
  //   // let weiAmount = web3.utils.toWei("100", "ether");

  //   // await dai.mint(staker, weiAmount);
  //   // await dai.approve(simpleStaking.address, lowWeiAmount, {
  //   //   from: staker
  //   // });

  //   // const error = await simpleStaking
  //   //   .stake(weiAmount, {
  //   //     from: staker
  //   //   })
  //   //   .catch(e => e);
  //   // expect(error);
  //   console.log(interestDistribution.address);
  // });
});
