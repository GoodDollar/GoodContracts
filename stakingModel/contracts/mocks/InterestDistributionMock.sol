pragma solidity 0.5.4;

import "../../../contracts/token/ERC677/ERC677Receiver.sol";
import "../InterestDistribution.sol";

contract InterestDistributionMock {

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
      InterestDistribution.stakeCalculation(interestData, _staker, _stake, _donationPer, _dailyIntrest, _grandTotalStaked);
    }

    function withdrawStakeAndInterest(
      address _staker,
      uint256 _amount
      ) 
    public 
    {
      InterestDistribution.withdrawStakeAndInterest(interestData, _staker, _amount);
    }

    function addInterest(uint256 _interest, uint256 _grandTotalStaked) public {
      InterestDistribution.addInterest(interestData, _interest, _grandTotalStaked);
    }

    function withdrawIntrest(address _staker, uint256 _amount) public {
      InterestDistribution.withdrawIntrest(interestData.stakers[_staker], _amount);
    }

    function getYieldData(address _staker) public view returns(uint256,uint256)
    {

      return (interestData.accumulatedYieldPerToken, interestData.stakers[_staker].avgYieldRatePerToken);
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
      return InterestDistribution.calculateGDInterest(_withdrawnToDate, _staker, interestData, _totalStaked);
     
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
