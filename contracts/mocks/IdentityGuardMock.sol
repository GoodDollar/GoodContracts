pragma solidity 0.5.4;

import "../identity/IdentityGuard.sol";
import "../identity/Identity.sol";

contract IdentityGuardMock is IdentityGuard {

    constructor(Identity _identity) public IdentityGuard(_identity) {}

    function blacklistMock(address to) public onlyNotBlacklisted requireNotBlacklisted(to) returns(bool) {
        return true;
    }

    function checkWhitelisted(address to) public requireWhitelisted(to) returns (bool) {
        return true;
    }
}