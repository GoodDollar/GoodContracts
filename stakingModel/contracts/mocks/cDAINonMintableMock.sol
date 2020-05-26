pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../../../contracts/DSMath.sol";


contract cDAINonMintableMock is DSMath, ERC20, ERC20Detailed, Ownable {
    ERC20 dai;

    uint256 exchangeRate = uint256(100e28).div(99);

    constructor(ERC20 _dai) public ERC20() ERC20Detailed("Compound DAI", "cDAI", 8) {
        dai = _dai;
    }

    function mint(uint256 daiAmount) public returns (uint256) {
        dai.transferFrom(msg.sender, address(this), daiAmount);
        //mul by 1e10 to match to precision of 1e28 of the exchange rate
        _mint(msg.sender, rdiv(daiAmount * 1e10, exchangeRateStored()).div(1e19)); //div to reduce precision from RAY 1e27 to 1e8 precision of cDAI
        return 1;
    }

    function redeem(uint256 cdaiAmount) public returns (uint256) {
        uint256 daiAmount = rmul(
            cdaiAmount * 1e10, //bring cdai 8 decimals to rdai precision
            exchangeRateStored().div(10)
        );
        //div to reduce precision from 1e28 of exchange rate to 1e27 that DSMath works on
        // uint256 daiAmount = cdaiAmount.mul(100).div(99);
        _burn(msg.sender, cdaiAmount);
        dai.transfer(msg.sender, daiAmount);
        return 0;
    }

    function redeemUnderlying(uint256 daiAmount) public returns (uint256) {
        uint256 cdaiAmount = rdiv(daiAmount * 1e10, exchangeRateStored()).div(1e19);
        _burn(msg.sender, cdaiAmount);
        dai.transfer(msg.sender, daiAmount);
        return 0;
    }

    function exchangeRateCurrent() public returns (uint256) {
        exchangeRate += uint256(1e28).div(100);
        return exchangeRate;
    }

    function exchangeRateStored() public view returns (uint256) {
        return exchangeRate;
    }
}
