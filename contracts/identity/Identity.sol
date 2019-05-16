pragma solidity 0.5.2;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./WhitelistAdminRole.sol";

contract Identity is WhitelistAdminRole {
  using Roles for Roles.Role;
  using SafeMath for uint;

  Roles.Role private whitelist;
  uint whitelistedCount;

  event WhitelistAdded(address indexed account);
  event WhitelistRemoved(address indexed account);

 

  function addWhitelisted(address account) 
    public
    onlyWhitelistAdmin
  {
    _addWhitelisted(account);
  }

  function removeWhitelisted(address account)
    public
    onlyWhitelistAdmin
  {
    _removeWhitelisted(account);
  }

  function isWhitelisted(address account)
    public
    view
    returns (bool)
  {
    return whitelist.has(account);
  }

  function getWhitelistedCount() 
    public
    view
    returns (uint)
  {
    return whitelistedCount;
  }

  function increaseWhitelistedCount(uint value) 
    internal
  {
    whitelistedCount = whitelistedCount.add(value);
  }

  function decreaseWhitelistedCount(uint value)
    internal
  {
    whitelistedCount = whitelistedCount.sub(value);
  }

  function _addWhitelisted(address account)
    internal
  {
    whitelist.add(account);
    increaseWhitelistedCount(1);
    emit WhitelistAdded(account);
  }

  function _removeWhitelisted(address account)
    internal
  {
    whitelist.remove(account);
    decreaseWhitelistedCount(1);
    emit WhitelistRemoved(account);
  }
}
