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
      
      /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * (10*1e2)/(100) = 10.
      */
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

      /**
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * (10*10*1e18*(100-30)%)/(20*1e18) = (100*70%)/20 =  3.5 = 3
      */      
      expect(avgYieldRatePerToken.toString()).to.be.equal("3");
  });

  it("Set Accumulated Yield Per Token and Avg Yield Rate Per Token", async () => {


    /**
      * Daily interest = 100
      * Grand total stake = 10 x 10^18
      */
    await interestDistribution
        .addInterest(100, web3.utils.toWei("10", "ether"))
        .catch(e => e);

    /**
      * Stake = 10 x 10^18
      * Donation = 0%
      * Daily interest = 70 x 1e2
      * Grand total stake = 1000 x 10^18
      */
    await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("10", "ether"), 0, 70*1e2, web3.utils.toWei("1000", "ether"))
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);
    

    /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * (1*1e2)/(10) = 10.
      * ((70*1e2/1000)*10*1e18*(100-0)%)/(10*1e18) = (7*100%)/20 =  7
      */
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
      
      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * Max[20 * (10 - 7) - 10, 0] = Max[, 0] = Max[20 * 3 - 10, 0] = Max[50, 0] = 50 = 2 points presicion 5000
      */
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
      

      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * interest(60) < WithdrawnToDate(70), Hence output is 0.
      */
      expect(earnedGDInterest.toString()).to.be.equal(web3.utils.toWei("0"));
  });

  it("Should return G$ interest as 0 if AvgYieldRatePerToken > AccumulatedYieldPerToken", async () => {

    /**
      * Stake = 1 x 10^18
      * Donation = 0%
      * Daily interest = 110 x 1e2
      * Grand total stake = 100 x 10^18
      */
    await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("1", "ether"), 0, 110*1e2, web3.utils.toWei("100", "ether"))
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);
    

    /**
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * No new Tx so no change in value = 10.
      * 7 + ((110*1e2/100)*1*1e18*(100-0)%)/(11*1e18) = 7 + (110*100%)/11 = (7 + 10) = 17
      */
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
      
      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * AccumulatedYieldPerToken(10) < AvgYieldRatePerToken(17), Hence output is 0.
      */
      expect(earnedGDInterest.toString()).to.be.equal(web3.utils.toWei("0"));
  });
});
