pragma solidity 0.5.4;

import "../FirstClaimPool.sol";


/**
 * @title A FirstClaimPool mock. Ignores the scheme registration.
 * Those tests can be found on e2e tests.
 */
contract FirstClaimPoolMock is FirstClaimPool {
    constructor(uint256 _claimAmount, Avatar _avatar, Identity _identity)
        public
        FirstClaimPool(_claimAmount, _avatar, _identity)
    {}

    function start() public {
        isActive = true;
    }

    function end() public onlyAvatar {
        DAOToken token = avatar.nativeToken();
        uint256 remainingGDReserve = token.balanceOf(address(this));
        if (remainingGDReserve > 0) {
            token.transfer(address(avatar), remainingGDReserve);
        }
        super.internalEnd(avatar);
    }
}
