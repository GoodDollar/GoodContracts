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
      uint interestAccrued;
      uint globalYieldPerToken;
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
      * @param _interest               Newly accrued interest since last update.
      *
    */
    function stakeCalculation(
      InterestData storage _interestData, 
      address _staker,
      uint256 _stake, 
      uint256 _donationPer,
      uint256 _interest
      ) 
    internal 
    {
      Staker storage _stakerData = _interestData.stakers[_staker];
      // Should not update avgYieldRatePerToken for 1st stake as his avg rate should be 0. 
      if (_interestData.globalTotalStaked > 0) {
        // Calculating _globalYieldPerToken before updating globalTotalStaked
        // because the staker still has no part in the interest generated today.
        // Calculating globalYieldPerToken before the actual update of 
        // it in the next daily interest accumulation.
        uint _globalYieldPerToken = getGlobalYieldPerToken(_interest, _interestData.globalTotalStaked);
        updateAvgYieldRatePerToken(_stakerData, _globalYieldPerToken, _stake, _donationPer);
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
      * @dev Updates interestAccrued and globalYieldPerToken.
      * 
      * @param _interestData           Interest data
      * @param _interest               Newly accrued interest
      *
    */
    function updateInterest(InterestData storage _interestData, uint256 _interest) internal {
      _interestData.interestAccrued = _interestData.interestAccrued.add(_interest);
      _interestData.globalYieldPerToken = _interestData.globalYieldPerToken.add(getGlobalYieldPerToken(_interest, _interestData.globalTotalStaked));
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
      uint256 amount = calculateGDInterest(stakerData.withdrawnToDate, _staker, _interestData);
      stakerData.withdrawnToDate.add(amount);
    }

    /**
      * @dev Calculates GD Interest for staker for their stake.
      * 
      * Formula:
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * 
      * @param _withdrawnToDate            Withdrawn interest by individual staker so far.
      * @param _staker                     Staker's address
      * @param _interestData               Interest Data
      * 
      * @return _earnedGDInterest The amount of G$ credit for the staker 
    */
    function calculateGDInterest(
      uint256 _withdrawnToDate,
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
      // will lead to -ve value
      if(stakerData.avgYieldRatePerToken > _interestData.globalYieldPerToken)
        return 0;
        
      uint intermediateInterest =stakerData.stakedToken.mul(_interestData.globalYieldPerToken.sub(stakerData.avgYieldRatePerToken));
      // will lead to -ve value
      if(_withdrawnToDate > intermediateInterest)
        return 0;

      _earnedGDInterest = intermediateInterest.sub(_withdrawnToDate);

      // To reduce it to 2 precision of G$
      return _earnedGDInterest.div(10**16);
    }

    /**
      * @dev Calculates new accrued amount per token 
      * since last update without updating global data.
      * 
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * 
      * @param _dailyIntrest            Newly accrued interest (Precision same as G$ = 2)
      * @param _globalTotalStaked       Total staked by all stakers. (Precision points = 18)
      * 
      * @return  new yield since last update with same precision points as G$(2).
    */
    function getGlobalYieldPerToken(uint256 _dailyIntrest, uint256 _globalTotalStaked) internal view returns(uint256) {
      return _dailyIntrest.mul(DECIMAL1e18).div(_globalTotalStaked);
    }

    /**
      * @dev Calculates increase in yielding rate per token 
      * since last update without updating global data.
      * 
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * 
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