pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/access/roles/WhitelistedRole.sol";

contract Identity is WhitelistedRole {
    
  uint256 public whiteListedCount = 0;
  mapping (address => string) public addrToDID;
  mapping (bytes32 => address) public didHashToAddress;

  constructor() public {
    addWhitelisted(msg.sender);
  }
  
  function isVerified(
    address _account
  ) public view returns(bool) {
    return isWhitelisted(_account);
  }

  function addWhitelistedWithDID(address account, string memory did) public onlyWhitelistAdmin {
    if(isWhitelisted(account)) return;
    super.addWhitelisted(account);
    whiteListedCount += 1;
    addrToDID[account] = did;
    bytes32 pHash = keccak256(bytes(did));
    didHashToAddress[pHash] = account;
  }

  function transferAccount(address newAccount) public {
    address oldAccount = msg.sender;
    if(!isWhitelisted(oldAccount)) return;
    string memory did = addrToDID[oldAccount];
    bytes32 pHash = keccak256(bytes(did));
    addrToDID[newAccount] = did;
    didHashToAddress[pHash] = newAccount;
    delete addrToDID[oldAccount];
    super._removeWhitelisted(oldAccount);
    super._addWhitelisted(newAccount);
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
    string memory did = addrToDID[account];
    delete addrToDID[account];
    if(bytes(did).length > 0) {
      bytes32 pHash = keccak256(bytes(did));
      delete didHashToAddress[pHash];
    }
  }

  function renounceWhitelisted() public {
    if(!isWhitelisted(msg.sender)) return;
    super.renounceWhitelisted();
    whiteListedCount -= 1;
    string memory did = addrToDID[msg.sender];
    delete addrToDID[msg.sender];
    if(bytes(did).length > 0) {
      bytes32 pHash = keccak256(bytes(did));
      delete didHashToAddress[pHash];
    }
  }
  function whiteListUser(address _account) public {
    addWhitelisted(_account);
  }

  function blackListUser(address _account) public {
    removeWhitelisted(_account);
  }
  
}
