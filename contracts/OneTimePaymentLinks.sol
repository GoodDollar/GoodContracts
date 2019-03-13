pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./token/ERC677Receiver.sol";

contract OneTimePaymentLinks is Ownable {

    using SafeMath for uint256;

    event PaymentDeposit(address indexed from, bytes32 hash, uint amount);
    event PaymentCancel(address indexed from, bytes32 hash, uint amount);
    event PaymentWithdraw(address indexed from, address indexed to, bytes32 indexed hash, uint amount);

    mapping(bytes32 => uint) public payments;   
    mapping(bytes32 => bool) public hashes;
    mapping(bytes32 => address) public senders;
    mapping(address => uint) public erc677Deposits;
    ERC20 private token;

    constructor(address _token) public {
        token = ERC20(_token);
    }

    function onTokenTransfer(address _from, uint256 _value, bytes calldata _data) external returns(bool) {
        //make sure its not called by outsiders
        require(msg.sender == address(token));
        erc677Deposits[_from] = _value;
        (bool res,) = address(this).call(_data);
        // (bool res,) = address(this).call(msg.value)(_data);
        return res;        
    }
    /**
    helper function to allow deposits via erc677 transfer and call
     */
    function transferFromDeposit(address _from, uint256 _value) internal returns (bool) {
        if(erc677Deposits[_from]>=_value)
        {
            erc677Deposits[_from] = erc677Deposits[_from].sub(_value);
            return true;
        }
        return false;
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
    if(!transferFromDeposit(_from,_amount))
        token.transferFrom(_from,address(this),_amount);
    payments[_hash] = _amount;
    hashes[_hash] = true;
    senders[_hash] = _from;
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
    emit PaymentWithdraw(senders[hash],msg.sender,hash,amount);
  }

  /**
  cancel one time link by owner
  @param _hash the hash of the link
  */
  function cancel(bytes32 _hash) public {
    require(senders[_hash]==msg.sender,"you are not the owner of the link");
    require(payments[_hash]>0,"payment withdrawn already");
    uint amount = payments[_hash];
    token.transfer(msg.sender,amount);
    payments[_hash] = 0;
    emit PaymentCancel(msg.sender,_hash,amount);
  }

  function isLinkUsed(bytes32 hash) public view returns (bool) {
    return hashes[hash];
  }


     
}
