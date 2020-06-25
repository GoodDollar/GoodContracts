pragma solidity 0.5.4;


/**
 * @title Abstract contract that holds all the data, 
 * events and functions for staking contract.
 * The staking contract will inherit this interface
 */
contract AbstractGoodStaking {

    struct Staker {
        uint256 stakedToken;
        uint256 lastStake;
    }

    mapping(address => Staker) public stakers;

    event Staked(address indexed staker, uint256 value);
    event StakeWithdraw(address indexed staker, uint256 value, uint256 actual);
    event InterestCollected(
        address recipient,
        uint256 intrestTokenValue,
        uint256 tokenValue,
        uint256 tokenPrecisionLoss
    );

    /**
     * @dev stake some tokens
     * @param amount of Tokens to stake
     */
    function stake(uint256 amount) external {
        
    }

    /**
     * @dev withdraw staked tokens
     */
    function withdrawStake() external {
        
    }

    function currentDAIWorth() external view returns (uint256) {

    }

    function currentUBIInterest()
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
    
    }

    /**
     * @dev collect gained interest by fundmanager
     * @param recipient of intrestToken gains
     */
    function collectUBIInterest(address recipient)
        external
        returns (
            uint256,
            uint256,
            uint256,
            uint32
        )
    {
        
    }
}
