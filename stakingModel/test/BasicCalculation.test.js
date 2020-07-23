const InterestDistributionMock = artifacts.require("InterestDistributionMock");

const BN = web3.utils.BN;


contract("InterestDistribution - Basic calculations", ([user1]) => {
  

  let interestDistribution;
  before(async () => {
    interestDistribution = await InterestDistributionMock.new();
    
  });

  it("Should return correct Avg Yield Rate Per Token", async () => {

      // 1st stake will not affect AvgYieldRatePerToken and GlobalYieldPerToken because globalTotalStaked and totalStaked both are 0.
      await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("20", "ether"), 0, web3.utils.toWei("1", "ether"), web3.utils.toWei("1", "ether"))
        .catch(e => e);


      /**
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + [(IntrestTokenRate - LastTokenRate) x IntrestTokenHoldings]/GlobalTotalStake
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * consider :
      * IntrestTokenRate = 1.02
      * LastTokenRate = 1
      * IntrestTokenHoldings = 30 x 1e18
      * GlobalTotalStake = 20 x 1e18
      * AccumulatedYieldPerToken(P) = 3
      * AvgYieldRatePerToken(P) = 0
      * Staking = 10 x 1e18
      * Donation% = 30%
      * TotalStaked = 20 x 1e18
      * output = 3
      */

      await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("10", "ether"), 30, web3.utils.toWei("1.02", "ether"), web3.utils.toWei("30", "ether"))
        .catch(e => e);

      let yieldData = await interestDistribution.getYieldData(user1);

      /**
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + [(IntrestTokenRate - LastTokenRate) x IntrestTokenHoldings]/GlobalTotalStake
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * 0 + [(1.02 - 1) x 30]/20 = [0.02 x 30]x100/20 = 3
      * (3*10*1e18*(100-30)%)/(20*1e18) = (30*70%)/20 =  1.05 = 1
      */      
      expect(yieldData[0].toString()).to.be.equal("3");
      expect(yieldData[1].toString()).to.be.equal("1");
  });

  it("Set Accumulated Yield Per Token and Avg Yield Rate Per Token", async () => {


    /**
      * Stake = 5 x 10^18
      * Donation = 0%
      * IntrestTokenRate = 1.03
      * LastTokenRate = 1.02
      * IntrestTokenHoldings = 60 x 1e18
      */
    await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("6", "ether"), 0, web3.utils.toWei("1.03", "ether"), web3.utils.toWei("60", "ether"))
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);
    

    /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * 3 + [(1.03 - 1.02)x100 x 60]/30 = 3 + [0.01 x 60]x100/30 = 3 + 2 = 5
      * 1 + (6)*5*1e18*(100-0)%)/(30*1e18) = 1 + (30*100%)/30 =  2
      */
    expect(yieldData[0].toString()).to.be.equal("5");
    expect(yieldData[1].toString()).to.be.equal("2");
  });

  it("Should return correct G$ interest", async () => {

    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * consider :
      * AvgYieldRatePerToken(P) = 2
      * AccumulatedYieldPerToken(P) = 5
      * TotalStaked = 36 x 1e18
      * WithdrawnToDate = 0;
      * output = 180 x 1e2
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1);
      
      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * Max[36 * (5 - 2) - 0, 0] = Max[36 * 3, 0] = Max[108, 0] = 108 = 2 points presicion 10800
      */
      expect(earnedGDInterest.toString()).to.be.equal("10800");
  });

  it("Should return G$ interest as 0 if WithdrawnToDate > TotalStaked x (AccumulatedYieldPerToken - AvgYieldRatePerToken)", async () => {


    // withdrawing G$ interest 
    await interestDistribution
        .updateWithdrawnInterest(user1)
        .catch(e => e);


    let stkerData = await interestDistribution.getStakerData(user1);
    expect(stkerData[3].toString()).to.be.equal("10800");

    /**
      * Stake = 7.2 x 10^18
      * Donation = 0%
      * IntrestTokenRate = 1.03
      * LastTokenRate = 1.03
      * IntrestTokenHoldings = 60 x 1e18
      */
    // Staking so we can manipulate AvgYieldRatePerDAI
    await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("7.2", "ether"), 0, web3.utils.toWei("1.03", "ether"), web3.utils.toWei("60", "ether"))
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);

    /**
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * 5 + [(1.03 - 1.03) x 60]/36 = 5 + [0 x 60]x100/36 = 5 + 0 = 5
      * 2 + (5*7.2*1e18*(100-0)%)/(36*1e18) = 2 + (36*100%)/36 =  3
      */
    expect(yieldData[0].toString()).to.be.equal("5");
    expect(yieldData[1].toString()).to.be.equal("3");


    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * consider :
      * AvgYieldRatePerToken(P) = 3
      * AccumulatedYieldPerToken(P) = 5
      * TotalStaked = 43.2 x 1e18
      * WithdrawnToDate = 108 x 1e2;
      * output = 0
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1);
      

      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * interest(72) < WithdrawnToDate(108), Hence output is 0.
      */
      expect(earnedGDInterest.toString()).to.be.equal(web3.utils.toWei("0"));
  });

  it("Should return G$ interest as 0 if AvgYieldRatePerToken > AccumulatedYieldPerToken", async () => {

    /**
      * Stake = 26 x 10^18
      * Donation = 0%
      * IntrestTokenRate = 1.03
      * LastTokenRate = 1.03
      * IntrestTokenHoldings = 60 x 1e18
      */
    // Staking so we can manipulate AvgYieldRatePerDAI
    await interestDistribution
        .stakeCalculation(user1, web3.utils.toWei("26", "ether"), 0, web3.utils.toWei("1.03", "ether"), web3.utils.toWei("60", "ether"))
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);
    

    /**
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * 5 + [(1.03 - 1.03) x 60]/43.2 = 5 + [0 x 60]x100/43.2 = 5 + 0 = 5
      * 3 + (5*26*1e18*(100-0)%)/(43.2*1e18) = 3 + (130*100%)/43.2 =  3 + 3.009 = 6
      */
    expect(yieldData[0].toString()).to.be.equal("5");
    expect(yieldData[1].toString()).to.be.equal("6");

    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * consider :
      * AvgYieldRatePerToken(P) = 6
      * AccumulatedYieldPerToken(P) = 5
      * TotalStaked = 69.2 x 1e18
      * WithdrawnToDate = 108 x 1e18;
      * output = 0
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1);
      
      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * AccumulatedYieldPerToken(5) < AvgYieldRatePerToken(6), Hence output is 0.
      */
      expect(earnedGDInterest.toString()).to.be.equal(web3.utils.toWei("0"));
  });
});
