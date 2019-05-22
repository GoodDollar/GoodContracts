pragma solidity ^0.5.2;

import "./Identity.sol";

/**
 * @title The IdentityGuard contract
 * @dev Contract containing an identity and
 * modifiers to ensure proper access
 */
contract IdentityGuard {

 Identity _identity;

 /**
 * @dev Constructor. Checks if identity is a zero address
 * @param identity The identity contract.
 */
  constructor(Identity identity) public {
    require(
      identity != Identity(0),
      "Supplied identity is null"
    );
    _identity = identity;
  }

  /**
   * @dev Modifier that requires the message sender
   * to be whitelisted
   */
  modifier onlyWhitelisted() {
    require(_identity.isWhitelisted(msg.sender), "Is not whitelisted");
    _;
  }

  /**
   * @dev Modifier that requires the given address
   * to be whitelisted
   * @param account The address to be checked
   */
  modifier requireWhitelisted(address account) {
    require(_identity.isWhitelisted(account), "Is not whitelisted");
    _;
  }
}