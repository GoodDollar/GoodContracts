pragma solidity 0.5.4;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library InterestDistribution {
    using SafeMath for uint256;

    // Minimum value supported by int256
    int256 constant INT256_MIN = int256((uint256(1) << 255));

    // Maximum value supported by int256
    int256 constant INT256_MAX = int256(~((uint256(1) << 255)));

    // 10^18
    uint256 constant DECIMAL1e18 = 10 ** 18;

    /**
      * @dev Calculates GD Interest for staker for their stake.
      * 
      * Formula:
      * EarnedGDInterest = MAX[TotalStaked x (AccumulatedYieldPerDAI - AvgYieldRatePerDAI) - WithdrawnToDate, 0]
      * 
      * @param _withdrawnToDate            Withdrawn interest by individual staker so far.
      * @param _avgYieldRatePerToken       Average yielding rate per token
      * @param _accumulatedYieldPerToken   Total yielding amount per token
      * @param _totalStaked                Total staked by individual staker.
      * 
      * @return _earnedGDInterest The amount of G$ credit for the staker 
    */
    function calculateGDInterest(
      uint256 _withdrawnToDate,
      uint256 _avgYieldRatePerToken,
      uint256 _accumulatedYieldPerToken,
      uint256 _totalStaked
    ) 
    internal 
    view 
    returns 
    (
      uint256 _earnedGDInterest
    ) 
    {
      
      int interest = sub(mul(_totalStaked, sub(_accumulatedYieldPerToken, _avgYieldRatePerToken)), _withdrawnToDate);
      if(interest < 0)
        return 0;
      // To reduce it to 2 precision of G$
      return uint(interest).div(10**16);
    }

    /**
      * @dev Calculates new yielding amount per token since last update.
      * 
      * Formula:
      * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + (Daily Interest/GrandTotalStaked)
      * 
      * @param _dailyIntrest            Withdrawn interest by individual staker so far.
      * @param _grandTotalStaked       Average yielding rate per token
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

    /**
      * @dev Safe method for Subtracting signed integer. 
    */
    function sub(int256 a, int256 b) internal pure returns (int256) {
        assert(!(a > 0 && b > INT256_MIN - a));  // underflow
        assert(!(a < 0 && b < INT256_MAX - a));  // overflow

        return a - b;
    }

    /**
      * @dev Safe method for Adding signed integer. 
    */
    function add(int256 a, int256 b) internal pure returns (int256) {
        assert(!(a > 0 && b > INT256_MAX - a));  // overflow
        assert(!(a < 0 && b < INT256_MIN - a));  // underflow

        return a + b;
    }

    /**
      * @dev Safe method for Multiplying signed integer. 
    */
    function mul(int256 a, int256 b) internal pure returns (int256) {
        if (a == 0) {
            return 0;
        }
        int256 c = a * b;
        assert(c / a == b);
        return c;
    }

    
}