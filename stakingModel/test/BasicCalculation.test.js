const InterestDistributionMock = artifacts.require("InterestDistributionMock");

const BN = web3.utils.BN;


contract("InterestDistribution - Basic calculations", ([user1]) => {
  

  let interestDistribution;
  before(async () => {
    interestDistribution = await InterestDistributionMock.new();
    
  });

  it("Should return correct Accumulated Yield Per Token", async () => {

    /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * consider :
      * AccumulatedYieldPerToken(P) = 0
      * Daily Interest = 10 x 1e2
      * GrandTotalStaked = 100 x 1e18
      * output = 10
      */

      let accumulatedYieldPerToken = await interestDistribution.getAccumulatedYieldPerToken(10*1e2, web3.utils.toWei("100", "ether"));
      
      expect(accumulatedYieldPerToken.toString()).to.be.equal("10");
  });

  it("Should return correct Avg Yield Rate Per Token", async () => {

    /**
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * consider :
      * AvgYieldRatePerToken(P) = 0
      * AccumulatedYieldPerToken(P) = 10
      * Staking = 10 x 1e18
      * Donation% = 30%
      * TotalStaked = 20 x 1e18
      * output = 3
      */

      let avgYieldRatePerToken = await interestDistribution.getAvgYieldRatePerToken(10, web3.utils.toWei("10", "ether"), 30, web3.utils.toWei("20", "ether"));
      
      expect(avgYieldRatePerToken.toString()).to.be.equal("3");
  });

  it("Set Accumulated Yield Per Token and Avg Yield Rate Per Token", async () => {


    await interestDistribution
        .addAccumulatedYieldPerToken(10)
        .catch(e => e);

    await interestDistribution
        .addAvgYieldRatePerToken(user1, 7)
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);
    
    expect(yieldData[0].toString()).to.be.equal("10");
    expect(yieldData[1].toString()).to.be.equal("7");
  });

  it("Should return correct G$ interest", async () => {

    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * consider :
      * AvgYieldRatePerToken(P) = 7
      * AccumulatedYieldPerToken(P) = 10
      * TotalStaked = 20 x 1e18
      * WithdrawnToDate = 10 x 1e18;
      * output = 50 x 1e18
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1, web3.utils.toWei("10", "ether"), web3.utils.toWei("20", "ether"));
      
      expect(earnedGDInterest.toString()).to.be.equal("5000");
  });

  it("Should return G$ interest as 0 if WithdrawnToDate > TotalStaked x (AccumulatedYieldPerToken - AvgYieldRatePerToken)", async () => {

    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * consider :
      * AvgYieldRatePerToken(P) = 7
      * AccumulatedYieldPerToken(P) = 10
      * TotalStaked = 20 x 1e18
      * WithdrawnToDate = 70 x 1e18;
      * output = 0
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1, web3.utils.toWei("70", "ether"), web3.utils.toWei("20", "ether"));
      
      expect(earnedGDInterest.toString()).to.be.equal(web3.utils.toWei("0"));
  });

  it("Should return G$ interest as 0 if AvgYieldRatePerToken > AccumulatedYieldPerToken", async () => {

    await interestDistribution
        .addAvgYieldRatePerToken(user1, 10)
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);
    
    expect(yieldData[0].toString()).to.be.equal("10");
    expect(yieldData[1].toString()).to.be.equal("17");

    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * consider :
      * AvgYieldRatePerToken(P) = 17
      * AccumulatedYieldPerToken(P) = 10
      * TotalStaked = 20 x 1e18
      * WithdrawnToDate = 10 x 1e18;
      * output = 0
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1, web3.utils.toWei("10", "ether"), web3.utils.toWei("20", "ether"));
      
      expect(earnedGDInterest.toString()).to.be.equal(web3.utils.toWei("0"));
  });
});
