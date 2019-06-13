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
        require(identity != Identity(0), "Supplied identity is null");
        _identity = identity;
    }

    /**
     * @dev Modifier that requires the sender
     * to be not blacklisted
     */
    modifier onlyNotBlacklisted() {
        require(!_identity.isBlacklisted(msg.sender), "Is blacklisted");
        _;
    }

    /**
     * @dev Modifier that requires the given address
     * to be not blacklisted
     * @param account The address to be checked
     */
    modifier requireNotBlacklisted(address account) {
        require(!_identity.isBlacklisted(account), "Is blacklisted");
        _;
    }

    modifier onlyClaimer() {
        require(_identity.isClaimer(msg.sender), "is not claimer");
        _;
    }

    modifier requireClaimer(address account) {
        require(_identity.isClaimer(account), "is not claimer");
        _;
    }
}