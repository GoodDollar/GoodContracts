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
        .stake(user1, web3.utils.toWei("20", "ether"), 0)
        .catch(e => e);

      
      await interestDistribution
        .setITokenToTokenRate(web3.utils.toWei("0.4", "ether"))
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
      * GDEarnedInterest = 10000 x 1e2
      * GDEarnedInterestEarned = 10000 x 1e2
      */

      await interestDistribution
        .stake(user1, web3.utils.toWei("10", "ether"), 30)
        .catch(e => e);

      let yieldData = await interestDistribution.getYieldData(user1);

      /**
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
      * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
      * 0 + (10000)/20 = 500 => 500 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
      * 0 + (500 * 7) = 3500 => 3500 x 1e29 (27 + 2(G$ precision) = 29 precision points)
      */      
      expect((yieldData[0]/1e11).toString()).to.be.equal("500");
      expect((Math.round(yieldData[1]/1e29)).toString()).to.be.equal("3500");
  });

  it("Set Accumulated Yield Per Token", async () => {


    /**
      * GDEarnedInterest = 270 x 1e2
      * GDEarnedInterestEarned = 270 x 1e2
      */
    await interestDistribution
        .updateGlobalGDYieldPerToken(270 * 100, 270 * 100)
        .catch(e => e);

    let yieldData = await interestDistribution.getYieldData(user1);
    

    /**
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
      * 500 + (270)/27 = 500 + 10 => 510 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
      */ 
    expect((Math.round(yieldData[0]/1e11)).toString()).to.be.equal("510");
  });

  it("Should return correct G$ interest", async () => {

    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (GDYieldRate + WithdrawnToDate), 0]
      * consider :
      * GDYieldRate(P) = 3500 x 1e29
      * AccumulatedYieldPerToken(P) = 510 x 1e11
      * TotalEfectiveStaked = 27 x 1e18
      * WithdrawnToDate = 0
      * output = 10270 x 1e2
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1);
      
      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (GDYieldRate + WithdrawnToDate), 0]
      * Max[27 * 510 - (3500 + 0), 0] = Max[13770 - 3500, 0] = Max[10207, 0] = 10270 = 2 points presicion 1027000
      */
      expect(earnedGDInterest.toString()).to.be.equal("1027000");
  });

  it("Should return G$ interest as 0 if (GDYieldRate + WithdrawnToDate) > TotalEfectiveStaked x AccumulatedYieldPerDAI", async () => {


    // withdrawing G$ interest 
    await interestDistribution
        .withdrawGDInterest(user1)
        .catch(e => e);

    let stkerData = await interestDistribution.getStakerData(user1);
    expect(stkerData[3].toString()).to.be.equal("1027000");

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
      * 3500 + (510 * 3) = 3500 + 1530 =  5030
      */
      expect((Math.round(yieldData[1]/1e29)).toString()).to.be.equal("5030");


    /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (GDYieldRate + WithdrawnToDate), 0]
      * consider :
      * GDYieldRate(P) = 5030 x 1e29
      * AccumulatedYieldPerToken(P) = 510 x 1e11
      * TotalEfectiveStaked = 27 x 1e18
      * WithdrawnToDate = 10270 x 1e2
      * output = 0
      */

      let earnedGDInterest = await interestDistribution.calculateGDInterest(user1);
      

      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * TotalEfectiveStaked x AccumulatedYieldPerDAI(27 * 510 = 13770) < WithdrawnToDate + GDYieldRate(10270 + 5030 = 15300), Hence output is 0.
      */
      expect(earnedGDInterest.toString()).to.be.equal(web3.utils.toWei("0"));
  });

});
