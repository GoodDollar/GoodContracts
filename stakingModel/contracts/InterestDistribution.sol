pragma solidity 0.5.4;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library InterestDistribution {
    using SafeMath for uint256;

    /**
     * @dev Structure to store Interest details.
     * It contains total amount of tokens staked and total amount of interest generated.
     */    
    struct InterestData {
      uint grandTotalStaked;
      uint interestAccrued;
      uint accumulatedYieldPerToken;
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
      * @param _dailyIntrest           Newly accrued interest.
      * @param _grandTotalStaked       Total staked by all stakers.
      *
    */
    function stakeCalculation(
      InterestData storage _interestData, 
      address _staker,
      uint256 _stake, 
      uint256 _donationPer,
      uint256 _dailyIntrest,
      uint256 _grandTotalStaked
      ) 
    internal 
    {
      _interestData.grandTotalStaked = _interestData.grandTotalStaked.add(_stake);
      uint currentStake = _interestData.stakers[_staker].stakedToken;
      Staker storage _stakerData = _interestData.stakers[_staker];
      _stakerData.stakedToken = currentStake.add(_stake);
      _stakerData.weightedStake = (_stakerData.weightedStake.mul(currentStake).add(_stake.mul(uint(100).sub(_donationPer)))).div(_stakerData.stakedToken);
      _stakerData.lastStake = block.number;
      uint _accumulatedYieldPerToken = getAccumulatedYieldPerToken(_dailyIntrest, _grandTotalStaked);
      _stakerData.avgYieldRatePerToken = _stakerData.avgYieldRatePerToken.add(getAvgYieldRatePerToken(_accumulatedYieldPerToken, _stake, _donationPer, _stakerData.stakedToken));
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
      _interestData.grandTotalStaked = _interestData.grandTotalStaked.sub(_amount);
      Staker storage _stakerData = _interestData.stakers[_staker];
      _stakerData.stakedToken = _stakerData.stakedToken.sub(_amount);
    }

    /**
      * @dev Updates interestAccrued and accumulatedYieldPerToken.
      * 
      * @param _interestData           Interest data
      * @param _interest               Newly accrued interest
      * @param _grandTotalStaked       Total staked by all stakers.
      *
    */
    function addInterest(InterestData storage _interestData, uint256 _interest, uint256 _grandTotalStaked) internal {
      _interestData.interestAccrued = _interestData.interestAccrued.add(_interest);
      _interestData.accumulatedYieldPerToken = _interestData.accumulatedYieldPerToken.add(getAccumulatedYieldPerToken(_interest, _grandTotalStaked));
    }

    /**
      * @dev Updates withdrawnToDate of staker.
      * 
      * @param _staker           Staker data
      * @param _amount           Amount of G$ withdrawn
      *
    */
    function withdrawIntrest(Staker storage _staker, uint256 _amount) internal {
      _staker.withdrawnToDate.add(_amount);
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
      * @param _totalStaked                Total staked by individual staker.
      * 
      * @return _earnedGDInterest The amount of G$ credit for the staker 
    */
    function calculateGDInterest(
      uint256 _withdrawnToDate,
      address _staker,
      InterestData storage _interestData,
      uint256 _totalStaked
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
      if(stakerData.avgYieldRatePerToken > _interestData.accumulatedYieldPerToken)
        return 0;
        
      uint intermediateInterest =_totalStaked.mul(_interestData.accumulatedYieldPerToken.sub(stakerData.avgYieldRatePerToken));
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
      * @param _grandTotalStaked        Total staked by all stakers. (Precision points = 18)
      * 
      * @return  new yield since last update with same precision points as G$(2).
    */
    function getAccumulatedYieldPerToken(uint256 _dailyIntrest, uint256 _grandTotalStaked) internal view returns(uint256) {
      return _dailyIntrest.mul(DECIMAL1e18).div(_grandTotalStaked);
    }

    /**
      * @dev Calculates increase in yielding rate per token 
      * since last update without updating global data.
      * 
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * 
      * @param _accumulatedYieldPerToken    Total yielding amount per token (Precision same as G$ = 2)
      * @param _staking                     Amount staked
      * @param _donationPer                 Percentage pledged to donate.
      * @param _totalStaked                 Total staked by individual staker.
      * 
      * @return  increase in yielding rate since last update with same precision points as G$(2).
    */
    function getAvgYieldRatePerToken(
      uint256 _accumulatedYieldPerToken, 
      uint256 _staking, uint256 _donationPer, 
      uint256 _totalStaked
      ) 
    internal 
    view 
    returns(uint256) 
    {
      return _accumulatedYieldPerToken.mul(_staking.mul(uint(100).sub(_donationPer))).div(_totalStaked.mul(100));
    }
    
}