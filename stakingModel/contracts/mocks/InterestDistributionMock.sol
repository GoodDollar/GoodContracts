pragma solidity 0.5.4;

import "../../../contracts/token/ERC677/ERC677Receiver.sol";
import "../InterestDistribution.sol";

contract InterestDistributionMock {

    InterestDistribution.InterestData interestData;

    function stakeCalculation(
      address _staker,
      uint256 _stake, 
      uint256 _donationPer,
      uint256 _dailyIntrest
      ) 
    public 
    {
      InterestDistribution.stakeCalculation(interestData, _staker, _stake, _donationPer, _dailyIntrest);
    }

    function withdrawStakeAndInterest(
      address _staker,
      uint256 _amount
      ) 
    public 
    {
      InterestDistribution.withdrawStakeAndInterest(interestData, _staker, _amount);
    }

    function updateInterest(uint256 _interest) public {
      InterestDistribution.updateInterest(interestData, _interest);
    }

    function updateWithdrawnInterest(address _staker) public {
      InterestDistribution.updateWithdrawnInterest(interestData, _staker);
    }

    function getYieldData(address _staker) public view returns(uint256,uint256)
    {

      return (interestData.globalYieldPerToken, interestData.stakers[_staker].avgYieldRatePerToken);
    }

    function getStakerData(address _staker) public view returns(uint256, uint256, uint256, uint256)
    {

      return (interestData.stakers[_staker].stakedToken, interestData.stakers[_staker].weightedStake, interestData.stakers[_staker].lastStake, interestData.stakers[_staker].withdrawnToDate);
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

    function getGlobalYieldPerToken(uint256 _dailyIntrest, uint256 _grandTotalStaked) public view returns(uint256) {
        return InterestDistribution.getGlobalYieldPerToken(_dailyIntrest, _grandTotalStaked);
    }

    function updateAvgYieldRatePerToken(
      address _staker,
      uint256 _globalYieldPerToken, 
      uint256 _staking, uint256 _donationPer
      ) 
    public
    {
        InterestDistribution.updateAvgYieldRatePerToken(interestData.stakers[_staker], _globalYieldPerToken, _staking, _donationPer);
    }

    function resetRecord(address _staker) public {

      interestData = InterestDistribution.InterestData(0,0,0);
      interestData.stakers[_staker] = InterestDistribution.Staker(0,0,0,0,0);
    }
    
}
