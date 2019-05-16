pragma solidity ^0.5.2;

import "./Identity.sol";

contract IdentityGuard {

 Identity _identity;

  constructor(Identity identity) public {
    _identity = identity;
  }

  modifier onlyWhitelisted() {
    require(_identity.isWhitelisted(msg.sender), "Is not whitelisted" );
    _;
  }

  modifier requireWhitelisted(address account) {
    require(_identity.isWhitelisted(account), "Is not whitelisted");
    _;
  }
}