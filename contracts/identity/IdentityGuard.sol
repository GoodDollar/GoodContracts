pragma solidity >0.5.4;

import "./Identity.sol";

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/* @title The IdentityGuard contract
 * @dev Contract containing an identity and
 * modifiers to ensure proper access
 */
contract IdentityGuard is Ownable {
    Identity public identity;

    /* @dev Constructor. Checks if identity is a zero address
     * @param _identity The identity contract.
     */
    constructor(Identity _identity) public {
        require(_identity != Identity(0), "Supplied identity is null");
        identity = _identity;
    }

    /* @dev Modifier that requires the sender to be not blacklisted
     */
    modifier onlyNotBlacklisted() {
        require(!identity.isBlacklisted(msg.sender), "Caller is blacklisted");
        _;
    }

    /* @dev Modifier that requires the given address to be not blacklisted
     * @param _account The address to be checked
     */
    modifier requireNotBlacklisted(address _account) {
        require(!identity.isBlacklisted(_account), "Receiver is blacklisted");
        _;
    }

    /* @dev Modifier that requires the sender to be whitelisted
     */
    modifier onlyWhitelisted() {
        require(identity.isWhitelisted(msg.sender), "is not whitelisted");
        _;
    }

    /* @dev Modifier that requires the given address to be whitelisted
     * @param _account the given address
     */
    modifier requireWhitelisted(address _account) {
        require(identity.isWhitelisted(_account), "is not whitelisted");
        _;
    }

    /* @dev Modifier that requires the sender to be an approved DAO contract
     */
    modifier onlyDAOContract() {
        require(identity.isDAOContract(msg.sender), "is not whitelisted contract");
        _;
    }

    /* @dev Modifier that requires the given address to be whitelisted
     * @param _account the given address
     */
    modifier requireDAOContract(address _contract) {
        require(identity.isDAOContract(_contract), "is not whitelisted contract");
        _;
    }

    /* @dev Modifier that requires the sender to have been whitelisted
     * before or on the given date
     * @param date The time sender must have been added before
     */
    modifier onlyAddedBefore(uint256 date) {
        require(
            identity.lastAuthenticated(msg.sender) <= date,
            "Was not added within period"
        );
        _;
    }

    /* @dev Modifier that requires sender to be an identity admin
     */
    modifier onlyIdentityAdmin() {
        require(identity.isIdentityAdmin(msg.sender), "not IdentityAdmin");
        _;
    }

    /* @dev Allows owner to set a new identity contract if
     * the given identity contract has been registered as a scheme
     */
    function setIdentity(Identity _identity) public onlyOwner {
        require(_identity.isRegistered(), "Identity is not registered");
        identity = _identity;
    }
}
