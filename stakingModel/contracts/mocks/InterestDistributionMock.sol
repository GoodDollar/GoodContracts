pragma solidity 0.5.4;

import "../../../contracts/token/ERC677/ERC677Receiver.sol";
import "../InterestDistribution.sol";

contract InterestDistributionMock {

    InterestDistribution.YieldData public yieldData;

    // function stakeCalculation(
    //   uint256 _stake, 
    //   uint256 _donationPer
    //   ) 
    // public 
    // {

    // }

    // function withdrawStakeAndInterest(
    //   uint256 _amount
    //   ) 
    // public 
    // {

    // }

    function addAccumulatedYieldPerToken(
      uint _accumulatedYieldPerToken
      ) 
    public 
    {
        InterestDistribution.addAccumulatedYieldPerToken(yieldData, _accumulatedYieldPerToken);
    }

    function addAvgYieldRatePerToken(
      address _staker,
      uint _avgYieldRatePerToken
      ) 
    public 
    {
        InterestDistribution.addAvgYieldRatePerToken(yieldData, _staker, _avgYieldRatePerToken);
    }

    // function addInterest(uint256 _iterest) public {
    // }

    // function withdrawIntrest(uint256 _amount) public {
    // }

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
