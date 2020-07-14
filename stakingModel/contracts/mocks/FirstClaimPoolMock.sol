pragma solidity 0.5.4;

import "../FirstClaimPool.sol";


/**
 * @title A FirstClaimPool mock. Ignores the scheme registration.
 * Those tests can be found on e2e tests.
 */
contract FirstClaimPoolMock is FirstClaimPool {
    constructor(Avatar _avatar, Identity _identity, uint256 _claimAmount)
        public
        FirstClaimPool(_avatar, _identity, _claimAmount)
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
