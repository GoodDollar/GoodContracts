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
    Roles.Role private claimers;

    uint256 private claimerCount;

    event BlacklistAdded(address indexed account);
    event BlacklistRemoved(address indexed account);
 
    event ClaimerAdded(address indexed account);
    event ClaimerRemoved(address indexed account);

    constructor() public SchemeGuard(Avatar(0)) {}

    /* @dev Adds an address as a claimer. Eligble for claiming UBI.
     * Can only be called by Identity Administrators.
     * @param account address to add as a claimer
     */
    function addClaimer(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
    {
        claimers.add(account);
        increaseClaimerCount(1);
        emit ClaimerAdded(account);
    }

    /* @dev Removes an address as a claimer.
     * Can only be called by Identity Administrators.
     * @param account address to remove as a claimer
     */
    function removeClaimer(address account)
        public
        onlyRegistered
        onlyIdentityAdmin
    {
        claimers.remove(account);
        decreaseClaimerCount(1);
        emit ClaimerRemoved(account);
    }

    /* @dev Reverts if given address has not been added to claimers
     * @param account the address to check
     * @return a bool indicating weather the address is present in claimers
     */
    function isClaimer(address account)
        public
        view
        returns (bool)
    {
        return claimers.has(account);
    }

    /* @dev Gets the amount of claimers
     * @return a uint representing the current amount of claimers
     */
    function getClaimerCount()
        public
        view
        returns (uint)
    {
        return claimerCount;
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

    /* @dev Internal function that increases count of whitelisted users by
     * given amount
     * @param value an uint with which the whitelisted count will increase by
     */
    function increaseClaimerCount(uint value)
        internal
    {
        claimerCount = claimerCount.add(value);
    }

    /* @dev Internal function that decreases count of whitelisted users by
     * given amount
     * @param value an uint with which the whitelisted count will increase by
     */
    function decreaseClaimerCount(uint value)
        internal
    {
        claimerCount = claimerCount.sub(value);
    }
}