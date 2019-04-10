pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/access/roles/SignerRole.sol";

import "./IMonetaryPolicy.sol";
import "./Identity.sol";

contract GoodDollarReserve is IMonetaryPolicy, Ownable, SignerRole {
  using SafeMath for uint256;
  using SafeMath for uint;

  Identity public identity;

  // Members
  // =======
  // totalSupply(): The GoodDollar (GTC coins) amount the contract supervise (the whole GTC coins ever exists are documented here). Initiated on "InitialMove()"
  // poolBalance(): The ethers (ETH coins) amount the GoodDollarReserve as a contract has in the accounthas. Initiated in the deployment of the contract.

  //1% tx fee as default
  uint public transactionFee = 10000 ;
  uint public burnFee = 0;

  mapping (address => bool) excludedFromPolicy;

  constructor(Identity _identity,address oneTimePaymentLinks) public payable {
    identity = _identity;
    setExcludeFromPolicy(oneTimePaymentLinks, true);
  }

  function setFees(uint _txFee, uint _burnFee) external onlySigner {
    transactionFee = _txFee;
    burnFee = _burnFee;
  }

  function calcFees(uint _value) public view returns (uint txFee, uint burn) {
    txFee = _value.mul(transactionFee).div(1000000);
    burn = _value.mul(burnFee).div(1000000);
  }

  function setExcludeFromPolicy(address to, bool exclude) public onlySigner {
    excludedFromPolicy[to] = exclude;
  }

  function processTX(address _from, address _to, uint256 _value) external returns (uint txFee, uint burn) {
    if(excludedFromPolicy[_from])
      return (0,0);
    //enforce sender is verified
    require(identity.isWhitelisted(_from),"Non verified citizens can't send funds");
    return calcFees(_value);
  }

}
