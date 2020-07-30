pragma solidity 0.5.4;

import "../InterestDistribution.sol";

contract InterestDistributionMock {

    InterestDistribution.InterestData interestData;

    function stake(
      address _staker,
      uint256 _stake, 
      uint256 _donationPer
      ) 
    public 
    {
      InterestDistribution.stake(interestData, _staker, _stake, _donationPer);
    }

    function withdrawStakeAndInterest(
      address _staker,
      uint256 _amount
      ) 
    public 
    {
      InterestDistribution.withdrawStakeAndInterest(interestData, _staker, _amount);
    }

    function withdrawGDInterest(address _staker) public {
      InterestDistribution.withdrawGDInterest(interestData, _staker);
    }

    // function getYieldData(address _staker) public view returns(uint256,uint256)
    // {

    //   return (interestData.globalYieldPerToken, interestData.stakers[_staker].avgYieldRatePerToken);
    // }

    // function getStakerData(address _staker) public view returns(uint256, uint256, uint256, uint256)
    // {

    //   return (interestData.stakers[_staker].stakedToken, interestData.stakers[_staker].weightedStake, interestData.stakers[_staker].lastStake, interestData.stakers[_staker].withdrawnToDate);
    // }

    // function getInterestData() public view returns(uint256, uint256, uint256)
    // {

    //   return (interestData.globalTotalStaked, interestData.globalYieldPerToken, interestData.lastInterestTokenRate);
    // }

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

    function updateAvgGDYieldRatePerToken(
      address _staker,
      uint256 _globalGDYieldPerToken,
      uint256 _effectiveStake
      ) 
    public
    {
        InterestDistribution.updateAvgGDYieldRatePerToken(interestData.stakers[_staker], _globalGDYieldPerToken, _effectiveStake);
    }
    
}
