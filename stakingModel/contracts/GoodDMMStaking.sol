pragma solidity 0.5.4;

import "./SimpleStaking.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";


interface DMMToken {
    function mint(uint amount) external returns (uint);

    function redeem(uint amount) external returns (uint);

    function getCurrentExchangeRate() external view returns (uint);

    function balanceOf(address addr) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);
}


/**
 * @title Staking contract that donates earned interest to the DAO
 * allowing stakers to deposit DAI/ETH
 * or withdraw their stake in DAI
 * the contracts buy mDai and can transfer the daily interest to the  DAO
 */
contract GoodDMMStaking is SimpleStaking {




    constructor(
        address _token,
        address _iToken,
        address _fundManager,
        uint256 _blockInterval,
        Avatar _avatar,
        Identity _identity
    ) public SimpleStaking(_token, _iToken, _fundManager, _blockInterval, _avatar, _identity) {
        
    }

    /**
     * @dev stake some DAI
     * @param _amount of dai to stake
     */
    function mint(uint256 _amount) internal {
        
        DMMToken mToken = DMMToken(address(iToken));
        uint res = mToken.mint(_amount);

        require(res > 0, "Minting mDai failed, funds returned");
        

    }

    function redeem(uint256 _amount) internal {
        DMMToken mToken = DMMToken(address(iToken));
        require(mToken.redeem(_amount) > 0, "Failed to redeem mDai");

    }

    function exchangeRate() internal view returns(uint) {
        DMMToken mToken = DMMToken(address(iToken));
        return mToken.getCurrentExchangeRate();

    }

    function tokenDecimal() internal view returns(uint) {
        ERC20Detailed token = ERC20Detailed(address(token));
        return uint(token.decimals());
    }

    function iTokenDecimal() internal view returns(uint) {
        ERC20Detailed mToken = ERC20Detailed(address(iToken));
        return uint(mToken.decimals());
    }
}
