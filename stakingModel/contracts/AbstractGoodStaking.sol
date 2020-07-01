pragma solidity 0.5.4;


/**
 * @title Abstract contract that holds all the data, 
 * events and functions for staking contract.
 * The staking contract will inherit this interface
 */
contract AbstractGoodStaking {

    /**
     * @dev Structure to store staking details.
     * It contains amount of tokens staked and blocknumber at which last staked.
     */
    struct Staker {
        uint256 stakedToken;
        uint256 lastStake;
    }

    /**
     * @dev Mapping to store staking details for each user.
     */
    mapping(address => Staker) public stakers;

    /**
     * @dev Emitted when `staker` stake `value` tokens of `token`
     */
    event Staked(address indexed staker, address token, uint256 value);

    /**
     * @dev Emitted when `staker` withdraws their stake `value` tokens and contracts balance will 
     * be reduced to`remainingBalance`.
     */
    event StakeWithdraw(address indexed staker, address token, uint256 value, uint256 remainingBalance);

    /**
     * @dev Emitted when fundmanager transfers intrest collected from defi protrocol.
     * `recipient` will receive `intrestTokenValue` as intrest.
     */
    event InterestCollected(
        address recipient,
        address token,
        address intrestToken,
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

    /**
     * @dev calculates the holding of intrestToken by staking contract in terms of token value.
     * @return It will return the token worth of intrest token that contract is holding.
     */
    function currentTokenWorth() external view returns (uint256) {

    }

    /**
     * @dev calculates the tokenGain, intrestTokenGain and precisionLossToken
     * @return Intrest gained on lending the tokens.
     * @return Intrest gained on lending the tokens in terms of token rate.
     * @return Token's precision loss due to decimal difference.
     */
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
     * @return Intrest gained on lending the tokens.
     * @return Intrest gained on lending the tokens in terms of token rate.
     * @return Token's precision loss due to decimal difference.
     * @return average intrest donation ratio.
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

    /**
     * @dev Invests staked tokens to defi protocol.
     * @param amount tokens staked.
     */
    function mint(uint amount) internal {}

    /**
     * @dev Redeem invested tokens from defi protocol.
     * @param amount tokens to be redeemed.
     */
    function redeem(uint amount) internal {}

    /**
     * @dev Calculates exchange rate for token to intrest token from defi protocol.
     * @return exchange rate.
     */
    function exchangeRate() internal view returns(uint) {}

    /**
     * @dev Returns decimal value for token.
     */
    function tokenDecimal() internal view returns(uint) {}

    /**
     * @dev Returns decimal value for intrest token.
     */
    function iTokenDecimal() internal view returns(uint) {}
}