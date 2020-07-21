const InterestDistributionMock = artifacts.require("InterestDistributionMock");

const BN = web3.utils.BN;


contract("InterestDistribution - Basic calculations", ([user1, S1, S2, S3]) => {
  

  let interestDistribution;
  before(async () => {
    interestDistribution = await InterestDistributionMock.new();
    
  });

  it("Simulate scenario 1", async () => {

    /**
      * consider :
      * S1 stakes 100DAI, donating 20%
      * Again S1 stakes 200DAI, donating 30%
      * S1 weighted stake = ((100 x (100-20)%) + (200 x (100-30)%))/(100+300) = 220/300 = 73.
      * S1 total staked = 300.
      * S1 withdraws stakes worth 110DAI
      * S1 total staked = 190. S1 weighted stake = 73.
      * S1 stakes 100DAI, donating 20%
      * S1 weighted stake = ((190 x (73)%) + (100 x (100-20)%))/(190+100) = 75.
      */

      await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("100", "ether"), 20, 0, web3.utils.toWei("100", "ether"))
        .catch(e => e);
      await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("200", "ether"), 30, 0, web3.utils.toWei("300", "ether"))
        .catch(e => e);

      let stakerData = await interestDistribution.getStakerData(user1);
      
      expect(stakerData[0].toString()).to.be.equal(web3.utils.toWei("300", "ether"));
      expect(stakerData[1].toString()).to.be.equal("73");

      await interestDistribution
        .withdrawStakeAndInterest(user1, web3.utils.toWei("110", "ether"))
        .catch(e => e);

      stakerData = await interestDistribution.getStakerData(user1);
      
      // total stake will drop to 190 and weighted stake should still be 73
      expect(stakerData[0].toString()).to.be.equal(web3.utils.toWei("190", "ether"));
      expect(stakerData[1].toString()).to.be.equal("73");

      await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("100", "ether"), 20, 0, web3.utils.toWei("500", "ether"))
        .catch(e => e);

      stakerData = await interestDistribution.getStakerData(user1);
      
      // total stake will rise to 290 and weighted stake should be 75
      expect(stakerData[0].toString()).to.be.equal(web3.utils.toWei("290", "ether"));
      expect(stakerData[1].toString()).to.be.equal("75");
  });

  it("Simulate scenario 2", async () => {

      await interestDistribution
        .stakeCalculation(S1, web3.utils.toWei("10000", "ether"), 0, 0, web3.utils.toWei("10000", "ether"))
        .catch(e => e);

      await interestDistribution
        .addInterest(0, web3.utils.toWei("10000", "ether"))
        .catch(e => e);

      let earnedGDInterestS1 = await interestDistribution.calculateGDInterest(S1, 0, web3.utils.toWei("10000", "ether"));
      
      // expect(earnedGDInterestS1.toString()).to.be.equal("0");
      console.log("==>",earnedGDInterestS1);

      await interestDistribution
        .stakeCalculation(S2, web3.utils.toWei("20000", "ether"), 50, 0, web3.utils.toWei("30000", "ether"))
        .catch(e => e);

      earnedGDInterestS1 = await interestDistribution.calculateGDInterest(S1, 0, web3.utils.toWei("10000", "ether"));
      let earnedGDInterestS2 = await interestDistribution.calculateGDInterest(S2, 0, web3.utils.toWei("20000", "ether"));
      console.log("==>",earnedGDInterestS1);
      console.log("==>",earnedGDInterestS2);
      // expect(earnedGDInterestS1.toString()).to.be.equal("0");
      // expect(earnedGDInterestS2.toString()).to.be.equal("0");

      await interestDistribution
        .stakeCalculation(S3, web3.utils.toWei("40000", "ether"), 0, 220, web3.utils.toWei("70000", "ether"))
        .catch(e => e);

      await interestDistribution
        .addInterest(220, web3.utils.toWei("70000", "ether"))
        .catch(e => e);

      earnedGDInterestS1 = await interestDistribution.calculateGDInterest(S1, 0, web3.utils.toWei("10000", "ether"));
      earnedGDInterestS2 = await interestDistribution.calculateGDInterest(S2, 0, web3.utils.toWei("20000", "ether"));
      let earnedGDInterestS3 = await interestDistribution.calculateGDInterest(S2, 0, web3.utils.toWei("40000", "ether"));
        

      console.log("==>",earnedGDInterestS1);
      console.log("==>",earnedGDInterestS2);
      console.log("==>",earnedGDInterestS3);
      // expect(earnedGDInterestS1.toString()).to.be.equal("220");
      // expect(earnedGDInterestS2.toString()).to.be.equal("0");
      // expect(earnedGDInterestS3.toString()).to.be.equal("0");

      // stakerData = await interestDistribution.getStakerData(user1);
      
      // // total stake will rise to 290 and weighted stake should be 75
      // expect(stakerData[0].toString()).to.be.equal(web3.utils.toWei("290", "ether"));
      // expect(stakerData[1].toString()).to.be.equal("75");
  });

});
