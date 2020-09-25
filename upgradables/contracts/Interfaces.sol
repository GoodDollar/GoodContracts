pragma solidity>=0.6;

pragma experimental ABIEncoderV2;

interface cERC20 {
    function mint(uint256 mintAmount) external returns (uint256);

    function redeemUnderlying(uint256 mintAmount) external returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function balanceOf(address addr) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);

}

interface Staking {
    struct Staker {
        // The staked DAI amount
        uint256 stakedDAI;
        // The latest block number which the
        // staker has staked tokens
        uint256 lastStake;
    }

    function stakeDAI(uint256 amount) external;
    function withdrawStake() external;
    function stakers(address staker) external view returns (Staker memory);
}

interface Uniswap {
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);
    
    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);

    function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);

    function WETH() external pure returns (address);
}
interface Reserve {
    function buy(
        address _buyWith,
        uint256 _tokenAmount,
        uint256 _minReturn
    ) external returns (uint256);
}