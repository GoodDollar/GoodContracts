pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/FeelessScheme.sol";
import "../../contracts/identity/Identity.sol";
import "../../contracts/DSMath.sol";

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
 * allowing stakers to deposit DAI or withdraw their stake in DAI.
 * The contract buys cDAI and can transfer the daily interest to the DAO
 */
contract SimpleDAIStaking is DSMath, Pausable, FeelessScheme {
    using SafeMath for uint256;

    // Entity that holds a staker info
    struct Staker {
        // The staked DAI amount
        uint256 stakedDAI;
        // The latest block number which the
        // staker has staked tokens
        uint256 lastStake;
    }

    // The map which holds the stakers entities
    mapping(address => Staker) public stakers;

    // Emits when new DAI tokens have been staked
    event DAIStaked(
        // The staker address
        address indexed staker,
        // How many tokens have been staked
        uint256 daiValue
    );

    // Emits when DAI tokens are being withdrawn
    event DAIStakeWithdraw(
        // The staker that initiate the action
        address indexed staker,
        // The initial DAI value that was staked
        uint256 daiValue,
        // The current DAI value that was staked
        uint256 daiActual
    );

    // Emits when the interest is collected
    event InterestCollected(
        // Who is receives the interest
        address recipient,
        // How many cDAI tokens have been transferred
        uint256 cdaiValue,
        // The worth of the transferred tokens in DAI
        uint256 daiValue,
        // Lost amount. A result of different precisions
        uint256 daiPrecisionLoss
    );

    // DAI token address
    ERC20 public dai;

    // cDAI token address
    cERC20 public cDai;

    // The block interval defines the number of
    // blocks that shall be passed before the
    // next execution of `collectUBIInterest`
    uint256 public blockInterval;

    // The last block number which
    // `collectUBIInterest` has been executed in
    uint256 public lastUBICollection;

    // The total staked DAI amount in the contract
    uint256 public totalStaked = 0;

    // How much of the generated interest is donated,
    // meaning no GD is expected in compensation, 1 in mil precision.
    // 100% for phase0 POC
    uint32 public avgInterestDonatedRatio = 1e6;

    // The address of the fund manager contract
    address public fundManager;

    modifier onlyFundManager {
        require(msg.sender == fundManager, "Only FundManager can call this method");
        _;
    }

    /**
     * @dev Constructor
     * @param _dai The address of DAI
     * @param _cDai The address of cDAI
     * @param _fundManager The address of the fund manager contract
     * @param _blockInterval How many blocks should be passed before the next execution of `collectUBIInterest`
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract
     */
    constructor(
        address _dai,
        address _cDai,
        address _fundManager,
        uint256 _blockInterval,
        Avatar _avatar,
        Identity _identity
    ) public FeelessScheme(_identity, _avatar) {
        dai = ERC20(_dai);
        cDai = cERC20(_cDai);
        blockInterval = _blockInterval;
        lastUBICollection = block.number.div(blockInterval);
        fundManager = _fundManager;

        // Adds the avatar as a pauser of this contract
        addPauser(address(avatar));
    }

    /**
     * @dev Allows the DAO to change the fund manager contract address
     * @param _fundManager Address of the new contract
     */
    function setFundManager(address _fundManager) public onlyAvatar {
        fundManager = _fundManager;
    }

    /**
     * @dev Allows a staker to deposit DAI tokens. Notice that `approve` is
     * needed to be executed before the execution of this method.
     * Can be executed only when the contract is not paused.
     * @param _amount The amount of DAI to stake
     */
    function stakeDAI(uint256 _amount) public whenNotPaused {
        require(_amount > 0, "You need to stake a positive token amount");
        require(
            dai.allowance(msg.sender, address(this)) >= _amount,
            "You need to approve DAI transfer first"
        );
        require(
            dai.transferFrom(msg.sender, address(this), _amount) == true,
            "transferFrom failed, make sure you approved DAI transfer"
        );

        // approve the transfer to cDAI
        dai.approve(address(cDai), _amount);

        // mint ctokens
        uint256 res = cDai.mint(_amount);

        // cDAI returns >0 if error happened while minting.
        // Makes sure that there are no errors. If an error
        // has occurred, DAI funds shall be returned.
        if (res > 0) {
            require(res == 0, "Minting cDai failed, funds returned");
        }

        // updated the staker entity
        Staker storage staker = stakers[msg.sender];
        staker.stakedDAI = staker.stakedDAI.add(_amount);
        staker.lastStake = block.number;

        // adds the staked amount to the total staked
        totalStaked = totalStaked.add(_amount);

        emit DAIStaked(msg.sender, _amount);
    }

    /**
     * @dev Withdraws the sender staked DAI.
     */
    function withdrawStake() public {
        Staker storage staker = stakers[msg.sender];
        require(staker.stakedDAI > 0, "No DAI staked");
        require(cDai.redeemUnderlying(staker.stakedDAI) == 0, "Failed to redeem cDai");
        uint256 daiWithdraw = staker.stakedDAI;

        // updates balance before transfer to prevent re-entry
        staker.stakedDAI = 0;

        totalStaked = totalStaked.sub(daiWithdraw);

        //redeeming in compound may result in a tiny fraction of precission error
        //so if we redeem 100 DAI we might get something like 99.9999999999
        uint256 daiActual = dai.balanceOf(address(this));
        if (daiActual < daiWithdraw) {
            daiWithdraw = daiActual;
        }
        require(dai.transfer(msg.sender, daiWithdraw), "withdraw transfer failed");
        emit DAIStakeWithdraw(msg.sender, daiWithdraw, daiActual);
    }

    /**
     * @dev Calculates the worth of the staked cDAI tokens in DAI.
     * @return (uint256) The worth in DAI
     */
    function currentDAIWorth() public view returns (uint256) {
        uint256 er = cDai.exchangeRateStored();

        //TODO: why 1e10? cDai is e8 so we should convert it to e28 like exchange rate
        uint256 daiBalance = rmul(cDai.balanceOf(address(this)) * 1e10, er).div(10);
        return daiBalance;
    }

    /**
     * @dev Calculates the current interest that was gained.
     * @return (uint256, uint256, uint256) The interest in cDAI, the interest in DAI,
     * the amount which is not covered by precision of DAI
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
        uint256 er = cDai.exchangeRateStored();
        uint256 daiWorth = currentDAIWorth();
        if (daiWorth <= totalStaked) {
            return (0, 0, 0);
        }
        uint256 daiGains = daiWorth.sub(totalStaked);
        // mul by 1e10 to equalize precision otherwise since exchangerate
        // is very big, dividing by it would result in 0.
        uint256 cdaiGains = rdiv(daiGains * 1e10, er);
        // gets right most bits not covered by precision of cdai which is
        // only 8 decimals while RAY is 27
        uint256 precisionLossCDaiRay = cdaiGains % 1e19;
        // lower back to 8 decimals
        cdaiGains = cdaiGains.div(1e19);
        //div by 1e10 to get results in dai precision 1e18
        uint256 precisionLossDai = rmul(precisionLossCDaiRay, er).div(1e10);
        return (cdaiGains, daiGains, precisionLossDai);
    }

    /**
     * @dev Collects gained interest by fundmanager. Can be collected only once
     * in an interval which is defined above.
     * @param _recipient The recipient of cDAI gains
     * @return (uint256, uint256, uint256, uint32) The interest in cDAI, the interest in DAI,
     * the amount which is not covered by precision of DAI, how much of the generated interest is donated
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
            uint256 cdaiGains,
            uint256 daiGains,
            uint256 precisionLossDai
        ) = currentUBIInterest();
        lastUBICollection = block.number.div(blockInterval);
        if (cdaiGains > 0)
            require(cDai.transfer(_recipient, cdaiGains), "collect transfer failed");
        emit InterestCollected(_recipient, cdaiGains, daiGains, precisionLossDai);
        return (cdaiGains, daiGains, precisionLossDai, avgInterestDonatedRatio);
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
}
