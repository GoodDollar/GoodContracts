pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/access/roles/WhitelistedRole.sol";

contract Identity is WhitelistedRole {
    
  uint256 public whiteListedCount = 0;

  constructor() public {
    addWhitelisted(msg.sender);
  }
  
  function isVerified(
    address _account
  ) public view returns(bool) {
    return isWhitelisted(_account);
  }

  function addWhitelisted(address account) public onlyWhitelistAdmin {
    if(isWhitelisted(account)) return;
    super.addWhitelisted(account);
    whiteListedCount += 1;
  }

  function removeWhitelisted(address account) public onlyWhitelistAdmin {
    if(!isWhitelisted(account)) return;
    super.removeWhitelisted(account);
    whiteListedCount -= 1;
  }

  function renounceWhitelisted() public {
    if(!isWhitelisted(msg.sender)) return;
    super.renounceWhitelisted();
    whiteListedCount -= 1;
  }
  function whiteListUser(address _account) public {
    addWhitelisted(_account);
  }

  function blackListUser(address _account) public {
    removeWhitelisted(_account);
  }
  
}
