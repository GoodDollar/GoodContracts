const InterestDistributionMock = artifacts.require("InterestDistributionMock");

const BN = web3.utils.BN;


contract("InterestDistribution - Scenario based calculations", ([S1, S2, S3]) => {
  let interestDistribution;
    before(async () => {
      interestDistribution = await InterestDistributionMock.new();
    });
  describe('Multiple Staker stakes right after interest cycle, no withdrawal', function() {
    
    it("Staker 1 stakes 100 Token and donate 20% of interest", async () => {

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 0.4 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
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

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 0.5 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
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
        // interestTokenEarnedToDate, 0 + 50
        expect((interestData[4]).toString()).to.be.equal(web3.utils.toWei("50", "ether")); 

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

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 0.6 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
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
        // interestTokenEarnedToDate, 50 + 50
        expect((interestData[4]).toString()).to.be.equal(web3.utils.toWei("100", "ether")); 

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

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 0.65 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
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
        // interestTokenEarnedToDate, 100 + 65.37
        expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("165"); 

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

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 0.7 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
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
      // interestTokenEarnedToDate, 165.37 + 83.28
      expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("248");  

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

      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (StakeBuyinRate + WithdrawnToDate), 0]
      */
      /**
      * Max[180 x 214.28 - (19230.76923 + 0),0] = Max[19340.65, 0] = 19340.64 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S1)).toString()).to.be.equal("1934065");
      /**
      * Max[25 x 214.28 - (2500 + 0),0] = Max[2857.14, 0] = 2857.14 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S2)).toString()).to.be.equal("285714");
      /**
      * Max[216 x 214.28 - (36000 + 0),0] = Max[10285.70, 0] = 10285.70 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S3)).toString()).to.be.equal("1028570");
    });
  });

  describe('Few stakers stake and Few staker withdraw Interest', function() {
    it("Staker 1 stakes 60 Token and donate 0% of interest", async () => {

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 0.8 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("0.8", "ether"))
          .catch(e => e);

      /**
        * S1 stakes 60DAI, donating 0%
        * will mint 27142.85714 new GD. total stake = 820, iTokenBalance = 1085.714
        * Required iToken = 820/0.8 = 300, excessIToken = 135.714
        * newlyMintGD = 135.714 x 200 = 27142.8
        */
        await interestDistribution
          .stake(S1, web3.utils.toWei("60", "ether"), 0)
          .catch(e => e);


        let stakerData = await interestDistribution.getStakerData(S1);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S1);

        /**
        *
        * values:
        * GDEarnedInterest = 15035.7142 (421 x 27142.85714 / 760)
        * GlobalTotalEffectiveStake = 421 (481 + 60 x (100% - 0%))
        * EffectiveStake = 60 (60 x (100% - 00%))
        * Formula:
        * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
        * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
        * 214.2857143 + (15035.7142)/421 = 214.2857143 + 35.71 => 249.99 x 1e11 (Approx) (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
        * 19230.76 + (249.99 * 60) = 19230.76 + 14999.4 => 34230.1599 x 1e29 (27 + 2(G$ precision) = 29 precision points)
        */   
        expect((Math.floor(yieldData[0]/1e11)).toString()).to.be.equal("249");
        expect((Math.floor(yieldData[1]/1e29)).toString()).to.be.equal("34230");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("820", "ether")); 
        // globalTotalEffectiveStake
        expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("481", "ether")); 
        // gdInterestEarnedToDate, 4751921 (32483.5164 + 421 x 27142.85714 / 760)
        expect((interestData[3]).toString()).to.be.equal("4751921");  
        // interestTokenEarnedToDate, 248.65 + 135.71
        expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("384"); 

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("410", "ether")); 
        // totalEffectiveStake of S1
        expect((stakerData[1]).toString()).to.be.equal(web3.utils.toWei("240", "ether")); 

        /*
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 1085.714286 + (60 / 0.8) - 135.714 = 1058.714 + 75 - 135.714 = 1025 , precision points 18
        */
        expect((await interestDistribution.iTokenBalance()).toString()).to.be.equal(web3.utils.toWei("1025", "ether")); 

        /*
        * Formula:
        * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
        * 17296.7033 + 27142.85714 - 15035.7142 = 29403.85 , precision points 2
        */
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("2940385");

        /*
        * Formula:
        * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
        * 32483.51 + (27142.85 x 421 / 760) = 0 + 8000 = 47519.21 , precision points 2
        */
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("4751921"); 
    });

    it("Staker 2 Withdraws their share of interest", async () => {

      /**
        * S2 Withdraws interest
        * will not mint new GD because no interest is generted since last update.
        */
        await interestDistribution
          .withdrawGDInterest(S2)
          .catch(e => e);


        let stakerData = await interestDistribution.getStakerData(S2);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S2);

        /**
        *
        * values:
        * Formula:
        * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
        * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
        * 249.99 + (0)/481 = 100 => 249.99 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
        * 2500 + (249 * 0) = 2500 => 2500 x 1e29 (27 + 2(G$ precision) = 29 precision points)
        */      
        expect((Math.floor(yieldData[0]/1e11)).toString()).to.be.equal("249");
        expect((Math.floor(yieldData[1]/1e29)).toString()).to.be.equal("2500");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("820", "ether")); 
        // globalTotalEffectiveStake
        expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("481", "ether")); 
        // gdInterestEarnedToDate, 47519.21 (32483.5164 + 0)
        expect((interestData[3]).toString()).to.be.equal("4751921");  
        // interestTokenEarnedToDate, 384.36 + 0
        expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("384"); 

        // totalStake of S2
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("50", "ether")); 
        // totalEffectiveStake of S2
        expect((stakerData[1]).toString()).to.be.equal(web3.utils.toWei("25", "ether")); 

        /**
        * Formula: 
        * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (StakeBuyinRate + WithdrawnToDate), 0]
        * Max[25 x 249.99 - (2500 + 0),0] = Max[3749.99, 0] = 3749.99 , precision points 2
        */
        expect((stakerData[3]).toString()).to.be.equal("374999"); 


        /*
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 1025 + (0 / 0.8) - 0 = 1025 + 0 - 0 = 1025 , precision points 18
        */
        expect((await interestDistribution.iTokenBalance()).toString()).to.be.equal(web3.utils.toWei("1025", "ether")); 

        /*
        * Formula:
        * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
        * 29403.85 + 0 - 0 = 29403.85 , precision points 2
        */
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("2940385");

        /*
        * Formula:
        * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
        * 47519.21 + (0 x 481 / 820) = 47519.21 + 0 = 47519.21 , precision points 2
        */
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("4751921"); 
    });

    it("Staker 3 Withdraws their share of interest", async () => {

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 0.9 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("0.9", "ether"))
          .catch(e => e);

      /**
        * S3 Withdraws interest
        * will mint 22777.77 new GD. total stake = 820, iTokenBalance = 1025
        * Required iToken = 820/0.9 = 911.11, excessIToken = 113.889.
        * newlyMintGD = 113.889 x 200 = 22777.77
        */
        await interestDistribution
          .withdrawGDInterest(S3)
          .catch(e => e);

        let stakerData = await interestDistribution.getStakerData(S3);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S3);

        /**
        *
        * values:
        * GDEarnedInterest = 13361.11 (481 x 22777.77 / 820)
        * GlobalTotalEffectiveStake = 481 (481 + 0)
        * EffectiveStake = 0
        * Formula:
        * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
        * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
        * 249.99 + (13361.11)/481 = 249.99 + 27.77 => 277.76 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
        * 35999 + 0 = 35999 => 35999 x 1e29 (27 + 2(G$ precision) = 29 precision points)
        */   
        expect((Math.floor(yieldData[0]/1e11)).toString()).to.be.equal("277");
        expect((Math.floor(yieldData[1]/1e29)).toString()).to.be.equal("35999");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("820", "ether")); 
        // globalTotalEffectiveStake
        expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("481", "ether")); 
        // gdInterestEarnedToDate, 47519.21 + 13361.10 (481 x 22777.77 / 820)
        expect((interestData[3]).toString()).to.be.equal("6088031");  
        // interestTokenEarnedToDate, 384.36 + 113.88
        expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("498"); 

        // totalStake of S3
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("360", "ether")); 
        // totalEffectiveStake of S3
        expect((stakerData[1]).toString()).to.be.equal(web3.utils.toWei("216", "ether"));

        /**
        * Formula: 
        * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (StakeBuyinRate + WithdrawnToDate), 0]
        * Max[216 x 277.77 - (36000 + 0),0] = Max[23999.98, 0] = 23999.98 , precision points 2
        */
        expect((stakerData[3]).toString()).to.be.equal("2399998");  

        /*
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 1025 + (0 / 0.9) - 113.88 = 911.12 , precision points 18
        */
        expect((await interestDistribution.iTokenBalance()).toString()).to.be.equal("911111111111111111111"); 

        /*
        * Formula:
        * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
        * 29403.85 + 22777.77 - 13361.11 = 38820.52 , precision points 2
        */
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("3882052");

        /*
        * Formula:
        * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
        * 47519.21 + (481 x 22777.77 / 820) = 60880.31 , precision points 2
        */
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("6088031"); 
    });

    it("Staker 2 stakes 100 Token and donate 30% of interest", async () => {

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 0.95 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("0.95", "ether"))
          .catch(e => e);

      /**
        * S2 stakes 100DAI, donating 30%
        * will mint 9590.64 new GD. total stake = 920, iTokenBalance = 1016.37
        * Required iToken = 920/0.95 = 968.42, excessIToken = 47.95.
        * newlyMintGD = 47.95 x 200 = 9590.64
        */
        await interestDistribution
          .stake(S2, web3.utils.toWei("100", "ether"), 30)
          .catch(e => e);

        let stakerData = await interestDistribution.getStakerData(S2);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S2);

        /**
        *
        * values:
        * GDEarnedInterest = 5625.73 (481 x 9590.643 / 820)
        * GlobalTotalEffectiveStake = 551 (481 + 100 x (100% - 30%))
        * EffectiveStake = 70 (100 x (100% - 30%))
        * Formula:
        * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
        * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
        * 277.77 + (5625.73)/481 = 277.77 + 11.69 => 289.47 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
        * 2500 + (289.47 * 70) = 22763.15 => 22763.15 x 1e29 (27 + 2(G$ precision) = 29 precision points)
        */      
        expect((Math.floor(yieldData[0]/1e11)).toString()).to.be.equal("289");
        expect((Math.floor(yieldData[1]/1e29)).toString()).to.be.equal("22763");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("920", "ether")); 
        // globalTotalEffectiveStake
        expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("551", "ether")); 
        // gdInterestEarnedToDate, 60880.31 + 5625.72 (481 x 9590.643 / 820)
        expect((interestData[3]).toString()).to.be.equal("6650603");  
        // interestTokenEarnedToDate, 498.24 + 47.95
        expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("546"); 

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("150", "ether")); 
        // totalEffectiveStake of S1
        expect((stakerData[1]).toString()).to.be.equal(web3.utils.toWei("95", "ether")); 

        /*
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 911.12 + (100 / 0.95) - 47.95 = 968.42 , precision points 18
        */
        expect((Math.floor(await interestDistribution.iTokenBalance()/1e18)).toString()).to.be.equal("968"); 

        /*
        * Formula:
        * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
        * 38820.52 + 9590.643 - 5625.73 = 42785.44 , precision points 2
        */
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("4278544");

        /*
        * Formula:
        * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
        * 60880.31 + (9590.643 x 481 / 820) = 66506.03 , precision points 2
        */
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("6650603");  
    });

    it("Collecting all GD for excess interest token holding", async () => {

      /**
        * will not mint new GD because no interest is generted since last update.
        */    
      await interestDistribution
          .collectUBIInterest()
          .catch(e => e);

      
      let interestData = await interestDistribution.getInterestData();
      
      /**
      *
      * values:
      * GDEarnedInterest = 0 (551 x 0 / 920)
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
      * 289.47 + (0)/551 = 289.473 => 289.47 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
      */      
      expect((Math.floor(interestData[1]/1e11)).toString()).to.be.equal("289");

      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("920", "ether")); 
      // globalTotalEffectiveStake
      expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("551", "ether")); 
      // gdInterestEarnedToDate, 66506.03 + 0 (66506.03 + 551 x 0 / 920)
      expect((interestData[3]).toString()).to.be.equal("6650603");  
      // interestTokenEarnedToDate, 546.19 + 0
      expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("546"); 

      /*
      * Formula:
      * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
      * 968.42 + 0 - 0 = 968.42 , precision points 18
      */
      expect((Math.floor(await interestDistribution.iTokenBalance()/1e18)).toString()).to.be.equal("968"); 

      /*
      * Formula:
      * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
      * 42785.44 + 0 - 0 = 42785.44 , precision points 2
      */
      expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("4278544");

      /*
      * Formula:
      * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
      * 66506.03 + (0 x 551 / 920) = 66506.03 + 0 = 66506.03 , precision points 2
      */
      expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("6650603");

      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (StakeBuyinRate + WithdrawnToDate), 0]
      */
      /**
      * Max[240 x 289.47 - (34230.76923 + 0),0] = Max[35242.89, 0] = 35242.89 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S1)).toString()).to.be.equal("3524289");
      /**
      * Max[95 x 289.47 - (22763.157 + 3750),0] = Max[986.84, 0] = 986.84 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S2)).toString()).to.be.equal("98684");
      /**
      * Max[216 x 289.47 - (36000 + 24000),0] = Max[2526.31, 0] = 2526.31 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S3)).toString()).to.be.equal("252631");
    });
  });

  describe('No one stakes in this interest cycle but Itoken rate will changes so some interest will be generated', function() {
    it("Collecting all GD for excess interest token holding", async () => {

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 1 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("1", "ether"))
          .catch(e => e);


      /**
        * will mint 9684.21 new GD. total stake = 920, iTokenBalance = 968.42
        * Required iToken = 920/1 = 920, excessIToken = 48.42.
        * newlyMintGD = 48.42 x 200 = 9684.21
        */    
      await interestDistribution
          .collectUBIInterest()
          .catch(e => e);

      
      let interestData = await interestDistribution.getInterestData();
      
      /**
      *
      * values:
      * GDEarnedInterest = 5800 (551 x 9684.21 / 920)
      * GlobalTotalEffectiveStake = 551 
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
      * 289.47 + (5800)/551 = 289.47 + 10.52 => 299.99 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
      */      
      expect((Math.floor(interestData[1]/1e11)).toString()).to.be.equal("299");

      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("920", "ether")); 
      // globalTotalEffectiveStake
      expect((interestData[2]).toString()).to.be.equal(web3.utils.toWei("551", "ether")); 
      // gdInterestEarnedToDate, 66506.03 + 5800 (66506.03 + 551 x 9684.21 / 920)
      expect((interestData[3]).toString()).to.be.equal("7230602");  
      // interestTokenEarnedToDate, 546.19 + 48.42
      expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("594"); 

      /*
      * Formula:
      * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
      * 968.42 + 0 - 48.42 = 920 , precision points 18
      */
      expect((Math.floor(await interestDistribution.iTokenBalance()/1e18)).toString()).to.be.equal("920"); 

      /*
      * Formula:
      * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
      * 42785.44 + 9684.21 - 5800 = 46669.63 , precision points 2
      */
      expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("4666966");

      /*
      * Formula:
      * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
      * 66506.03 + (9684.21 x 551 / 920) = 66506.03 + 5799.99 = 72306.02 , precision points 2
      */
      expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("7230602");

      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (StakeBuyinRate + WithdrawnToDate), 0]
      */
      /**
      * Max[240 x 299.99 - (34230.76923 + 0),0] = Max[37769.20, 0] = 37769.20 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S1)).toString()).to.be.equal("3776920");
      /**
      * Max[95 x 299.99 - (22763.157 + 3750),0] = Max[1986.84, 0] = 1986.84 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S2)).toString()).to.be.equal("198684");
      /**
      * Max[216 x 299.99 - (36000 + 24000),0] = Max[4799.99, 0] = 4799.99 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S3)).toString()).to.be.equal("479999");
    });
  });

  describe('Few stakers stakes and few staker withdraw Interest and stake', function() {
    it("Staker 1 Withdraws partial stake worth 150 Token", async () => {

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 1.05 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("1.05", "ether"))
          .catch(e => e);

      /**
        * S1 withdraws stakes worth 150DAI
        * will mint 8761.9047 new GD. total stake = 770, iTokenBalance = 777.142
        * Required iToken = 770/1.05 = 733.33, excessIToken = 43.80
        * newlyMintGD = 43.80 x 200 = 8761.9047
        */
        await interestDistribution
          .withdrawStakeAndInterest(S1, web3.utils.toWei("150", "ether"))
          .catch(e => e);

        let stakerData = await interestDistribution.getStakerData(S1);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S1);


        /**
        * Formula: 
        * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (StakeBuyinRate + WithdrawnToDate), 0]
        * Max[240 x 309.52 - (34230.76923 + 0),0] = Max[40054.94, 0] = 40054.94 , precision points 2
        */
        expect((await interestDistribution.userGDBalance(S1)).toString()).to.be.equal("4005491");



        /**
        *
        * values:
        * GDEarnedInterest = 5247.61 (551 x 8761.904762 / 920)
        * GlobalTotalEffectiveStake = 463.2 
        * NewEffectiveStake = 152.20 (240 - 150 x (240/410))
        * Formula:
        * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
        * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x NewEffectiveStake)]
        * 299.99 + (5247.61)/551 = 214.2857143 + 9.52 => 309.52 x 1e11 (Approx) (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
        * 0 + (309.52 * 152.2) = 0 + 47108.01 => 47108.01 x 1e29 (27 + 2(G$ precision) = 29 precision points)
        */   
        expect((Math.floor(yieldData[0]/1e11)).toString()).to.be.equal("309");
        expect((Math.floor(yieldData[1]/1e29)).toString()).to.be.equal("47107");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("770", "ether")); 
        // globalTotalEffectiveStake
        expect((Math.floor(interestData[2]/1e18)).toString()).to.be.equal("463"); 
        // gdInterestEarnedToDate, 77553.63 (72306.02 + 551 x 8761.904762 / 920)
        expect((interestData[3]).toString()).to.be.equal("7755363");  
        // interestTokenEarnedToDate, 594.61 + 43.80
        expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("638"); 

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("260", "ether")); 
        // totalEffectiveStake of S1
        expect((Math.floor(stakerData[1]/1e18)).toString()).to.be.equal("152"); 

        /*
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 920 + (-150 / 1.05) - 43.8 = 920 + -142.85 - 43.8 = 733.33 , precision points 18
        */
        expect((Math.floor(await interestDistribution.iTokenBalance()/1e18)).toString()).to.be.equal("733"); 

        /*
        * Formula:
        * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
        * 46669.66 + 8761.90 - 5247.61 = 50183.95 , precision points 2
        */
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("5018395");

        /*
        * Formula:
        * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
        * 72306.02 + (8761.90 x 551 / 920) = 72306.02 + 5247.61 = 77553.63 , precision points 2
        */
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("7755363"); 
    });

    it("Staker 2 Withdraws Entire stake worth 150 Token", async () => {

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 1.1 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("1.1", "ether"))
          .catch(e => e);


      /**
        * S2 withdraws stakes worth 150DAI
        * will mint 6666.66 new GD. total stake = 620, iTokenBalance = 596.96
        * Required iToken = 620/1.1 = 563.63, excessIToken = 33.32
        * newlyMintGD = 33.32 x 200 = 6666.66
        */
        await interestDistribution
          .withdrawStakeAndInterest(S2, web3.utils.toWei("150", "ether"))
          .catch(e => e);


        let stakerData = await interestDistribution.getStakerData(S2);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S2);


        /**
        * Formula: 
        * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (StakeBuyinRate + WithdrawnToDate), 0]
        * Max[95 x 318.18 - (22763.157),0] = Max[1986.84, 0] = 1986.84 , precision points 2
        */
        expect((await interestDistribution.userGDBalance(S2)).toString()).to.be.equal("746410");



        /**
        *
        * values:
        * GDEarnedInterest = 4010.38 (463.2 x 6666.66 / 770)
        * GlobalTotalEffectiveStake = 368.20 
        * NewEffectiveStake = 0 (95 - 150 x (95/150))
        * Formula:
        * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
        * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x NewEffectiveStake)]
        * 309.52 + (4010.38)/463.2 = 309.52 + 8.65 => 318.18 x 1e11 (Approx) (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
        * 0 + (318.18 * 0) = 0 + 0 => 0 x 1e29 (27 + 2(G$ precision) = 29 precision points)
        */     
        expect((Math.floor(yieldData[0]/1e11)).toString()).to.be.equal("318");
        expect((Math.floor(yieldData[1]/1e29)).toString()).to.be.equal("0");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("620", "ether")); 
        // globalTotalEffectiveStake
        expect((Math.floor(interestData[2]/1e18)).toString()).to.be.equal("368"); 
        // gdInterestEarnedToDate, 81563.97 (77553.63 + 463.2 x 6666.66 / 770)
        expect((interestData[3]).toString()).to.be.equal("8156397");  
        // interestTokenEarnedToDate, 638.41 + 33.32
        expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("672"); 

        // totalStake of S2
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("0", "ether")); 
        // totalEffectiveStake of S2
        expect((stakerData[1]).toString()).to.be.equal(web3.utils.toWei("0", "ether")); 


        /*
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 733.33 + (-150 / 1.1) - 33.32 = 1025 + 0 - 0 = 563.64 , precision points 18
        */
        expect((Math.floor(await interestDistribution.iTokenBalance()/1e18)).toString()).to.be.equal("563");

        /*
        * Formula:
        * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
        * 50183.95 + 6666.66 - 4010.38 = 52840.27 , precision points 2
        */
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("5284027");

        /*
        * Formula:
        * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
        * 77553.63 + (463.2 x 6666.66 / 770) = 81563.97 , precision points 2
        */
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("8156397"); 
    });

    it("Staker 3 stakes 100 Token and donate 40% of interest", async () => {

      // Updating Interest token rate to Token rate. (ie., 1 interestToken is worth of 1.15 Token)
      // Token means any supported ERC20 (ie., DAI, USDC etc)
      // IToken means any interest Token (ie., mDAI, cDAI, mUSDC etc)
      // Updating the rate so we can see interest generating for staked tokens.
      await interestDistribution
          .setITokenToTokenRate(web3.utils.toWei("1.15", "ether"))
          .catch(e => e);

      /**
        * S3 stakes 100DAI, donating 40%
        * will mint 4901.18 new GD. total stake = 720, iTokenBalance = 650.59
        * Required iToken = 720/1.15 = 626.08, excessIToken = 24.50.
        * newlyMintGD = 25.50 x 200 = 4901.18
        */
        await interestDistribution
          .stake(S3, web3.utils.toWei("100", "ether"), 40)
          .catch(e => e);

        let stakerData = await interestDistribution.getStakerData(S3);
        let interestData = await interestDistribution.getInterestData();
        let yieldData = await interestDistribution.getYieldData(S3);

        /**
        *
        * values:
        * GDEarnedInterest = 2910.63 (368.20 x 4901.18 / 620)
        * GlobalTotalEffectiveStake = 428.20 (368.20 + 100 * (100%-40%))
        * EffectiveStake = 60 (100 * (100%-40%))
        * Formula:
        * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
        * GDYieldRate = [GDYieldRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
        * 318.18 + (2910.63)/368.20 = 318.18 + 7.90 => 326.08 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
        * 35999 + 326.08*60 = 55565.21 => 55565.21 x 1e29 (27 + 2(G$ precision) = 29 precision points)
        */   
        expect((Math.floor(yieldData[0]/1e11)).toString()).to.be.equal("326");
        expect((Math.floor(yieldData[1]/1e29)).toString()).to.be.equal("55565");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("720", "ether")); 
        // globalTotalEffectiveStake
        expect((Math.floor(interestData[2]/1e18)).toString()).to.be.equal("428");  
        // gdInterestEarnedToDate, 81563.97 + 2910.63 (368.20 x 4901.18 / 620)
        expect((interestData[3]).toString()).to.be.equal("8447459");  
        // interestTokenEarnedToDate, 671.73 + 24.50
        expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("696"); 

        // totalStake of S3
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("460", "ether")); 
        // totalEffectiveStake of S3
        expect((stakerData[1]).toString()).to.be.equal(web3.utils.toWei("276", "ether"));  

        /**
        * Formula:
        * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
        * 563.64 + (100 / 1.15) - 24.50 = 626.09 , precision points 18
        */
        expect((Math.floor(await interestDistribution.iTokenBalance()/1e18)).toString()).to.be.equal("626");

        /**
        * Formula:
        * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
        * 52840.27 + 4901.18 - 2910.63 = 54830.83 , precision points 2
        */
        expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("5483083");

        
        /** Formula:
        * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
        * 81563.97 + (368.20 x 4901.18 / 620) = 84474.59 , precision points 2
        */
        expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("8447459"); 
    });

    it("Collecting all GD for excess interest token holding", async () => {

      /**
        * will not mint new GD because no interest is generted since last update.
        */    
      await interestDistribution
          .collectUBIInterest()
          .catch(e => e);

      
      let interestData = await interestDistribution.getInterestData();


      
      /**
      *
      * values:
      * GDEarnedInterest = 0 (428.20 x 0 / 760)
      * Formula:
      * GlobalYieldPerToken = GlobalYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
      * 326.08 + (0)/428.2 = 326.08 => 326.08 x 1e11 (27 + 2(G$ precision) - 18(token decimal) = 11 precision points)
      */      
      expect((Math.floor(interestData[1]/1e11)).toString()).to.be.equal("326");

      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("720", "ether")); 
      // globalTotalEffectiveStake
      expect((Math.floor(interestData[2]/1e18)).toString()).to.be.equal("428"); 
      // gdInterestEarnedToDate, 84474.59 + 0 (8447459 + 428.2 x 0 / 760)
      expect((interestData[3]).toString()).to.be.equal("8447459");  
      // interestTokenEarnedToDate, 696.23 + 0
      expect((Math.floor(interestData[4]/1e18)).toString()).to.be.equal("696"); 

      /*
      * Formula:
      * iTokenBalance = iTokenBalance(P) + stakedToken/iTokenRate - excessIToken
      * 626.08 + 0 - 0 = 626.08 , precision points 18
      */
      expect((Math.floor(await interestDistribution.iTokenBalance()/1e18)).toString()).to.be.equal("626"); 

      
      /** Formula:
      * ubiGDBlance = ubiGDBlance + newGDMinted - interestGD
      * 54830.83 + 0 - 0 = 54830.83 , precision points 2
      */
      expect((await interestDistribution.ubiGDBlance()).toString()).to.be.equal("5483083");

      /*
      * Formula:
      * interestGDBalance = interestGDBalance + (newGDMinted x GlobalTotalEffectiveStake / globalTotalStaked)
      * 84474.59 + (0 x 428.2 / 760) = 84474.59 + 0 = 84474.59 , precision points 2
      */
      expect((await interestDistribution.interestGDBalance()).toString()).to.be.equal("8447459");

      /**
      * Formula: 
      * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (StakeBuyinRate + WithdrawnToDate), 0]
      */
      /**
      * Max[152.2 x 326.08 - (47108.01394 + 0),0] = Max[2520.82, 0] = 2520.82 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S1)).toString()).to.be.equal("252082");
      /**
      * Max[0 x 326.08 - (0 + 0),0] = Max[0, 0] = 0 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S2)).toString()).to.be.equal("0");
      /**
      * Max[276 x 326.08 - (55565.21739 + 24000),0] = Max[10434.76, 0] = 10434.76 , precision points 2
      */
      expect((await interestDistribution.calculateGDInterest(S3)).toString()).to.be.equal("1043476");
    });
  });

});
