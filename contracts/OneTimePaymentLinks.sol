pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract OneTimePaymentLinks is Ownable {

  using SafeMath for uint256;

  event PaymentDeposit(address sender, bytes32 hash, uint amount);
  event PaymentWithdraw(address reciever, bytes32 hash, uint amount);

  mapping(bytes32 => uint) public payments;   
  mapping(bytes32 => bool) public hashes;
  ERC20 private token;

  constructor(address _token) public {
    token = ERC20(_token);
  }

  /**
  Deposit funds into a one time link
  @param _from the address of the depositor (used to be compatible with approveandcall)
  @param _hash to unique one time link code hashed (sha3)
  @param _amount the amount payable by the link
  */
  function deposit(address _from, bytes32 _hash, uint _amount) public {
    require(hashes[_hash]==false,"hash already used");        
    require(_amount>0,"amount can't be 0");        
    token.transferFrom(_from,address(this),_amount);
    payments[_hash] = _amount;
    hashes[_hash] = true;
    emit PaymentDeposit(_from,_hash,_amount);
  }

  /**
  withdraw funds from a one time link
  @param _code the code of the one time link that once sha3 matches existing link
  */
  function withdraw(string memory _code) public {
    bytes32 hash = keccak256(abi.encodePacked(_code));
    require(payments[hash]>0,"payment withdrawn already or code incorrect");
    uint amount = payments[hash];
    token.transfer(msg.sender,amount);
    payments[hash] = 0;
    emit PaymentWithdraw(msg.sender,hash,amount);
  }

  function isLinkUsed(bytes32 hash) public view returns (bool) {
    return hashes[hash];
  }


     
}
