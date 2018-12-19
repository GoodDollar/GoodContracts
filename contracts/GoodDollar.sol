pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract GoodDollar is ERC20Detailed,ERC20Mintable,ERC20Burnable,Ownable {
    using SafeMath for uint256;

    event PopulatedMarket();

    bool public populatedMarket = false;

    mapping (address => uint) public last_claimed;

    modifier canPopulate() {
      require(!populatedMarket,"GoodDollar already initialized");
      _;
    }

    constructor (
        string name,
        string symbol,
        uint8 decimals,
        address[] minters
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
      uint256 amount = 100*(10**4); // ** is math.power

      mint(_gcm, amount);

      populatedMarket = true;
      emit PopulatedMarket();

      return true;
    }
  
}