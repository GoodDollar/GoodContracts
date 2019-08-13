pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";

/* @title Abstract contract responsible for ensuring a scheme is only usable within a set period
 */
contract ActivePeriod {

    uint public periodStart;
    uint public periodEnd;

    bool public isActive;

    event SchemeStarted(address indexed by, uint time);
    event SchemeEnded(address indexed by, uint time);

    /* @dev requires scheme to be active 
     */
    modifier requireActive() {
        require(isActive, "is not active");
        _;
    }

    /* @dev requires scheme to not be active
     */
    modifier requireNotActive() {
        require(!isActive, "cannot start twice");
        _;
    }

    /* @dev requires current time to be after period start and before period end
     */
    modifier requireInPeriod() {
        require(now >= periodStart && now < periodEnd, "not in period");
        _;
    }

    /* @dev requires current time to be after period end
     */
    modifier requirePeriodEnd() {
        require(now >= periodEnd, "period has not ended");
        _;
    }

    /* @dev makes sure that the end period is after the start period
     * and sets the contract to inactive
     * @param _periodStart The time from when the contract can be started
     * @param _periodEnd The time from which the contract can be ended
     */
    constructor( uint _periodStart, uint _periodEnd) public {
        require(_periodStart < _periodEnd, "start cannot be after nor equal to end");

        periodStart = _periodStart;
        periodEnd = _periodEnd;

        isActive = false;
    }

    /* @dev Sets scheme to active if inactive and within period
     */
    function start() public requireInPeriod requireNotActive returns(bool) {
        isActive = true;
        emit SchemeStarted(msg.sender, now);
        return true;
    }

    /* @dev public end function. Calls internalEnd if after period end
     */
    function end(Avatar _avatar) public requirePeriodEnd {
        return internalEnd(_avatar);
    }

    /* @dev internal end function. Sets scheme to inactive if active
     */
    function internalEnd(Avatar _avatar) internal requireActive {
        isActive = false;
        emit SchemeEnded(msg.sender, now);
        selfdestruct(address(_avatar));
    }
}