pragma solidity ^0.5.2;

import "./Identity.sol";

/**
 * @title The IdentityGuard contract
 * @dev Contract containing an identity and
 * modifiers to ensure proper access
 */
contract IdentityGuard {

    Identity public identity;

    /**
     * @dev Constructor. Checks if identity is a zero address
     * @param _identity The identity contract.
     */
    constructor(Identity _identity) public {
        require(_identity != Identity(0), "Supplied identity is null");
        identity = _identity;
    }

    /**
     * @dev Modifier that requires the sender
     * to be not blacklisted
     */
    modifier onlyNotBlacklisted() {
        require(!identity.isBlacklisted(msg.sender), "Is blacklisted");
        _;
    }

    /**
     * @dev Modifier that requires the given address
     * to be not blacklisted
     * @param account The address to be checked
     */
    modifier requireNotBlacklisted(address account) {
        require(!identity.isBlacklisted(account), "Is blacklisted");
        _;
    }

    modifier onlyClaimer() {
        require(identity.isClaimer(msg.sender), "is not claimer");
        _;
    }

    modifier requireClaimer(address account) {
        require(identity.isClaimer(account), "is not claimer");
        _;
    }

    function setIdentity(Identity _identity) public {
        require(_identity.isRegistered(), "Identity is not registered");
        identity = _identity;
    }
}