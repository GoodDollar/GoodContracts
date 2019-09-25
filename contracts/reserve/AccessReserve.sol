pragma solidity >=0.4.21 <0.6.0;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "./ValidGasPrice.sol";

contract AccessReserve is Ownable, ERC20, ERC20Detailed, ValidGasPrice {
    using SafeMath for uint;

    uint8 _denomBurn;
    uint8 _denomMint;
    uint8 _numerBurn;
    uint8 _numerMint;

    event AccessTokenMinted(address sender, uint amount);
    event AccessTokenBurned(address sender, uint amount);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint8 denomMint,
        uint8 numerMint,
        uint8 denomBurn,
        uint8 numerBurn
    ) public ERC20Detailed(_name, _symbol, _decimals) {
        _denomBurn = denomBurn;
        _denomMint = denomMint;
        _numerBurn = numerBurn;
        _numerMint = numerMint;
    }

    function accessSupply() public view returns (uint) {
        return totalSupply();
    }

    function _getAccessMint(uint _deposit) internal view returns (uint) {
        return (_deposit.mul(_denomMint)).div(_numerMint);
    }

    function _getAccessBurn(uint _deposit) internal view returns (uint) {
        return (_deposit.mul(_denomBurn)).div(_numerBurn);
    }

    function _accessMint(uint _deposit) internal validGasPrice returns (uint) {
        require(_deposit > 0, "Deposit must be non-zero.");

        uint mintTokens = _getAccessMint(_deposit);
        _mint(msg.sender, mintTokens);
        emit AccessTokenMinted(msg.sender, mintTokens);
        return mintTokens;
    }

    function _accessBurn(uint _deposit) internal validGasPrice returns (uint) {
        require(_deposit > 0, "Amount must be non-zero.");
        uint burnTokens = _getAccessBurn(_deposit);

        require(balanceOf(msg.sender) >= burnTokens, "Insufficient tokens to burn.");
        _burn(msg.sender, burnTokens);
        emit AccessTokenBurned(msg.sender, burnTokens);
        return burnTokens;
    }

}