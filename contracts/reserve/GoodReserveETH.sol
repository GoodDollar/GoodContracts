pragma solidity >=0.4.21 <0.6.0;

import "./GoodReserve.sol";
import "./AccessReserve.sol";

contract GoodReserveETH is GoodReserve, AccessReserve {
    using SafeMath for uint;
    uint internal reserve;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint _initialSupply,
        uint32 _reserveRatio,
        string memory _name2,
        string memory _symbol2,
        uint8 _decimals2,
        uint8 _denomMint,
        uint8 _numerMint,
        uint8 _denomBurn,
        uint8 _numerBurn
    ) public payable GoodReserve(_name, _symbol, _decimals, _initialSupply, _reserveRatio) AccessReserve(_name2, _symbol2, _decimals2, _denomMint, _numerMint, _denomBurn, _numerBurn ) {
        reserve = msg.value;
    }

    function () external payable { mint(); }

    function mint() public payable {
        uint purchaseAmount = msg.value;
        uint mintedTokens = _continuousMint(purchaseAmount);
        _accessMint(mintedTokens);
        reserve = reserve.add(purchaseAmount);
    }

    function burn(uint _amount) public {
        // uint burnTokens = _getAccessBurn(_amount);
        _accessBurn(_amount);
        uint refundAmount = _continuousBurn(_amount);
        reserve = reserve.sub(refundAmount);
        msg.sender.transfer(refundAmount);
    }

    function donate() public payable {
        uint amount = msg.value;
        reserve = reserve.add(amount);
    }

    function reserveBalance() public view returns (uint) {
        return reserve;
    }
}