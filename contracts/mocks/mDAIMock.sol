pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../DSMath.sol";

contract mDAIMock is DSMath, ERC20, ERC20Detailed, Ownable {
    ERC20 dai;

    uint256 exchangeRate = uint256(100e20).div(99);

    constructor(ERC20 _dai)
        public
        ERC20()
        ERC20Detailed("DMM DAI", "mDAI", 18)
    {
        dai = _dai;
    }
    function mint(uint256 daiAmount) public returns (uint256) {
        dai.transferFrom(msg.sender, address(this), daiAmount);
        uint mintAmount = rdiv(daiAmount, getCurrentExchangeRate()).div(1e9); //div to reduce precision from RAY 1e27 to 1e18 precision of mDAI
        _mint(
            msg.sender,
            mintAmount
        ); 
        return mintAmount;
    }

    function redeem(uint256 mdaiAmount) public returns (uint256) {
        uint256 daiAmount = rmul(
            mdaiAmount, 
            getCurrentExchangeRate().div(10)
        );
        _burn(msg.sender, mdaiAmount);
        dai.transfer(msg.sender, daiAmount);
        return daiAmount;
    }

    function redeemUnderlying(uint256 daiAmount) public returns (uint256) {
        uint256 mdaiAmount = rdiv(daiAmount, getCurrentExchangeRate()).div(
            1e9
        );
        _burn(msg.sender, mdaiAmount);
        dai.transfer(msg.sender, daiAmount);
        return daiAmount;
    }

    function exchangeRateCurrent() public returns (uint256) {
        exchangeRate += uint256(1e28).div(100);
        return exchangeRate;
    }

    function getCurrentExchangeRate() public view returns (uint256) {
        return exchangeRate;
    }

}