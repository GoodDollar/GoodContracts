pragma solidity 0.5.4;

import "../FirstClaimPool.sol";

contract FirstClaimPoolMock is FirstClaimPool {

    constructor(uint256 _claimAmount,
        Avatar _avatar,
        Identity _identity
    )
        public
        FirstClaimPool(_claimAmount, _avatar, _identity) {}

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
