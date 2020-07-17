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
    }

    /**
     * @dev Structure to store Yield details.
     * It contains total accumulated yield and avg yieding rate per token.
     */
    struct YieldData {
      uint accumulatedYieldPerToken;
      mapping(address => uint) avgYieldRatePerToken;
    }

    // 10^18
    uint256 constant DECIMAL1e18 = 10 ** 18;

    /**
      * @dev Updates InterestData and Staker data while staking.
      * 
      * @param _interestData           Interest data
      * @param _staker                 Staker's data
      * @param _stake                  Amount of stake
      * @param _donationPer            Percentage will to donate.
      *
    */
    function stakeCalculation(
      InterestData storage _interestData, 
      Staker storage _staker, 
      uint256 _stake, 
      uint256 _donationPer
      ) 
    internal 
    {
      _interestData.grandTotalStaked = _interestData.grandTotalStaked.add(_stake);
      uint currentStake = _staker.stakedToken;
      _staker.stakedToken = currentStake.add(_stake);
      _staker.weightedStake = (_staker.weightedStake.mul(currentStake).add(_stake.mul(uint(100).sub(_donationPer)))).div(_staker.stakedToken);
      _staker.lastStake = block.number;
    }

    /**
      * @dev Updates InterestData and Staker data while withdrawing stake.
      * 
      * @param _interestData           Interest data
      * @param _staker                 Staker data
      * @param _amount                 Amount of stake to withdraw
      *
    */
    function withDrawStakeCalculation(
      InterestData storage _interestData, 
      Staker storage _staker, 
      uint256 _amount
      ) 
    internal 
    {
      _interestData.grandTotalStaked = _interestData.grandTotalStaked.sub(_amount);
      _staker.stakedToken = _staker.stakedToken.sub(_amount);
    }

    /**
      * @dev Updates Accumulated Yield Per Token.
      * 
      * @param _yieldData                   Yield data
      * @param _accumulatedYieldPerToken    Total yielding amount per token
      *
    */
    function addAccumulatedYieldPerToken(
      YieldData storage _yieldData, 
      uint _accumulatedYieldPerToken
      ) 
    internal 
    {
      _yieldData.accumulatedYieldPerToken = _yieldData.accumulatedYieldPerToken.add(_accumulatedYieldPerToken);
    }

    /**
      * @dev Updates Avgrage Yield Rate Per Token or staker.
      * 
      * @param _yieldData                   Yield data
      * @param _staker                      Staker's address
      * @param _avgYieldRatePerToken        Average yielding rate per token for staker
      *
    */
    function addAvgYieldRatePerToken(
      YieldData storage _yieldData, 
      address _staker,
      uint _avgYieldRatePerToken
      ) 
    internal 
    {
      _yieldData.avgYieldRatePerToken[_staker] = _yieldData.avgYieldRatePerToken[_staker].add(_avgYieldRatePerToken);
    }

    /**
      * @dev Updates interestAccrued.
      * 
      * @param _interestData           Interest data
      * @param _iterest                Newly accrued intrest
      *
    */
    function addInterest(InterestData storage _interestData, uint256 _iterest) internal {
      _interestData.interestAccrued.add(_iterest);
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
      * @param _staker                     Staker's address
      * @param _withdrawnToDate            Withdrawn interest by individual staker so far.
      * @param _yieldData                  Yield Data
      * @param _totalStaked                Total staked by individual staker.
      * 
      * @return _earnedGDInterest The amount of G$ credit for the staker 
    */
    function calculateGDInterest(
      address _staker,
      uint256 _withdrawnToDate,
      YieldData _yieldData,
      uint256 _totalStaked
    ) 
    internal 
    view 
    returns 
    (
      uint256 _earnedGDInterest
    ) 
    {
      
      // will lead to -ve value
      if(_yieldData.avgYieldRatePerToken[_staker] > _yieldData.accumulatedYieldPerToken[_staker])
        return 0;
        
      uint intermediateInterest =_totalStaked.mul(_yieldData.accumulatedYieldPerToken.sub(_yieldData.avgYieldRatePerToken[_staker]));
      // will lead to -ve value
      if(_withdrawnToDate > intermediateInterest)
        return 0;

      _earnedGDInterest = intermediateInterest.sub(_withdrawnToDate);

      // To reduce it to 2 precision of G$
      return _earnedGDInterest.div(10**16);
    }

    /**
      * @dev Calculates new yielding amount per token since last update.
      * 
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * 
      * @param _dailyIntrest            Withdrawn interest by individual staker so far.
      * @param _grandTotalStaked        Average yielding rate per token
      * 
      * @return  new yield since last update.
    */
    function getAccumulatedYieldPerToken(uint256 _dailyIntrest, uint256 _grandTotalStaked) internal view returns(uint256) {
      return _dailyIntrest.mul(DECIMAL1e18).div(_grandTotalStaked);
    }

    /**
      * @dev Calculates increase in yielding rate per token since last update.
      * 
      * Formula:
      * AvgYieldRatePerToken = [(AvgYieldRatePerToken(P) x TotalStaked) + (AccumulatedYieldPerToken(P) x Staking x (1-%Donation))]/TotalStaked
      * 
      * @param _accumulatedYieldPerToken    Total yielding amount per token
      * @param _staking                     Amount staked
      * @param _donationPer                 Percentage pledged to donate.
      * @param _totalStaked                 Total staked by individual staker.
      * 
      * @return  increase in yielding rate since last update.
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