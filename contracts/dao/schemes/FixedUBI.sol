pragma solidity 0.5.4;

import "./UBI.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/* @title Fixed amount-per-day UBI scheme allowing multiple claims
 * during a longer period
 */
contract FixedUBI is AbstractUBI {
    using SafeMath for uint256;

    /* @dev Constructor
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract
     * @param _initialReserve The initial amount to transfer to this contract
     * @param _periodStart The time from when the contract can start
     * @param _periodEnd The time from when the contract can end
     * @param _claimDistribution The amount to claim per day
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _initialReserve,
        uint256 _periodStart,
        uint256 _periodEnd,
        uint256 _claimDistribution
    )
        public
        AbstractUBI(
            _avatar,
            _identity,
            _initialReserve,
            _periodStart,
            _periodEnd
        )
    {
        require(_claimDistribution > 0, "Distribution cannot be zero");

        claimDistribution = _claimDistribution;
    }

    /* @dev The claim calculation formula. Checks to see how many days
     * the given address can claim for, with days 7 being the maximum.
     * If the user has not claimed yet, they will be eligible to claim for
     * The amount of days they have been whitelisted, up to seven.
     * @param amount the amount per day one can claim
     * @param user the claiming address
     * @return the amount of GoodDollar the user can claim
     */
    function distributionFormula(uint256 amount, address user)
        internal
        returns (uint256)
    {
        if (lastClaimed[user] == 0) {
            lastClaimed[user] = identity.dateAuthenticated(user).sub(1 days);
        }

        uint256 claimDays = now.sub(lastClaimed[user]) / 1 days;

        require(claimDays >= 1, "Has claimed within a day");
        return amount;
    }

    /* @dev Sets the currentDay variable to amount of days
     * since start of contract. Internal function
     */
    function setDay() internal {
        currentDay = (now.sub(periodStart)) / 1 days;
    }

    /* @dev Checks amount address is eligible to claim for, regardless if they have been
     * whitelisted or not. If they have not been whitelisted, they are eligible to claim for one day.
     * @return The amount of GoodDollar the address can claim.
     */
    function checkEntitlement() public view requireActive returns (uint256) {
        uint256 lastClaimed = lastClaimed[msg.sender] > 0
            ? lastClaimed[msg.sender]
            : (
                identity.dateAuthenticated(msg.sender) > 0
                    ? identity.dateAuthenticated(msg.sender).sub(1 days)
                    : now.sub(1 days)
            );

        uint256 claimDays = now.sub(lastClaimed) / 1 days;
        uint256 claimAmount = claimDays >= 1 ? claimDistribution : 0;

        return claimAmount;
    }

    /* @dev Function for claiming UBI. Requires contract to be active and claimer to be whitelisted.
     * Calls distributionFormula, calculating the amount the caller can claim, and transfers the amount
     * to the caller. Emits the address of caller and amount claimed.
     * @return A bool indicating if UBI was claimed
     */
    function claim() public requireActive onlyWhitelisted returns (bool) {
        uint256 newDistribution = distributionFormula(
            claimDistribution,
            msg.sender
        );
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
