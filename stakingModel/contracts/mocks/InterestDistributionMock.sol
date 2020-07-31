pragma solidity 0.5.4;

import "../InterestDistribution.sol";

contract InterestDistributionMock {

    InterestDistribution.InterestData interestData;

    function stake(
      address _staker,
      uint256 _stake, 
      uint256 _donationPer,
      uint256 _blockGDInterest,
      uint256 _blockInterestTokenEarned
      ) 
    public 
    {
      updateGlobalGDYieldPerToken(_blockGDInterest, _blockInterestTokenEarned);
      InterestDistribution.stake(interestData, _staker, _stake, _donationPer);
    }

    function withdrawStakeAndInterest(
      address _staker,
      uint256 _amount,
      uint256 _blockGDInterest,
      uint256 _blockInterestTokenEarned
      ) 
    public 
    {
      updateGlobalGDYieldPerToken(_blockGDInterest, _blockInterestTokenEarned);
      InterestDistribution.withdrawStakeAndInterest(interestData, _staker, _amount);
    }

    function withdrawGDInterest(address _staker, uint256 _blockGDInterest, uint256 _blockInterestTokenEarned) public {
      updateGlobalGDYieldPerToken(_blockGDInterest, _blockInterestTokenEarned);
      InterestDistribution.withdrawGDInterest(interestData, _staker);
    }

    function getYieldData(address _staker) public view returns(uint256,uint256)
    {

      return (interestData.globalGDYieldPerToken, interestData.stakers[_staker].gdYieldRate);
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

    function updateGDYieldRate(
      address _staker,
      uint256 _globalGDYieldPerToken,
      uint256 _effectiveStake
      ) 
    public
    {
        InterestDistribution.updateGDYieldRate(interestData.stakers[_staker], _globalGDYieldPerToken, _effectiveStake);
    }
    
}
