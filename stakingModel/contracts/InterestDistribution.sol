pragma solidity 0.5.4;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library InterestDistribution {
    using SafeMath for uint256;

    /**
     * @dev Structure to store Interest details.
     * It contains total amount of tokens staked and total amount of interest generated.
     */    
    struct InterestData {
      uint globalTotalStaked;
      uint globalYieldPerToken;
      uint lastTokenRate;
      mapping(address => Staker) stakers;
    }

    /**
     * @dev Structure to store staking details.
     * It contains amount of tokens staked and blocknumber at which last staked.
     */
    struct Staker {
        uint256 stakedToken;
        uint256 weightedStake; // stored with 2 precision points ie., 0.82 => 82
        uint256 lastStake;
        uint256 withdrawnToDate;
        uint256 avgYieldRatePerToken;
    }

    // 10^18
    uint256 constant DECIMAL1e18 = 10 ** 18;

    /**
      * @dev Updates InterestData and Staker data while staking.
      * 
      * @param _interestData           Interest data
      * @param _staker                 Staker's address
      * @param _stake                  Amount of stake
      * @param _donationPer            Percentage will to donate.
      * @param _iTokenRate             Interest token rate.
      * @param _iTokenHoldings         Interest token balance of staking contract. 
      *
    */
    function stakeCalculation(
      InterestData storage _interestData, 
      address _staker,
      uint256 _stake, 
      uint256 _donationPer,
      uint256 _iTokenRate,
      uint256 _iTokenHoldings
      ) 
    internal 
    {
      Staker storage _stakerData = _interestData.stakers[_staker];
      // Should not update avgYieldRatePerToken and globalYieldPerToken for 1st stake as his avg rate should be 0. 
      if (_interestData.globalTotalStaked > 0 && _stakerData.stakedToken > 0) {
        // Calculating _globalYieldPerToken before updating globalTotalStaked
        // because the staker still has no part in the interest generated today.
        // Updating globalYieldPerToken for every stake.
        updateGlobalYieldPerToken(_interestData, _iTokenRate, _iTokenHoldings);
        updateAvgYieldRatePerToken(_stakerData, _interestData.globalYieldPerToken, _stake, _donationPer);
      }
      uint currentStake = _stakerData.stakedToken;
      _stakerData.stakedToken = currentStake.add(_stake);
      _stakerData.weightedStake = (_stakerData.weightedStake.mul(currentStake).add(_stake.mul(uint(100).sub(_donationPer)))).div(_stakerData.stakedToken);
      _stakerData.lastStake = block.number;
      _interestData.globalTotalStaked = _interestData.globalTotalStaked.add(_stake);
      
    }

    /**
      * @dev Updates InterestData and Staker data while withdrawing stake.
      * 
      * @param _interestData           Interest data
      * @param _staker                 Staker address
      * @param _amount                 Amount of stake to withdraw
      *
    */
    function withdrawStakeAndInterest(
      InterestData storage _interestData, 
      address _staker, 
      uint256 _amount
      ) 
    internal 
    {
      _interestData.globalTotalStaked = _interestData.globalTotalStaked.sub(_amount);
      Staker storage _stakerData = _interestData.stakers[_staker];
      _stakerData.stakedToken = _stakerData.stakedToken.sub(_amount);
      updateWithdrawnInterest(_interestData, _staker);
    }

    /**
      * @dev Updates withdrawnToDate of staker.
      * 
      * @param _interestData             Interest Data
      * @param _staker                   Staker's address
      *
    */
    function updateWithdrawnInterest(InterestData storage _interestData, address _staker) internal {
      Staker storage stakerData = _interestData.stakers[_staker];
      uint256 amount = calculateGDInterest(_staker, _interestData);
      stakerData.withdrawnToDate = stakerData.withdrawnToDate.add(amount);
    }

    /**
      * @dev Calculates GD Interest for staker for their stake.
      * 
      * Formula:
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * 
      * @param _staker                     Staker's address
      * @param _interestData               Interest Data
      * 
      * @return _earnedGDInterest The amount of G$ credit for the staker 
    */
    function calculateGDInterest(
      address _staker,
      InterestData storage _interestData
    ) 
    internal 
    view 
    returns 
    (
      uint256 _earnedGDInterest
    ) 
    {
      
      Staker storage stakerData = _interestData.stakers[_staker];
      uint256 _withdrawnToDate = stakerData.withdrawnToDate;
      // will lead to -ve value
      if(stakerData.avgYieldRatePerToken > _interestData.globalYieldPerToken) {
        return 0;
      }
        
      uint intermediateInterest =stakerData.stakedToken.mul(_interestData.globalYieldPerToken.sub(stakerData.avgYieldRatePerToken));
      
      // To reduce it to 2 precision of G$
      _earnedGDInterest = intermediateInterest.div(10**16);

      // will lead to -ve value
      if(_withdrawnToDate > _earnedGDInterest) {
        return 0;
      }
      
      _earnedGDInterest = _earnedGDInterest.sub(_withdrawnToDate);

      return _earnedGDInterest;
    }

    /**
      * @dev Calculates new accrued amount per token 
      * since last update without updating global data.
      * 
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * 
      * @param _interestData           Interest Data
      * @param _iTokenRate             Interest token rate.
      * @param _iTokenHoldings         Interest token balance of staking contract.
      * 
      * @return  new yield since last update with same precision points as G$(2).
    */
    function updateGlobalYieldPerToken(InterestData storage _interestData, uint256 _iTokenRate, uint256 _iTokenHoldings) internal
    {
     _interestData.globalYieldPerToken = _interestData.globalYieldPerToken.add(_iTokenRate.sub(_interestData.lastTokenRate).mul(_iTokenHoldings).div(_interestData.globalTotalStaked));
     _interestData.lastTokenRate = _iTokenRate;
    }

    /**
      * @dev Calculates increase in yielding rate per token 
      * since last update without updating global data.
      * 
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      *
      * @param _stakerData                  Staker's Data
      * @param _globalYieldPerToken         Total yielding amount per token (Precision same as G$ = 2)
      * @param _staking                     Amount staked
      * @param _donationPer                 Percentage pledged to donate.
      * 
      * @return  increase in yielding rate since last update with same precision points as G$(2).
    */
    function updateAvgYieldRatePerToken(
      Staker storage _stakerData,
      uint256 _globalYieldPerToken, 
      uint256 _staking, uint256 _donationPer
      ) 
    internal 
    {
      _stakerData.avgYieldRatePerToken = _stakerData.avgYieldRatePerToken.add(_globalYieldPerToken.mul(_staking.mul(uint(100).sub(_donationPer))).div(_stakerData.stakedToken.mul(100)));
    }
    
}