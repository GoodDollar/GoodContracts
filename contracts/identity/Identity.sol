pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "@daostack/arc/contracts/controller/Avatar.sol";

import "../dao/schemes/SchemeGuard.sol";
import "./IdentityAdminRole.sol";

/* @title Identity contract responsible for whitelisting
 * and keeping track of amount of whitelisted users
 */
contract Identity is IdentityAdminRole, SchemeGuard {
    using Roles for Roles.Role;
    using SafeMath for uint256;

    Roles.Role private blacklist;
    Roles.Role private whitelist;
    Roles.Role private contracts;

    uint256 private whitelistedCount = 0;
    uint256 private whitelistedContracts = 0;

    mapping(address => uint) public dateAdded;

    mapping (address => string) public addrToDID;
    mapping (bytes32 => address) public didHashToAddress;

    event BlacklistAdded(address indexed account);
    event BlacklistRemoved(address indexed account);
 
    event WhitelistedAdded(address indexed account);
    event WhitelistedRemoved(address indexed account);

    event ContractAdded(address indexed account);
    event ContractRemoved(address indexed account);

    constructor() public SchemeGuard(Avatar(0)) {}

    /* @dev Adds an address as whitelisted. Eligble for claiming UBI.
     * Can only be called by Identity Administrators.
     * @param account address to add as whitelisted
     */
    function addWhitelisted(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
    {
        _addWhitelisted(account);
    }

    function addWhitelistedWithDID(address account, string memory did) 
        public
        onlyRegistered
        onlyIdentityAdmin 
    {
        _addWhitelisted(account);

        bytes32 pHash = keccak256(bytes(did));
        addrToDID[account] = did;
        didHashToAddress[pHash] = account;
    }

    /* @dev Removes an address as whitelisted.
     * Can only be called by Identity Administrators.
     * @param account address to remove as whitelisted
     */
    function removeWhitelisted(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
    {
        _removeWhitelisted(account);
    }

    function renounceWhitelisted() public {
        _removeWhitelisted(msg.sender);
    }

    /* @dev Reverts if given address has not been added to whitelist
     * @param account the address to check
     * @return a bool indicating weather the address is present in whitelist
     */
    function isWhitelisted(address account)
        public
        view
        returns (bool)
    {
        return whitelist.has(account);
    }

    /* @dev Gets the amount of whitelist
     * @return a uint representing the current amount of whitelist
     */
    function getWhitelistedCount()
        public
        view
        returns (uint)
    {
        return whitelistedCount;
    }

    function getWhitelistedNonContracts()
        public
        view
        returns (uint256)
    {
        return whitelistedCount.sub(whitelistedContracts);
    }

    function wasAdded(address account) public view returns (uint) {
        return dateAdded[account];
    }

    function transferAccount(address account) public {
        require(!isBlacklisted(account), "Cannot transfer to blacklisted");

        string memory did = addrToDID[msg.sender];
        bytes32 pHash = keccak256(bytes(did));

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
    {
        blacklist.remove(account);
        emit BlacklistRemoved(account);
    }

    function addContract(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
    {
        require(isContract(account), "Given address is not a contract");
        contracts.add(account);
        _addWhitelisted(account);

        emit ContractAdded(account);
    }

    function removeContract(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
    {
        contracts.remove(account);
        _removeWhitelisted(account);
    }

    function isDAOContract(address account)
        public
        view
        returns (bool)
    {
        return contracts.has(account);
    }

    function _addWhitelisted(address account) internal {
        whitelist.add(account);
        
        increaseWhitelistedCount();
        dateAdded[account] = now;

        if(isContract(account))
        {
            whitelistedContracts += 1;
        }

        emit WhitelistedAdded(account);
    }

    function _removeWhitelisted(address account) internal {
        whitelist.remove(account);

        decreaseWhitelistedCount();
        delete dateAdded[account];

        if (isContract(account)) {
            whitelistedContracts -= 1;
        }

        string memory did = addrToDID[account];
        bytes32 pHash = keccak256(bytes(did));

        delete dateAdded[account];
        delete addrToDID[account];
        delete didHashToAddress[pHash];

        emit WhitelistedRemoved(account);
    }

    /* @dev Reverts if given address has been added to the blacklist
     * @param account the address to check
     * @return a bool indicating weather the address is present in the blacklist
     */
    function isBlacklisted(address account)
        public
        view
        returns (bool)
    {
        return blacklist.has(account);
    }

    /* @dev Checks to see if given address is a contract
     */
    function isContract(address _addr)
        view
        internal
        returns (bool)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    /* @dev Internal function that increases count of whitelisted users by
     * given amount
     * @param value an uint with which the whitelisted count will increase by
     */
    function increaseWhitelistedCount()
        internal
    {
        whitelistedCount = whitelistedCount.add(1);
    }

    /* @dev Internal function that decreases count of whitelisted users by
     * given amount
     * @param value an uint with which the whitelisted count will increase by
     */
    function decreaseWhitelistedCount()
        internal
    {
        whitelistedCount = whitelistedCount.sub(1);
    }
}