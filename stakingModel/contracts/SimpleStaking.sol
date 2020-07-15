pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/FeelessScheme.sol";
import "../../contracts/identity/Identity.sol";
import "../../contracts/DSMath.sol";
import "./AbstractGoodStaking.sol";

/**
 * @title Staking contract that donates earned interest to the DAO
 * allowing stakers to deposit Tokens
 * or withdraw their stake in Tokens
 * the contracts buy intrest tokens and can transfer the daily interest to the  DAO
 */
contract SimpleStaking is DSMath, Pausable, FeelessScheme, AbstractGoodStaking {
    using SafeMath for uint256;

    // Token address
    ERC20 token;
    // Interest Token address
    ERC20 public iToken;

    // The block interval defines the number of     
    // blocks that shall be passed before the       
    // next execution of `collectUBIInterest`
    uint256 public blockInterval;

    // The last block number which      
    // `collectUBIInterest` has been executed in
    uint256 public lastUBICollection;

    // The total staked Token amount in the contract
    uint256 public totalStaked = 0;

    //how much of the generated interest is donated, meaning no G$ is expected in compensation, 1 in mil precision.
    //100% for phase0 POC
    uint32 public avgInterestDonatedRatio = 1e6;

    // The address of the fund manager contract
    address public fundManager;

    modifier onlyFundManager {
        require(msg.sender == fundManager, "Only FundManager can call this method");
        _;
    }

    /**     
     * @dev Constructor     
     * @param _token The address of Token       
     * @param _iToken The address of Interest Token     
     * @param _fundManager The address of the fund manager contract     
     * @param _blockInterval How many blocks should be passed before the next execution of `collectUBIInterest`     
     * @param _avatar The avatar of the DAO     
     * @param _identity The identity contract       
     */
    constructor(
        address _token,
        address _iToken,
        address _fundManager,
        uint256 _blockInterval,
        Avatar _avatar,
        Identity _identity
    ) public FeelessScheme(_identity, _avatar) {
        token = ERC20(_token);
        iToken = ERC20(_iToken);
        blockInterval = _blockInterval;
        lastUBICollection = block.number.div(blockInterval);
        fundManager = _fundManager;

        // Adds the avatar as a pauser of this contract
        addPauser(address(avatar));
    }

    /**
    * @dev Allow the DAO to change the fund manager contract address
    * @param _fundManager Address of the new contract
    */
    function setFundManager(address _fundManager) public onlyAvatar {
        fundManager = _fundManager;
    }

    /**
     * @dev Allows a staker to deposit Tokens. Notice that `approve` is
     * needed to be executed before the execution of this method.
     * Can be executed only when the contract is not paused.
     * @param _amount The amount of DAI to stake
     */
    function stake(uint256 _amount) external whenNotPaused {
        
        require(_amount > 0, "You need to stake a positive token amount");
        require(
            token.transferFrom(msg.sender, address(this), _amount),
            "transferFrom failed, make sure you approved token transfer"
        );

        // approve the transfer to defi protocol
        token.approve(address(iToken), _amount);
        mint(_amount); //mint iToken

        Staker storage staker = stakers[msg.sender];
        staker.stakedToken = staker.stakedToken.add(_amount);
        staker.lastStake = block.number;
        totalStaked = totalStaked.add(_amount);
        emit Staked(msg.sender, address(token), _amount);
    }

    /**
     * @dev Withdraws the sender staked Token.
     */
    function withdrawStake() external {
        Staker storage staker = stakers[msg.sender];
        require(staker.stakedToken > 0, "No DAI staked");
        uint256 tokenWithdraw = staker.stakedToken;
        redeem(tokenWithdraw);
        uint256 tokenActual = token.balanceOf(address(this));
        if (tokenActual < tokenWithdraw) {
            tokenWithdraw = tokenActual;
        }
        staker.stakedToken = staker.stakedToken.sub(tokenWithdraw); // update balance before transfer to prevent re-entry
        totalStaked = totalStaked.sub(tokenWithdraw);
        require(token.transfer(msg.sender, tokenWithdraw), "withdraw transfer failed");
        emit StakeWithdraw(msg.sender, address(token), tokenWithdraw, token.balanceOf(address(this)));
    }

    /**
     * @dev Calculates the worth of the staked iToken tokens in Token.
     * @return (uint256) The worth in Token
     */
    function currentTokenWorth() public view returns (uint256) {
        uint256 er = exchangeRate();

        (uint decimalDifference, bool caseType) = tokenDecimalPrecision();
        uint256 tokenBalance;
        if(caseType) {
            tokenBalance = rmul(iToken.balanceOf(address(this)).mul(10 ** decimalDifference), er).div(10);
        } else {
            tokenBalance = rmul(iToken.balanceOf(address(this)).div(10 ** decimalDifference), er).div(10);
        }
        return tokenBalance;
    }

    // @dev To find difference in token's decimal and iToken's decimal
    // @return difference in decimals.
    // @return true if token's decimal is more than iToken's
    function tokenDecimalPrecision() internal view returns(uint, bool)
    {

        uint tokenDecimal = tokenDecimal();
        uint iTokenDecimal = iTokenDecimal();
        uint decimalDifference;
        // Need to find easy way to do it.
        if(tokenDecimal > iTokenDecimal)
        {
            decimalDifference = tokenDecimal.sub(iTokenDecimal);
    
        } else {
            decimalDifference = iTokenDecimal.sub(tokenDecimal);
        }
        return (decimalDifference, tokenDecimal > iTokenDecimal);
    }

    /**
     * @dev Calculates the current interest that was gained.
     * @return (uint256, uint256, uint256) The interest in iToken, the interest in Token,
     * the amount which is not covered by precision of Token
     */
    function currentUBIInterest()
        public
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 er = exchangeRate();
        uint256 tokenWorth = currentTokenWorth();
        if (tokenWorth <= totalStaked) {
            return (0, 0, 0);
        }
        uint256 tokenGains = tokenWorth.sub(totalStaked);
        (uint decimalDifference, bool caseType) = tokenDecimalPrecision();
        //mul by `10^decimalDifference` to equalize precision otherwise since exchangerate is very big, dividing by it would result in 0.
        uint256 iTokenGains;
        if(caseType) {
        
            iTokenGains = rdiv(tokenGains.mul(10 ** decimalDifference), er);

        } else {
            iTokenGains = rdiv(tokenGains.div(10 ** decimalDifference), er);
        }
        //get right most bits not covered by precision of iToken.
        uint256 precisionDecimal = uint(27).sub(iTokenDecimal());
        uint256 precisionLossITokenRay = iTokenGains % (10 ** precisionDecimal);
         // lower back to iToken's decimals
        iTokenGains = iTokenGains.div(10 ** precisionDecimal);
        //div by `10^decimalDifference` to get results in dai precision 1e18
        uint256 precisionLossToken;
        if(caseType) {
            precisionLossToken = rmul(precisionLossITokenRay, er).div(10 ** decimalDifference);
        } else {
            precisionLossToken = rmul(precisionLossITokenRay, er).mul(10 ** decimalDifference);
        }
        return (iTokenGains, tokenGains, precisionLossToken);
    }

    /**
     * @dev Collects gained interest by fundmanager. Can be collected only once
     * in an interval which is defined above.
     * @param _recipient The recipient of cDAI gains
     * @return (uint256, uint256, uint256, uint32) The interest in iToken, the interest in Token,
     * the amount which is not covered by precision of Token, how much of the generated interest is donated
     */
    function collectUBIInterest(address _recipient)
        public
        onlyFundManager
        returns (
            uint256,
            uint256,
            uint256,
            uint32
        )
    {
        // otherwise fund manager has to wait for the next interval
        require(_recipient != address(this), "Recipient cannot be the staking contract");

        require(canCollect(), "Need to wait for the next interval");
        (
            uint256 iTokenGains,
            uint256 tokenGains,
            uint256 precisionLossToken
        ) = currentUBIInterest();
        lastUBICollection = block.number.div(blockInterval);
        if (iTokenGains > 0)
            require(iToken.transfer(_recipient, iTokenGains), "collect transfer failed");
        emit InterestCollected(_recipient, address(token), address(iToken), iTokenGains, tokenGains, precisionLossToken);
        return (iTokenGains, tokenGains, precisionLossToken, avgInterestDonatedRatio);
    }

    /**
     * @dev Checks if enough blocks have passed so it would be possible to
     * execute `collectUBIInterest` according to the length of `blockInterval`
     * @return (bool) True if enough blocks have passed
     */
    function canCollect() public view returns (bool) {
        return block.number.div(blockInterval) > lastUBICollection;
    }

    /**
     * @dev Start function. Adds this contract to identity as a feeless scheme.
     * Can only be called if scheme is registered
     */
    function start() public onlyRegistered {
        addRights();
    }

    /**
     * @dev making the contract inactive
     * NOTICE: this could theoretically result in future interest earned in cdai to remain locked
     * but we dont expect any other stakers but us in SimpleDAIStaking
     */
    function end() public onlyAvatar {
        pause();
        removeRights();
    }

    /**
     * @dev method to recover any stuck erc20 tokens (ie  compound COMP)
     * @param _token the ERC20 token to recover
     */
    function recover(ERC20 _token) public onlyAvatar {
        uint256 toWithdraw = _token.balanceOf(address(this));

        // recover left iToken(stakers token) only when all stakes have been withdrawn
        if (address(_token) == address(iToken)) {
            require(
                totalStaked == 0 && paused(),
                "can recover iToken only when stakes have been withdrawn"
            );
        }
        require(_token.transfer(address(avatar), toWithdraw), "recover transfer failed");
    }
}
