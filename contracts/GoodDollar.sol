pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./token/ERC827Token.sol";
import "./IMonetaryPolicy.sol";

contract GoodDollar is ERC827Token,ERC20Detailed,ERC20Mintable,ERC20Burnable, Ownable {
  using SafeMath for uint256;

  event PopulatedMarket();
  event TransactionFees(uint256 fee, uint256 burned);

  bool public populatedMarket = false;

  IMonetaryPolicy public reserve;

  mapping (address => uint) public last_claimed;

  modifier canPopulate() {
    require(!populatedMarket,"GoodDollar already initialized");
    _;
  }

  constructor (
    string memory name,
    string memory symbol,
    uint8 decimals,
    address[] memory minters
  ) public
    ERC20Burnable()
    ERC20Mintable()
    ERC20Detailed(name, symbol, decimals)
    ERC20()
  {
    for(uint i = 0;i<minters.length;i++)
      addMinter(minters[i]);
  }

  // Creats initial amount of this coin (GoodDollar) in the market
  // Amount is 100 coins for a start (of the GoodDollar market)
  function initialMove(address _gcm) canPopulate public onlyOwner returns(bool) {
    // amount is 100 * 10^18 as each token seems to be viewed as
    // a wei-like equivalent in the bancor formulas
    
    // should be: uint256 amount = 100*(10**decimals);
    // replace "18" in the number of decimals. 
    //Don't replace in decimals var itself; it is uint8 and wiil cause inaccuracy. Should not change to uint256 also.
    uint256 _decimals = uint256(decimals());
    uint256 amount = 100*(10**_decimals); // ** is math.power

    mint(_gcm, amount);

    populatedMarket = true;
    emit PopulatedMarket();

    return true;
  }

  function setMonetaryPolicy(IMonetaryPolicy _reserve) public onlyOwner
  {
    reserve = _reserve;
  }

    /**
  * @dev Transfer token for a specified address
  * @param to The address to transfer to.
  * @param value The amount to be transferred.
  */
  function transfer(address to, uint256 value) public returns (bool) {
    uint256 newValue = _processTX(msg.sender, to, value);    
    _transfer(msg.sender, to, newValue);
    return true;
  }

  /**
   * @dev Transfer tokens from one address to another
   * @param from address The address which you want to send tokens from
   * @param to address The address which you want to transfer to
   * @param value uint256 the amount of tokens to be transferred
   */
  function transferFrom(
    address from,
    address to,
    uint256 value
  )
    public
    returns (bool)
  {
    require(value <= allowance(from,msg.sender),"value larger than allowance");
    uint256 newValue = _processTX(from, to, value);
    return super.transferFrom(from, to, newValue);
  }

  /**
  * @dev Process transaction for transaction fees and burn fees
   */
  function _processTX(address from, address to, uint256 value) internal returns (uint256) {
    if(address(reserve) == address(0))
      return value;

    (uint256 txFee, uint256 toBurn) = reserve.processTX(from,to,value);
    uint256 totalFees = txFee.add(toBurn);
    _transfer(from, address(reserve), totalFees);
    _burn(address(reserve), toBurn);
    emit TransactionFees(txFee,toBurn);
    return value.sub(totalFees);
  }
  
}