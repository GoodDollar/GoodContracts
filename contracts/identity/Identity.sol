pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./IdentityAdminRole.sol";

/**  @title Identity contract responsible for whitelisting
  * and keeping track of amount of whitelisted users
  */
contract Identity is IdentityAdminRole {
  using Roles for Roles.Role;
  using SafeMath for uint256;

  Roles.Role private whitelist;
  Roles.Role private claimers;

  uint256 claimerCount;

  event WhitelistAdded(address indexed account);
  event WhitelistRemoved(address indexed account);

  event ClaimerAdded(address indexed account);
  event ClaimerRemoved(address indexed account);



/**
 * @dev Calls internal function _addWhitelisted with given address.
 * Can only be called by whitelist Administrators
 * @param account address to pass to internal function
 */
  function addIdentity(address account, bool isClaimer)
    public
    onlyIdentityAdmin
  {
    if (isClaimer) {
      _addClaimer(account);
    }
    _addWhitelisted(account);
  }

/**
 * @dev Calls internal function _removeWhitelisted with given address.
 * Can only be called by whitelist Administrators
 * @param account address to pass to internal function
 */
  function removeIdentity(address account)
    public
    onlyIdentityAdmin
  {
    if (isClaimer(account)) {
      _removeClaimer(account);
    }
    _removeWhitelisted(account);
  }

/**
 * @dev Revets if given address has not been added to the whitelist
 * @param account the address to check
 * @return a bool indicating weather the address is present in the whitelist
 */
  function isWhitelisted(address account)
    public
    view
    returns (bool)
  {
    return whitelist.has(account);
  }

  function isClaimer(address account)
    public
    view
    returns (bool)
  {
    return claimers.has(account);
  }

/**
 * @dev Gets the amount of currently whitelisted users
 * @return a uint representing the current amount of whitelisted users
 */
  function getClaimerCount()
    public
    view
    returns (uint)
  {
    return claimerCount;
  }

/**
 * @dev Internal function that increases count of whitelisted users by
 * given amount
 * @param value an uint with which the whitelisted count will increase by
 */
  function increaseClaimerCount(uint value)
    internal
  {
    claimerCount = claimerCount.add(value);
  }

/**
 * @dev Internal function that decreases count of whitelisted users by
 * given amount
 * @param value an uint with which the whitelisted count will increase by
 */
  function decreaseClaimerCount(uint value)
    internal
  {
    claimerCount = claimerCount.sub(value);
  }

/**
 * @dev Internal function that adds given address to the whitelist,
 * increments the count of whitelisted users by one and emits an event
 * @param account the address to add to whitelist
 */
  function _addWhitelisted(address account)
    internal
  {
    whitelist.add(account);
    emit WhitelistAdded(account);
  }

/**
 * @dev Internal function that removes given address from the whitelist,
 * decrements the count of whitelisted users by one and emits an event
 * @param account the address to remove from whitelist
 */
  function _removeWhitelisted(address account)
    internal
  {
    whitelist.remove(account);
    emit WhitelistRemoved(account);
  }

  function _addClaimer(address account)
    internal
  {
    claimers.add(account);
    increaseClaimerCount(1);
    emit ClaimerAdded(account);
  }

  function _removeClaimer(address account)
    internal
  {
    claimers.remove(account);
    decreaseClaimerCount(1);
    emit ClaimerRemoved(account);
  }
}