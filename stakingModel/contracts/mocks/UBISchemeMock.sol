pragma solidity 0.5.4;

import "../UBIScheme.sol";

/**
 * @title An UBIScheme mock. Ignores the scheme registration.
 * Those tests can be found on e2e tests.
 */
contract UBISchemeMock is UBIScheme {

    constructor( Avatar _avatar,
        Identity _identity,
        FirstClaimPool _firstClaimPool,
        uint256 _initialReserve,
        uint256 _periodStart,
        uint256 _periodEnd,
        uint256 _maxInactiveDays
    )
        public
        UBIScheme(_avatar, _identity, _firstClaimPool, _initialReserve, _periodStart, _periodEnd, _maxInactiveDays) {}

    function start() public {
        isActive = true;
    }

    function end(Avatar _avatar) public onlyAvatar {
        DAOToken token = avatar.nativeToken();
        uint256 remainingGDReserve = token.balanceOf(address(this));
        if (remainingGDReserve > 0) {
            token.transfer(address(_avatar), remainingGDReserve);
        }
        super.internalEnd(_avatar);
    }
}