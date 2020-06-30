pragma solidity 0.5.4;

import "./SimpleStaking.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";


interface cERC20 {
    function mint(uint256 mintAmount) external returns (uint256);

    function redeemUnderlying(uint256 mintAmount) external returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function balanceOf(address addr) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);
}


/**
 * @title Staking contract that donates earned interest to the DAO
 * allowing stakers to deposit DAI/ETH
 * or withdraw their stake in DAI
 * the contracts buy cDai and can transfer the daily interest to the  DAO
 */
contract GoodCompoundStaking is SimpleStaking {


    /**
     * @dev stake some DAI
     * @param amount of dai to stake
     */
    function mint(uint256 amount) internal {
        
        cERC20 cToken = cERC20(address(iToken));
        uint res = cToken.mint(amount);

        if (
            res > 0
        ) //cDAI returns >0 if error happened while minting. make sure no errors, if error return DAI funds
        {
            require(res == 0, "Minting cDai failed, funds returned");
        }

    }

    function redeem(uint256 amount) internal {
        cERC20 cToken = cERC20(address(iToken));
        require(cToken.redeemUnderlying(amount) == 0, "Failed to redeem cDai");

    }

    function exchangeRate() internal view returns(uint) {
        cERC20 cToken = cERC20(address(iToken));
        return cToken.exchangeRateStored();

    }

    function tokenDecimal() internal view returns(uint) {
        ERC20Detailed token = ERC20Detailed(address(token));
        return uint(token.decimals());
    }

    function iTokenDecimal() internal view returns(uint) {
        ERC20Detailed cToken = ERC20Detailed(address(iToken));
        return uint(cToken.decimals());
    }
}
