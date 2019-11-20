pragma solidity 0.5.4;

import "./Identity.sol";

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/* @title The IdentityGuard contract
 * @dev Contract containing an identity and
 * modifiers to ensure proper access
 */
contract IdentityGuard is Ownable{

    Identity public identity;

    /* @dev Constructor. Checks if identity is a zero address
     * @param _identity The identity contract.
     */
    constructor(Identity _identity) public {
        require(_identity != Identity(0), "Supplied identity is null");
        identity = _identity;
    }

    /* @dev Modifier that requires the sender
     * to be not blacklisted
     */
    modifier onlyNotBlacklisted() {
        require(!identity.isBlacklisted(msg.sender), "Caller is blacklisted");
        _;
    }

    /* @dev Modifier that requires the given address
     * to be not blacklisted
     * @param _account The address to be checked
     */
    modifier requireNotBlacklisted(address _account) {
        require(!identity.isBlacklisted(_account), "Receiver is blacklisted");
        _;
    }

    /* @dev Modifier that requires the sender
     * to be whitelisted
     */
    modifier onlyWhitelisted() {
        require(identity.isWhitelisted(msg.sender), "is not whitelisted");
        _;
    }

    /* @dev Modifier that requires the given address
     * to be whitelisted
     * @param _account the given address
     */
    modifier requireWhitelisted(address _account) {
        require(identity.isWhitelisted(_account), "is not whitelisted");
        _;
    }

    modifier onlyAddedBefore(uint date) {
        require(identity.wasAdded(msg.sender) <= date, "Was not added within period");
        _;
    }

    modifier onlyIdentityAdmin() {
        require(identity.isIdentityAdmin(msg.sender), "not IdentityAdmin");
        _;
    }

    /* @dev Allows anyone to set a new identity contract if
     * the given contract has been registered as a scheme
     */
    function setIdentity(Identity _identity) public onlyOwner() {
        require(_identity.isRegistered(), "Identity is not registered");
        identity = _identity;
    }
}