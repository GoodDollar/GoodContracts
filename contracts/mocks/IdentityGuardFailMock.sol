pragma solidity 0.5.4;

import "../identity/IdentityGuard.sol";
import "../identity/Identity.sol";

contract IdentityGuardFailMock is IdentityGuard {

    constructor() public IdentityGuard(Identity(0)) {}
}