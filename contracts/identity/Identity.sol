pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./WhitelistAdminRole.sol";

/**  @title Identity contract responsible for whitelisting
  * and keeping track of amount of whitelisted users
  */
contract Identity is WhitelistAdminRole {
  using Roles for Roles.Role;
  using SafeMath for uint;

  Roles.Role private whitelist;
  uint whitelistedCount;

  event WhitelistAdded(address indexed account);
  event WhitelistRemoved(address indexed account);


/**
 * @dev Calls internal function _addWhitelisted with given address.
 * Can only be called by whitelist Administrators
 * @param account address to pass to internal function
 */
  function addWhitelisted(address account)
    public
    onlyWhitelistAdmin
  {
    _addWhitelisted(account);
  }

/**
 * @dev Calls internal function _removeWhitelisted with given address.
 * Can only be called by whitelist Administrators
 * @param account address to pass to internal function
 */
  function removeWhitelisted(address account)
    public
    onlyWhitelistAdmin
  {
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

/**
 * @dev Gets the amount of currently whitelisted users
 * @return a uint representing the current amount of whitelisted users
 */
  function getWhitelistedCount()
    public
    view
    returns (uint)
  {
    return whitelistedCount;
  }

/**
 * @dev Internal function that increases count of whitelisted users by
 * given amount
 * @param value an uint with which the whitelisted count will increase by
 */
  function increaseWhitelistedCount(uint value)
    internal
  {
    whitelistedCount = whitelistedCount.add(value);
  }

/**
 * @dev Internal function that decreases count of whitelisted users by
 * given amount
 * @param value an uint with which the whitelisted count will increase by
 */
  function decreaseWhitelistedCount(uint value)
    internal
  {
    whitelistedCount = whitelistedCount.sub(value);
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
    increaseWhitelistedCount(1);
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
    decreaseWhitelistedCount(1);
    emit WhitelistRemoved(account);
  }
}
