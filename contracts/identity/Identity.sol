pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

import "@daostack/arc/contracts/controller/Avatar.sol";

import "../dao/schemes/SchemeGuard.sol";
import "./IdentityAdminRole.sol";


/* @title Identity contract responsible for whitelisting
 * and keeping track of amount of whitelisted users
 */
contract Identity is IdentityAdminRole, SchemeGuard, Pausable {
    using Roles for Roles.Role;
    using SafeMath for uint256;

    Roles.Role private blacklist;
    Roles.Role private whitelist;
    Roles.Role private contracts;

    uint256 public whitelistedCount = 0;
    uint256 public whitelistedContracts = 0;
    uint256 public authenticationPeriod = 14;

    mapping(address => uint256) public dateAuthenticated;

    mapping(address => string) public addrToDID;
    mapping(bytes32 => address) public didHashToAddress;

    event BlacklistAdded(address indexed account);
    event BlacklistRemoved(address indexed account);

    event WhitelistedAdded(address indexed account);
    event WhitelistedRemoved(address indexed account);

    event ContractAdded(address indexed account);
    event ContractRemoved(address indexed account);

    constructor() public SchemeGuard(Avatar(0)) {}

    /* @dev Sets a new value for authenticationPeriod.
     * Can only be called by Identity Administrators.
     * @param period new value for authenticationPeriod
     */
    function setAuthenticationPeriod(uint256 period)
        public
        onlyOwner
        whenNotPaused
    {
        authenticationPeriod = period;
    }

    /* @dev Sets the authentication date of `account`
     * to the current time.
     * Can only be called by Identity Administrators.
     * @param account address to change its auth date
     */
    function authenticate(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
        whenNotPaused
    {
        dateAuthenticated[account] = now;
    }

    /* @dev Adds an address as whitelisted.
     * Can only be called by Identity Administrators.
     * @param account address to add as whitelisted
     */
    function addWhitelisted(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
        whenNotPaused
    {
        _addWhitelisted(account);
    }

    /* @dev Adds an address as whitelisted under a specific ID
     * @param account The address to add
     * @param did the ID to add account under
     */
    function addWhitelistedWithDID(address account, string memory did)
        public
        onlyRegistered
        onlyIdentityAdmin
        whenNotPaused
    {
        _addWhitelistedWithDID(account, did);
    }

    /* @dev Removes an address as whitelisted.
     * Can only be called by Identity Administrators.
     * @param account address to remove as whitelisted
     */
    function removeWhitelisted(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
        whenNotPaused
    {
        _removeWhitelisted(account);
    }

    /* @dev Renounces message sender from whitelisted
     */
    function renounceWhitelisted() public whenNotPaused {
        _removeWhitelisted(msg.sender);
    }

    /* @dev Returns true if given address has been added to whitelist
     * @param account the address to check
     * @return a bool indicating weather the address is present in whitelist
     */
    function isWhitelisted(address account) public view returns (bool) {
       uint256 daysSinceAuthentication = (now.sub(dateAuthenticated[account])) / 1 days;
        return (daysSinceAuthentication <= authenticationPeriod);
    }

    /* @dev Function that gives the date the given user was added
     * @param account The address to check
     * @return The date the address was added
     */
    function lastAuthenticated(address account) public view returns (uint256) {
        return dateAuthenticated[account];
    }

    /* @dev Function to transfer whitelisted privilege to another address
     * relocates did of sender to give address
     * @param account The address to transfer to
     */
    function transferAccount(address account) public whenNotPaused {
        ERC20 token = avatar.nativeToken();

        require(!isBlacklisted(account), "Cannot transfer to blacklisted");
        require(token.balanceOf(account) == 0, "Account is already in use");

        require(
            keccak256(bytes(addrToDID[account])) == keccak256(bytes("")),
            "address already has DID"
        );

        string memory did = addrToDID[msg.sender];
        bytes32 pHash = keccak256(bytes(did));

        uint256 balance = token.balanceOf(msg.sender);
        token.transferFrom(msg.sender, account, balance);
        _removeWhitelisted(msg.sender);
        _addWhitelisted(account);
        addrToDID[account] = did;
        didHashToAddress[pHash] = account;
    }

    /* @dev Adds an address to blacklist.
     * Can only be called by Identity Administrators.
     * @param account address to add as blacklisted
     */
    function addBlacklisted(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
        whenNotPaused
    {
        blacklist.add(account);
        emit BlacklistAdded(account);
    }

    /* @dev Removes an address from blacklist
     * Can only be called by Identity Administrators.
     * @param account address to remove as blacklisted
     */
    function removeBlacklisted(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
        whenNotPaused
    {
        blacklist.remove(account);
        emit BlacklistRemoved(account);
    }

    /* @dev Function to add a Contract to list of contracts
     * @param account The address to add
     */
    function addContract(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
        whenNotPaused
    {
        require(isContract(account), "Given address is not a contract");
        contracts.add(account);
        _addWhitelisted(account);

        emit ContractAdded(account);
    }

    /* @dev Function to remove a Contract from list of contracts
     * @param account The address to add
     */
    function removeContract(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
        whenNotPaused
    {
        contracts.remove(account);
        _removeWhitelisted(account);

        emit ContractRemoved(account);
    }

    /* @dev Function to check if given contract is on list of contracts.
     * @param address to check
     * @return a bool indicating if address is on list of contracts
     */
    function isDAOContract(address account) public view returns (bool) {
        return contracts.has(account);
    }

    /* @dev Internal function to add to whitelisted
     * @param account the address to add
     */
    function _addWhitelisted(address account) internal {
        whitelist.add(account);

        whitelistedCount += 1;
        dateAuthenticated[account] = now;

        if (isContract(account)) {
            whitelistedContracts += 1;
        }

        emit WhitelistedAdded(account);
    }

    /* @dev Internal whitelisting with did function.
     * @param account the address to add
     * @param did the id to register account under
     */
    function _addWhitelistedWithDID(address account, string memory did)
        internal
    {
        bytes32 pHash = keccak256(bytes(did));
        require(
            didHashToAddress[pHash] == address(0),
            "DID already registered"
        );

        addrToDID[account] = did;
        didHashToAddress[pHash] = account;

        _addWhitelisted(account);
    }

    /* @dev Internal function to remove from whitelisted
     * @param account the address to add
     */
    function _removeWhitelisted(address account) internal {
        whitelist.remove(account);

        whitelistedCount -= 1;
        delete dateAuthenticated[account];

        if (isContract(account)) {
            whitelistedContracts -= 1;
        }

        string memory did = addrToDID[account];
        bytes32 pHash = keccak256(bytes(did));

        delete dateAuthenticated[account];
        delete addrToDID[account];
        delete didHashToAddress[pHash];

        emit WhitelistedRemoved(account);
    }

    /* @dev Returns true if given address has been added to the blacklist
     * @param account the address to check
     * @return a bool indicating weather the address is present in the blacklist
     */
    function isBlacklisted(address account) public view returns (bool) {
        return blacklist.has(account);
    }

    /* @dev Function to see if given address is a contract
     * @return true if address is a contract
     */
    function isContract(address _addr) internal view returns (bool) {
        uint256 length;
        assembly {
            length := extcodesize(_addr)
        }
        return length > 0;
    }
}
