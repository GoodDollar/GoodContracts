pragma solidity 0.5.4;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library InterestDistribution {
    using SafeMath for uint256;

    /**
      * @dev Calculates GD Interest for staker for their stake.
      * 
      * Formula:
      * Return = 
      * 
      * @param _donationPer              The fraction of interest donated by staker.
      * @param _staked                   Amount staked
      * @param _withdrawnGD              GD staker withdraw  ≤ EarnedGDInterest
      * @param _dailyInterest            G$ deposited from reserve to the DeFi
      * 
      * @return _earnedGDInterest The amount of G$ credit for the staker 
      * @return _totalStaked The balance of each staking
    */
    function calculateGDInterest(
      uint256 _donationPer,
      uint256 _staked,
      uint256 _withdrawnGD,
      uint256 _dailyInterest
    ) public 
    view 
    returns 
    (
      uint256 _earnedGDInterest,
      uint256 _totalStaked
    ) 
    {
        
    }

    
}