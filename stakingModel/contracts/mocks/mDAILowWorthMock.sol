pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../../../contracts/DSMath.sol";

contract mDAILowWorthMock is DSMath, ERC20, ERC20Detailed, Ownable {
    ERC20 dai;

    uint256 exchangeRate = uint256(100e28).div(99);

    constructor(ERC20 _dai)
        public
        ERC20()
        ERC20Detailed("DMM DAI", "mDAI", 18)
    {
        dai = _dai;
    }
    function mint(uint256 daiAmount) public returns (uint256) {
        dai.transferFrom(msg.sender, address(this), daiAmount);
        
        _mint(
            msg.sender,
            rdiv(daiAmount, exchangeRateStored()).div(1e9)
        ); 
        return 0;
    }

    function redeem(uint256 mdaiAmount) public returns (uint256) {
        uint256 daiAmount = rmul(
            mdaiAmount, 
            exchangeRateStored().div(10)
        );

        _burn(msg.sender, mdaiAmount);
        dai.transfer(msg.sender, daiAmount);
        return 0;
    }

    function redeemUnderlying(uint256 daiAmount) public returns (uint256) {
        uint256 mdaiAmount = rdiv(daiAmount, exchangeRateStored().mul(2)).div(
            1e9
        );
        _burn(msg.sender, mdaiAmount);
        dai.transfer(msg.sender, daiAmount.div(2));
        return 0;
    }

    function exchangeRateCurrent() public returns (uint256) {
        exchangeRate += uint256(1e28).div(100);
        return exchangeRate;
    }

    function exchangeRateStored() public view returns (uint256) {
        return exchangeRate.div(2);
    }

}
