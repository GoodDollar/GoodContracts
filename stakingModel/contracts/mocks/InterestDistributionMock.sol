pragma solidity 0.5.4;

import "../InterestDistribution.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract InterestDistributionMock {

    using SafeMath for uint256;

    InterestDistribution.InterestData interestData;

    uint256 constant DECIMAL1e18 = 10**18;

    uint256 public iTokenToTokenRate = uint256(2).mul(10 ** 17);

    // simulation variables
    uint256 public iTokenBalance;
    uint256 public interestGDBalance;
    uint256 public ubiGDBlance;

    function stake(
      address _staker,
      uint256 _stake, 
      uint256 _donationPer
      ) 
    public 
    {
      updatecontractBalance(_stake, true);
      uint requiredCDAIBal = (interestData.globalTotalStaked.add(_stake)).mul(DECIMAL1e18).div(iTokenToTokenRate);
      uint newGDMinted = 0;
      uint newGDMintedBeforeDonation = 0;
      if(iTokenBalance > requiredCDAIBal) {
        (newGDMinted, newGDMintedBeforeDonation) = mintGoodDollar(iTokenBalance.sub(requiredCDAIBal));
      }
      updateGlobalGDYieldPerToken(newGDMinted, newGDMintedBeforeDonation);
      InterestDistribution.stake(interestData, _staker, _stake, _donationPer);
    }

    function withdrawStakeAndInterest(
      address _staker,
      uint256 _amount
      ) 
    public 
    {
      updatecontractBalance(_amount, false);
      uint requiredCDAIBal = (interestData.globalTotalStaked.sub(_amount)).mul(DECIMAL1e18).div(iTokenToTokenRate);
      uint newGDMinted = 0;
      uint newGDMintedBeforeDonation = 0;
      if(iTokenBalance > requiredCDAIBal) {
        (newGDMinted, newGDMintedBeforeDonation) = mintGoodDollar(iTokenBalance.sub(requiredCDAIBal));
      }
      updateGlobalGDYieldPerToken(newGDMinted, newGDMintedBeforeDonation);
      InterestDistribution.withdrawStakeAndInterest(interestData, _staker, _amount);
    }

    function withdrawGDInterest(address _staker) public {
      uint requiredCDAIBal = (interestData.globalTotalStaked).mul(DECIMAL1e18).div(iTokenToTokenRate);
      uint newGDMinted = 0;
      uint newGDMintedBeforeDonation = 0;
      if(iTokenBalance > requiredCDAIBal) {
        (newGDMinted, newGDMintedBeforeDonation) = mintGoodDollar(iTokenBalance.sub(requiredCDAIBal));
      }
      updateGlobalGDYieldPerToken(newGDMinted, newGDMintedBeforeDonation);
      InterestDistribution.withdrawGDInterest(interestData, _staker);
    }

    function getYieldData(address _staker) public view returns(uint256,uint256)
    {

      return (interestData.globalGDYieldPerToken, interestData.stakers[_staker].stakeBuyinRate);
    }

    function getStakerData(address _staker) public view returns(uint256, uint256, uint256, uint256)
    {

      return (interestData.stakers[_staker].totalStaked, interestData.stakers[_staker].totalEffectiveStake, interestData.stakers[_staker].lastStake, interestData.stakers[_staker].withdrawnToDate);
    }

    function getInterestData() public view returns(uint256, uint256, uint256, uint256, uint256, uint256)
    {

      return (interestData.globalTotalStaked, interestData.globalGDYieldPerToken, interestData.globalTotalEffectiveStake, interestData.gdInterestEarnedToDate, interestData.interestTokenEarnedToDate, interestData.globalGDYieldPerTokenUpdatedBlock);
    }

    function calculateGDInterest(
      address _staker
    ) 
    public 
    view 
    returns 
    (
      uint256 _earnedGDInterest
    ) 
    {
      return InterestDistribution.calculateGDInterest(_staker, interestData);
     
    }

    function updateGlobalGDYieldPerToken(uint256 _blockGDInterest, uint256 _blockInterestTokenEarned) public {
        InterestDistribution.updateGlobalGDYieldPerToken(interestData, _blockGDInterest, _blockInterestTokenEarned);
    }

    function updateStakeBuyinRate(
      address _staker,
      uint256 _effectiveStake
      ) 
    public
    {
        InterestDistribution.updateStakeBuyinRate(interestData.stakers[_staker], interestData.globalGDYieldPerToken, _effectiveStake);
    }

    function setITokenToTokenRate(uint _val) public {
      iTokenToTokenRate = _val;
    }
    
    function updatecontractBalance(uint256 _amount, bool _stake) internal {
      if(_stake)
      {
        iTokenBalance = iTokenBalance.add(_amount.mul(DECIMAL1e18).div(iTokenToTokenRate));
      } else {
        iTokenBalance = iTokenBalance.sub(_amount.mul(DECIMAL1e18).div(iTokenToTokenRate));
      }
    }

    function mintGoodDollar(uint256 _excesCDAI) internal returns(uint256, uint256) {
      iTokenBalance = iTokenBalance.sub(_excesCDAI);
      uint mintAmount = _excesCDAI.mul(20000).div(DECIMAL1e18);
      uint mintGDInterest = interestData.globalTotalEffectiveStake.mul(mintAmount).div(interestData.globalTotalStaked);
      interestGDBalance = interestGDBalance.add(mintGDInterest);
      ubiGDBlance = ubiGDBlance.add(mintAmount.sub(mintGDInterest));
      return (mintGDInterest, mintAmount);
    }

    function collectUBIInterest() public {
      uint requiredCDAIBal = (interestData.globalTotalStaked).mul(DECIMAL1e18).div(iTokenToTokenRate);
      uint newGDMinted = 0;
      uint newGDMintedBeforeDonation = 0;
      if(iTokenBalance > requiredCDAIBal) {
        (newGDMinted, newGDMintedBeforeDonation) = mintGoodDollar(iTokenBalance.sub(requiredCDAIBal));
      }
      updateGlobalGDYieldPerToken(newGDMinted, newGDMintedBeforeDonation);
    }
}
