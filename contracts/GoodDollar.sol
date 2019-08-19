pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./token/ERC677BridgeToken.sol";
import "./IMonetaryPolicy.sol";

contract GoodDollar is ERC677BridgeToken {
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
        ERC677BridgeToken(name, symbol, decimals)
        ERC20Burnable()
        ERC20Mintable()
        ERC20()
    {
        for(uint i = 0;i<minters.length;i++)
        addMinter(minters[i]);
    }

    // Creats initial amount of this coin (GoodDollar) in the market
    // Amount is 100 coins for a start (of the GoodDollar market)
    function initialMove(address _gcm,uint _amount) canPopulate public onlyOwner returns(bool) {
        // amount is 100 * 10^18 as each token seems to be viewed as
        // a wei-like equivalent in the bancor formulas

        // should be: uint256 amount = 100*(10**decimals);
        // replace "18" in the number of decimals.
        //Don't replace in decimals var itself; it is uint8 and wiil cause inaccuracy. Should not change to uint256 also.
        uint256 _decimals = uint256(decimals());
        uint256 amount = _amount*(10**_decimals); // ** is math.power

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
        super.transfer(to, newValue);
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

    function transferAndCall(address _to, uint _value, bytes calldata _data) external returns (bool)
    {
        uint256 newValue = _processTX(msg.sender, _to, _value);
        bool res = _transferAndCall(_to,newValue,_data);
        require(res,"Transfer And Call Failed");
        return res;
        // return ERC677BridgeToken.transferAndCall(_to, newValue, _data);
    }
    /**
    * @dev Process transaction for transaction fees and burn fees
    * @param from TX from
    * @param to TX to
    * @param value TX value
    * @return the TX initial value
    */
    function _processTX(address from, address to, uint256 value) internal returns (uint256) {
        // If the reserve contract does not exists - return the initial value (no fees calculation)
        if(address(reserve) == address(0))  return value;
        // calculate TX fee and Burn Fee
        (uint256 txFee, uint256 toBurn) = reserve.processTX(from,to,value);
        // calculate total fees that need to be payed in addition to the TX value
        uint256 totalFees = txFee.add(toBurn);
        // verify user has sufficient amount to pay also fees
        require(balanceOf(from)>=value.add(totalFees),"Not enough balance to cover TX fees");
        // transfer total fees of the TX to the reverse, for handle
        if(totalFees>0) _transfer(from, address(reserve), totalFees);
        // Tell reserve to burn, out of the total fees, the Burn Fee amount
        if(toBurn>0) _burn(address(reserve), toBurn);
        // publish event to preserve information, how many fees were collected for this TX (i.e. for logging and future usage)
        emit TransactionFees(txFee,toBurn);
        return value;
    }

}