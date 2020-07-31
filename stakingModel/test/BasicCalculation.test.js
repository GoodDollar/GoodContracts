const InterestDistributionMock = artifacts.require("InterestDistributionMock");

const BN = web3.utils.BN;


contract("InterestDistribution - Basic calculations", ([user1]) => {
  

  let interestDistribution;
  before(async () => {
    interestDistribution = await InterestDistributionMock.new();
    
  });

  it("Should return correct cumulative Yield Rate", async () => {

      // 1st stake will not affect GDYieldRate and GlobalYieldPerToken because globalTotalStaked is 0.
      await interestDistribution
        .stake(user1, web3.utils.toWei("20", "ether"), 0, 0, 0)
        .catch(e => e);

      /**
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
      * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
      * consider :
      * GlobalTotalEffectiveStake = 20 x 1e18
      * AccumulatedYieldPerToken(P) = 0
      * GDYieldRate(P) = 0
      * Staking = 10 x 1e18
      * Donation% = 30%
      * GDEarnedInterest = 100 x 1e18
      * GDEarnedInterestEarned = 100 x 1e18
      */

      await interestDistribution
        .stake(user1, web3.utils.toWei("10", "ether"), 30, web3.utils.toWei("100", "ether"), web3.utils.toWei("100", "ether"))
        .catch(e => e);

      let yieldData = await interestDistribution.getYieldData(user1);

      /**
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
      * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
      * 0 + (100)/20 = 5 => 5 x 1e27 (27 precision points)
      * 0 + (5 * 7) = 35 => 35 x 1e27 (27 precision points)
      */      
      expect((yieldData[0]/1e27).toString()).to.be.equal("5");
      expect((yieldData[1]/1e27).toString()).to.be.equal("35");
  });

  it("Set Accumulated Yield Per Token", async () => {


    /**
      * GDEarnedInterest = 60 x 1e18
      * GDEarnedInterestEarned = 60 x 1e18
      */
    await interestDistribution
        .updateGlobalGDYieldPerToken(web3.utils.toWei("27", "ether"), web3.utils.toWei("27", "ether"))
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);
    

    /**
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
      * 5 + (27)/27 = 5 + 1 => 6 x 1e27 (27 precision points)
      */ 
    expect((Math.round(yieldData[0]/1e27)).toString()).to.be.equal("6");
  });

  it("Should return correct G$ interest", async () => {

    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (GDYieldRate + WithdrawnToDate), 0]
      * consider :
      * GDYieldRate(P) = 35
      * AccumulatedYieldPerToken(P) = 6
      * TotalEfectiveStaked = 27 x 1e18
      * WithdrawnToDate = 0
      * output = 127 x 1e2
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1);
      
      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (GDYieldRate + WithdrawnToDate), 0]
      * Max[27 * 6 - (35 + 0), 0] = Max[162 - 35, 0] = Max[127, 0] = 127 = 2 points presicion 12700
      */
      expect(earnedGDInterest.toString()).to.be.equal("12700");
  });

  it("Should return G$ interest as 0 if (GDYieldRate + WithdrawnToDate) > TotalEfectiveStaked x AccumulatedYieldPerDAI", async () => {


    // withdrawing G$ interest 
    await interestDistribution
        .withdrawGDInterest(user1, 0, 0)
        .catch(e => e);


    let stkerData = await interestDistribution.getStakerData(user1);
    expect(stkerData[3].toString()).to.be.equal("12700");

    /**
      * Effective stake
      */
    // Manipulate GDYieldRate to create scenario.
    await interestDistribution
        .updateGDYieldRate(user1, web3.utils.toWei("3", "ether"))
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);

    /*
      * Formula:
      * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
      * 35 + (6 * 3) = 35 + 18 =  53
      */
    expect((yieldData[1]/1e27).toString()).to.be.equal("53");


    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (GDYieldRate + WithdrawnToDate), 0]
      * consider :
      * GDYieldRate(P) = 53
      * AccumulatedYieldPerToken(P) = 6
      * TotalEfectiveStaked = 27 x 1e18
      * WithdrawnToDate = 127 x 1e2
      * output = 0
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1);
      

      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * TotalEfectiveStaked x AccumulatedYieldPerDAI(27 * 6 = 162) < WithdrawnToDate + GDYieldRate(127 + 53 = 180), Hence output is 0.
      */
      expect(earnedGDInterest.toString()).to.be.equal(web3.utils.toWei("0"));
  });

});
