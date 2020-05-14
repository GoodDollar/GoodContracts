pragma solidity 0.5.4;

import "../UBIScheme.sol";


contract UBISchemeMock is UBIScheme {
    constructor(Avatar _avatar, Identity _identity, uint256 _periodStart, uint256 _periodEnd, uint256 _maxInactiveDays)
        public
        UBIScheme(_avatar, _identity, _periodStart, _periodEnd, _maxInactiveDays)
    {}

    function start() public {
        isActive = true;
    }
}
