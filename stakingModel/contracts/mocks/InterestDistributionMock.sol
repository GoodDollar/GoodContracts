pragma solidity 0.5.4;

import "../InterestDistribution.sol";

contract InterestDistributionMock {

    InterestDistribution.InterestData interestData;

    function stakeCalculation(
      address _staker,
      uint256 _stake, 
      uint256 _donationPer,
      uint256 _iTokenRate,
      uint256 _iTokenHoldings
      ) 
    public 
    {
      InterestDistribution.stakeCalculation(interestData, _staker, _stake, _donationPer, _iTokenRate, _iTokenHoldings);
    }

    function withdrawStakeAndInterest(
      address _staker,
      uint256 _amount
      ) 
    public 
    {
      InterestDistribution.withdrawStakeAndInterest(interestData, _staker, _amount);
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

    function updateGlobalYieldPerToken(uint256 iTokenRate, uint256 iTokenHoldings) public {
        InterestDistribution.updateGlobalYieldPerToken(interestData, iTokenRate, iTokenHoldings);
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
    
}
