const InterestDistributionMock = artifacts.require("InterestDistributionMock");

const BN = web3.utils.BN;


contract("InterestDistribution - Scenario based calculations", ([S1, S2, S3]) => {
  
  describe('Multiple Staker stakes right after interest cycle, no withdrawal', function() {
    let interestDistribution;
    before(async () => {
      interestDistribution = await InterestDistributionMock.new();
    });

    it("Staker 1 stakes 100 Token and donate 20% of interest", async () => {

      // Setting Interest token rate
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("0.4", "ether"))
          .catch(e => e);

      /**
        * S1 stakes 100DAI, donating 20%
        */
        await interestDistribution
          .stake(S1, web3.utils.toWei("100", "ether"), 20)
          .catch(e => e);


        let stakerData = await interestDistribution.getStakerData(S1);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S1);

        // 1st stake so globalTotalEffectiveStake is 0, hence 
        // globalGDYieldPerToken and gdYieldRate are  0.
        expect((yieldData[0]).toString()).to.be.equal("0");
        expect((yieldData[1]).toString()).to.be.equal("0");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("100", "ether")); 
        // globalTotalEffectiveStake
        expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("80", "ether")); 
        // gdInterestEarnedToDate, no interest earned yet 
        expect((interestData[3]).toString()).to.be.equal("0");  
        // interestTokenEarnedToDate, no interest earned yet
        expect((interestData[4]).toString()).to.be.equal("0"); 

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("100", "ether")); 
        // totalEffectiveStake of S1
        expect((stakerData[1]).toString()).to.be.equal(web3.utils.toWei("80", "ether")); 

        /*
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 0 + (100 / 0.4) - 0 = 0 + 250 - 0 = 250 , precision points 18
        */
        expect((await interestDistribution.iTokenBalance()).toString()).to.be.equal(web3.utils.toWei("250", "ether")); 

        // 1st stake, so no interest generated yet
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("0");

        // 1st stake, so no interest generated yet
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("0"); 
    });

    it("Staker 2 stakes 50 Token and donate 50% of interest", async () => {

      // Updating Interest token rate
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("0.5", "ether"))
          .catch(e => e);


      /**
        * S2 stakes 50DAI, donating 50%
        * will mint 10,000 new GD. total stake = 150, iTokenBalance = 350
        * Required iToken = 150/0.5 = 300, excessIToken = 50.
        * newlyMintGD = 50 x 200 = 10,000
        */
        await interestDistribution
          .stake(S2, web3.utils.toWei("50", "ether"), 50)
          .catch(e => e);


        let stakerData = await interestDistribution.getStakerData(S2);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S2);

        /**
        *
        * values:
        * GDEarnedInterest = 8000 (80 x 10000 / 100)
        * GlobalTotalEffectiveStake = 80 (100 x (100% - 20%))
        * EffectiveStake = 25 (50 x (100% - 50%))
        * Formula:
        * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
        * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
        * 0 + (8000)/80 = 100 => 100 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
        * 0 + (100 * 25) = 2500 => 2500 x 1e29 (27 + 2(G$ precision) = 29 precision points)
        */      
        expect((Math.floor(yieldData[0]/1e11)).toString()).to.be.equal("100");
        expect((Math.floor(yieldData[1]/1e29)).toString()).to.be.equal("2500");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("150", "ether")); 
        // globalTotalEffectiveStake
        expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("105", "ether")); 
        // gdInterestEarnedToDate, 8000 (80 x 10000 / 100)
        expect((interestData[3]).toString()).to.be.equal("800000");  
        // interestTokenEarnedToDate, 10000
        expect((interestData[4]).toString()).to.be.equal("1000000"); 

        // totalStake of S2
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("50", "ether")); 
        // totalEffectiveStake of S2
        expect((stakerData[1]).toString()).to.be.equal(web3.utils.toWei("25", "ether")); 

        /*
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 250 + (50 / 0.5) - 50 = 250 + 100 - 50 = 300 , precision points 18
        */
        expect((await interestDistribution.iTokenBalance()).toString()).to.be.equal(web3.utils.toWei("300", "ether")); 

        /*
        * Formula:
        * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
        * 0 + 10000 - 8000 = 2000 , precision points 2
        */
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("200000");

        /*
        * Formula:
        * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
        * 0 + (10000 x 80 / 100) = 0 + 8000 = 8000 , precision points 2
        */
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("800000"); 
    });

    it("Staker 3 stakes 360 Token and donate 40% of interest", async () => {

      // Updating Interest token rate
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("0.6", "ether"))
          .catch(e => e);

      /**
        * S3 stakes 360DAI, donating 40%
        * will mint 10,000 new GD. total stake = 510, iTokenBalance = 900
        * Required iToken = 510/0.6 = 850, excessIToken = 50.
        * newlyMintGD = 50 x 200 = 10,000
        */
        await interestDistribution
          .stake(S3, web3.utils.toWei("360", "ether"), 40)
          .catch(e => e);

        let stakerData = await interestDistribution.getStakerData(S3);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S3);

        /**
        *
        * values:
        * GDEarnedInterest = 7000 (105 x 10000 / 150)
        * GlobalTotalEffectiveStake = 105 (80 + 50 x (100% - 50%))
        * EffectiveStake = 216 (360 x (100% - 40%))
        * Formula:
        * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
        * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
        * 100 + (7000)/105 = 100 + 66.667 => 166.67 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
        * 0 + (166.67 * 216) = 35999 => 35999 x 1e29 (27 + 2(G$ precision) = 29 precision points)
        */   
        expect((Math.floor(yieldData[0]/1e11)).toString()).to.be.equal("166");
        expect((Math.floor(yieldData[1]/1e29)).toString()).to.be.equal("35999");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("510", "ether")); 
        // globalTotalEffectiveStake
        expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("321", "ether")); 
        // gdInterestEarnedToDate, 8000 + 7000 (8000 + 105 x 10000 / 150)
        expect((interestData[3]).toString()).to.be.equal("1500000");  
        // interestTokenEarnedToDate, 10000 + 10000
        expect((interestData[4]).toString()).to.be.equal("2000000"); 

        // totalStake of S3
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("360", "ether")); 
        // totalEffectiveStake of S3
        expect((stakerData[1]).toString()).to.be.equal(web3.utils.toWei("216", "ether")); 

        /*
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 300 + (360 / 0.6) - 50 = 300 + 600 - 50 = 850 , precision points 18
        */
        expect((await interestDistribution.iTokenBalance()).toString()).to.be.equal(web3.utils.toWei("850", "ether")); 

        /*
        * Formula:
        * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
        * 2000 + 10000 - 7000 = 2000 + 3000 , precision points 2
        */
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("500000");

        /*
        * Formula:
        * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
        * 8000 + (10000 x 105 / 150) = 8000 + 7000 = 15000 , precision points 2
        */
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("1500000"); 
    });

    it("Staker 1 again stakes 250 Token and donate 60% of interest", async () => {

      // Updating Interest token rate
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("0.65", "ether"))
          .catch(e => e);

      /**
        * S1 stakes 250DAI, donating 60%
        * will mint 13,076.92 new GD. total stake = 760, iTokenBalance = 1234.61
        * Required iToken = 760/0.65 = 1169.23, excessIToken = 65.37.
        * newlyMintGD = 65.37 x 200 = 13,076.92
        */
        await interestDistribution
          .stake(S1, web3.utils.toWei("250", "ether"), 60)
          .catch(e => e);

        let stakerData = await interestDistribution.getStakerData(S1);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S1);

        /**
        *
        * values:
        * GDEarnedInterest = 8230.76 (321 x 13,076.92 / 510)
        * GlobalTotalEffectiveStake = 321 (105 + 360 x (100% - 40%))
        * EffectiveStake = 100 (250 x (100% - 60%))
        * Formula:
        * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
        * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
        * 166.67 + (8230.76)/321 = 166.667 + 25.64 => 192.30 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
        * 0 + (192.30 * 100) = 19230.76 => 19230.76 x 1e29 (27 + 2(G$ precision) = 29 precision points)
        */      
        expect((Math.floor(yieldData[0]/1e11)).toString()).to.be.equal("192");
        expect((Math.floor(yieldData[1]/1e29)).toString()).to.be.equal("19230");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("760", "ether")); 
        // globalTotalEffectiveStake
        expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("421", "ether")); 
        // gdInterestEarnedToDate, 15000 + 8230.76 (15000 + 321 x 13,076.92 / 510)
        expect((interestData[3]).toString()).to.be.equal("2323076");  
        // interestTokenEarnedToDate, 20000 + 13,076.92
        expect((interestData[4]).toString()).to.be.equal("3307692"); 

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("350", "ether")); 
        // totalEffectiveStake of S1
        expect((stakerData[1]).toString()).to.be.equal(web3.utils.toWei("180", "ether")); 

        /*
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 850 + (250 / 0.65) - 65.37 = 850 + 384.61 - 65.37 = 1169.24539 , precision points 18
        */
        expect((Math.floor(await interestDistribution.iTokenBalance()/1e18)).toString()).to.be.equal("1169"); 

        /*
        * Formula:
        * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
        * 5000 + 13,076.92 - 8230.76 = 5000 + 4846.16 = 9846.16 , precision points 2
        */
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("984616");

        /*
        * Formula:
        * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
        * 15000 + (13,076.92 x 321 / 510) = 15000 + 8230.76 = 23230.76 , precision points 2
        */
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("2323076");  
    });

    it("Collecting all GD for excess interest token holding", async () => {

      // Updating Interest token rate
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("0.7", "ether"))
          .catch(e => e);

      /**
        * will mint 16703.29 new GD. total stake = 760, iTokenBalance = 1169
        * Required iToken = 760/0.7 = 1085.71, excessIToken = 83.28.
        * newlyMintGD = 83.28 x 16703.29 = 13,076.92
        */    
      await interestDistribution
          .collectUBIInterest()
          .catch(e => e);

      
      let interestData = await interestDistribution.getInterestData();
      

      /**
      *
      * values:
      * GDEarnedInterest = 9252.74 (421 x 16703.29 / 760)
      * GlobalTotalEffectiveStake = 421 (321 + 250 x (100% - 60%))
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
      * 192.30 + (9252.74)/421 = 192.30 + 25.64 => 214.285 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
      */      
      expect((Math.floor(interestData[1]/1e11)).toString()).to.be.equal("214");

      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("760", "ether")); 
      // globalTotalEffectiveStake
      expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("421", "ether")); 
      // gdInterestEarnedToDate, 23230.76 + 9252.74 (23230.76 + 421 x 16703.29 / 760)
      expect((interestData[3]).toString()).to.be.equal("3248350");  
      // interestTokenEarnedToDate, 33076.92 + 16703.29
      expect((interestData[4]).toString()).to.be.equal("4978021"); 

      /*
      * Formula:
      * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
      * 1169.24539 + 0 - 82.28 = 1169.24539 - 82.28 = 1085(approx) , precision points 18
      */
      expect((Math.floor(await interestDistribution.iTokenBalance()/1e18)).toString()).to.be.equal("1085"); 

      /*
      * Formula:
      * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
      * 9846.16 + 16703.29 - 9252.74 = 9846.16 + 7450.55 = 17296.71 , precision points 2
      */
      expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("1729671");

      /*
      * Formula:
      * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
      * 23230.76 + (16703.29 x 421 / 760) = 23230.76 + 9252.74 = 32483.50 , precision points 2
      */
      expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("3248350");
    });
  });

});
