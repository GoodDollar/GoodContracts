pragma solidity 0.5.4;

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
    function end() public requirePeriodEnd returns(bool) {
        return internalEnd();
    }

    /* @dev internal end function. Sets scheme to inactive if active
     */
    function internalEnd() internal requireActive returns(bool) {
        isActive = false;
        emit SchemeEnded(msg.sender, now);
        return true;
    }
}