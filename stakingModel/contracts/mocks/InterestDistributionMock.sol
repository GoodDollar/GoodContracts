pragma solidity 0.5.4;

import "../../../contracts/token/ERC677/ERC677Receiver.sol";
import "../InterestDistribution.sol";

contract InterestDistributionMock {

    InterestDistribution.YieldData yieldData;

    InterestDistribution.InterestData interestData;

    function stakeCalculation(
      address _staker,
      uint256 _stake, 
      uint256 _donationPer,
      uint256 _dailyIntrest,
      uint256 _grandTotalStaked
      ) 
    public 
    {
      InterestDistribution.stakeCalculation(interestData, yieldData, _staker, _stake, _donationPer, _dailyIntrest, _grandTotalStaked);
    }

    function withdrawStakeAndInterest(
      address _staker,
      uint256 _amount
      ) 
    public 
    {
      InterestDistribution.withdrawStakeAndInterest(interestData, _staker, _amount);
    }

    function addAccumulatedYieldPerToken(
      uint _accumulatedYieldPerToken
      ) 
    public 
    {
        InterestDistribution.addAccumulatedYieldPerToken(yieldData, _accumulatedYieldPerToken);
    }

    function addInterest(uint256 _interest) public {
      InterestDistribution.addInterest(interestData, _interest);
    }

    function withdrawIntrest(address _staker, uint256 _amount) public {
      InterestDistribution.withdrawIntrest(interestData.stakers[_staker], _amount);
    }

    function getYieldData(address _staker) public view returns(uint256,uint256)
    {

      return (yieldData.accumulatedYieldPerToken, yieldData.avgYieldRatePerToken[_staker]);
    }

    function getStakerData(address _staker) public view returns(uint256, uint256, uint256, uint256)
    {

      return (interestData.stakers[_staker].stakedToken, interestData.stakers[_staker].weightedStake, interestData.stakers[_staker].lastStake, interestData.stakers[_staker].withdrawnToDate);
    }

    function calculateGDInterest(
      address _staker,
      uint256 _withdrawnToDate,
      uint256 _totalStaked
    ) 
    public 
    view 
    returns 
    (
      uint256 _earnedGDInterest
    ) 
    {
      return InterestDistribution.calculateGDInterest(_staker, _withdrawnToDate, yieldData, _totalStaked);
     
    }

    function getAccumulatedYieldPerToken(uint256 _dailyIntrest, uint256 _grandTotalStaked) public view returns(uint256) {
        return InterestDistribution.getAccumulatedYieldPerToken(_dailyIntrest, _grandTotalStaked);
    }

    function getAvgYieldRatePerToken(
      uint256 _accumulatedYieldPerToken, 
      uint256 _staking, uint256 _donationPer, 
      uint256 _totalStaked
      ) 
    public 
    view 
    returns(uint256) 
    {
        return InterestDistribution.getAvgYieldRatePerToken(_accumulatedYieldPerToken, _staking, _donationPer, _totalStaked);
    }
    
}
