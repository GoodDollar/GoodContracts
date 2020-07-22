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

      let accumulatedYieldPerToken = await interestDistribution.getGlobalYieldPerToken(10*1e2, web3.utils.toWei("100", "ether"));
      
      /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * (10*1e2)/(100) = 10.
      */
      expect(accumulatedYieldPerToken.toString()).to.be.equal("10");
  });

  it("Should return correct Accumulated Yield Per Token when Token's decimal is less than 18", async () => {

    /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * consider :
      * AccumulatedYieldPerToken(P) = 0
      * Daily Interest = 10 x 1e2
      * GrandTotalStaked = 100 x 1e10
      * output = 10
      */

      let accumulatedYieldPerToken = await interestDistribution.mockGetGlobalYieldPerToken(10*1e2, (100*1e10).toString(), 10);
      
      /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * (10*1e2)/(100) = 10.
      */
      expect(accumulatedYieldPerToken.toString()).to.be.equal("10");
  });

  it("Should return correct Accumulated Yield Per Token when Token's decimal is more than 18", async () => {

    /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * consider :
      * AccumulatedYieldPerToken(P) = 0
      * Daily Interest = 10 x 1e2
      * GrandTotalStaked = 100 x 1e20
      * output = 10
      */
      let accumulatedYieldPerToken = await interestDistribution.mockGetGlobalYieldPerToken(10*1e2, web3.utils.toWei("10000", "ether"), 20);

      /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * (10*1e2)/(100) = 10.
      */
      expect(accumulatedYieldPerToken.toString()).to.be.equal("10");
  });

  it("Should return correct Avg Yield Rate Per Token", async () => {

      // 1st stake will not affect AvgYieldRatePerToken because globalTotalStaked and totalStaked both are 0.
      await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("20", "ether"), 0, 0)
        .catch(e => e);


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

      await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("10", "ether"), 30, 2*1e2)
        .catch(e => e);

      let yieldData = await interestDistribution.getYieldData(user1);

      /**
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * (10*10*1e18*(100-30)%)/(20*1e18) = (100*70%)/20 =  3.5 = 3
      */      
      expect(yieldData[1].toString()).to.be.equal("3");
  });

  it("Set Accumulated Yield Per Token and Avg Yield Rate Per Token", async () => {


    /**
      * Daily interest = 300
      */
    await interestDistribution
        .updateInterest(3*1e2)
        .catch(e => e);


    /**
      * Stake = 5 x 10^18
      * Donation = 0%
      * Daily interest = 9 x 1e2
      */
    await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("5", "ether"), 0, 6*1e2)
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);
    

    /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * (3*1e2)/(30) = 10.
      * 3 + ((10 + 6*1e2/30)*5*1e18*(100-0)%)/(30*1e18) = 3 + (30*5*100%)/30 =  8
      */
    expect(yieldData[0].toString()).to.be.equal("10");
    expect(yieldData[1].toString()).to.be.equal("8");
  });

  it("Should return correct G$ interest", async () => {

    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * consider :
      * AvgYieldRatePerToken(P) = 8
      * AccumulatedYieldPerToken(P) = 10
      * TotalStaked = 35 x 1e18
      * WithdrawnToDate = 0;
      * output = 70 x 1e2
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1);
      
      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * Max[35 * (10 - 8) - 0, 0] = Max[35 * 2, 0] = Max[70, 0] = 70 = 2 points presicion 7000
      */
      expect(earnedGDInterest.toString()).to.be.equal("7000");
  });

  it("Should return G$ interest as 0 if WithdrawnToDate > TotalStaked x (AccumulatedYieldPerToken - AvgYieldRatePerToken)", async () => {


    // withdrawing G$ interest 
    await interestDistribution
        .updateWithdrawnInterest(user1)
        .catch(e => e);


    let stkerData = await interestDistribution.getStakerData(user1);
    expect(stkerData[3].toString()).to.be.equal("7000");

    /**
      * Stake = 3.5 x 10^18
      * Donation = 0%
      * Daily interest = 0
      */
    // Staking so we can manipulate AvgYieldRatePerDAI
    await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("3.5", "ether"), 0, 0)
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);

    /**
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * 8 + ((10 + 0/30)*3.5*1e18*(100-0)%)/(35*1e18) = 8 + (10*0.1*100%)/30 =  9
      */
    expect(yieldData[1].toString()).to.be.equal("9");


    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * consider :
      * AvgYieldRatePerToken(P) = 9
      * AccumulatedYieldPerToken(P) = 10
      * TotalStaked = 38.5 x 1e18
      * WithdrawnToDate = 70 x 1e2;
      * output = 0
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1);
      

      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * interest(38.5) < WithdrawnToDate(70), Hence output is 0.
      */
      expect(earnedGDInterest.toString()).to.be.equal(web3.utils.toWei("0"));
  });

  it("Should return G$ interest as 0 if AvgYieldRatePerToken > AccumulatedYieldPerToken", async () => {

    /**
      * Stake = 7.7 x 10^18
      * Donation = 0%
      * Daily interest = 0
      */
    // Staking so we can manipulate AvgYieldRatePerDAI
    await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("7.7", "ether"), 0, 0)
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);
    

    /**
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * No new Tx so no change in value = 10.
      * 9 + (10 + (0/38.5)*7.7*1e18*(100-0)%)/(38.5*1e18) = 9 + (10*7.7*100%)/38.5 = (9 + 2) = 11
      */
    expect(yieldData[0].toString()).to.be.equal("10");
    expect(yieldData[1].toString()).to.be.equal("11");

    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * consider :
      * AvgYieldRatePerToken(P) = 11
      * AccumulatedYieldPerToken(P) = 10
      * TotalStaked = 46.2 x 1e18
      * WithdrawnToDate = 70 x 1e18;
      * output = 0
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1);
      
      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * AccumulatedYieldPerToken(10) < AvgYieldRatePerToken(11), Hence output is 0.
      */
      expect(earnedGDInterest.toString()).to.be.equal(web3.utils.toWei("0"));
  });
});
