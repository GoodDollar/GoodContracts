pragma solidity 0.5.4;

import "./UBI.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/* @title Fixed amount-per-day UBI scheme allowing multiple claims
 * across a longer period
 */
contract FixedUBI is AbstractUBI {
    using SafeMath for uint256;

    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _initialReserve,
        uint256 _periodStart,
        uint256 _periodEnd,
        uint256 _claimDistribution
    )
        public
        AbstractUBI(_avatar, _identity, _initialReserve, _periodStart, _periodEnd)
    {
        claimDistribution = _claimDistribution;
    }

    /* @dev the claim calculation formula. Checks to see how many days
     * the given address can claim for, with 7 being the maximum
     * @param amount the amount per day one can claim
     * @param user the claiming address
     */
    function distributionFormula(uint256 amount, address user) internal returns(uint256)
    {
        if(lastClaimed[user] == 0) {
            lastClaimed[user] = identity.dateAdded(user).sub(1 days);
        }

        uint256 claimDays = now.sub(lastClaimed[user]) / 1 days; 
        
        claimDays = claimDays > 7 ? 7 : claimDays;

        require(claimDays >= 1, "Has claimed within a day");
        return amount.mul(claimDays);
    }

    /* @dev Sets the currentDay variable. Internal function
     */
    function setDay() internal {
        currentDay = (now.sub(periodStart)) / 1 days;
    }

    /* @dev Checks amount user is eligble to claim for
     * @returns an uint256 indicating the amount the user can claim for
     */
    function checkEntitlement() public view requireActive returns (uint256) 
    {
        uint256 lastClaimed = lastClaimed[msg.sender] > 0 ?
            lastClaimed[msg.sender] :
            (identity.dateAdded(msg.sender) > 0 ? identity.dateAdded(msg.sender).sub(1 days) : now.sub(1 days));

        uint256 claimDays = now.sub(lastClaimed) / 1 days;
        claimDays = claimDays > 7 ? 7 : claimDays;
        uint256 claimAmount = claimDistribution;

        return claimAmount.mul(claimDays);
    }

    /* @dev Claiming function. Calculates how many days one can claim for and logs
     * new claim and amount for the day.
     * @returns A bool indicating if UBI was claimed
     */
    function claim()
        public
        requireActive
        onlyWhitelisted
        returns (bool)
    {
        uint256 newDistribution = distributionFormula(claimDistribution, msg.sender);
        lastClaimed[msg.sender] = now;
        setDay();

        GoodDollar token = GoodDollar(address(avatar.nativeToken()));
        token.transfer(msg.sender, newDistribution);

        Day memory day = claimDay[currentDay];
        
        day.amountOfClaimers = day.amountOfClaimers.add(1);
        day.claimAmount = day.claimAmount.add(newDistribution);
        
        claimDay[currentDay] = day;

        emit UBIClaimed(msg.sender, newDistribution);

        return true;
    }
}
