pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/SchemeGuard.sol";
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
* allowing stakers to deposit DAI/ETH
* or withdraw their stake in DAI
* the contracts buy cDai and can transfer the daily interest to the owner (DAO)
*/
contract SimpleDAIStaking is DSMath, Pausable, SchemeGuard {
    using SafeMath for uint256;

    struct Staker {
        uint256 stakedDAI;
        uint256 lastStake;
    }

    mapping(address => Staker) public stakers;

    event DAIStaked(address indexed staker, uint256 daiValue);
    event DAIStakeWithdraw(address indexed staker, uint256 daiValue, uint256 daiActual);
    event InterestDonated(
        address recipient,
        uint256 cdaiValue,
        uint256 daiValue,
        uint256 daiPrecisionLoss
    );

    ERC20 dai;
    cERC20 cDai;
    address uniswap;
    uint256 public blockInterval;
    uint256 lastUBICollection;
    uint256 public totalStaked = 0;

    modifier onlyFundManager {
        require(msg.sender == owner(), "Only FundManager can call this method");
        _;
    }

    constructor(
        address _dai,
        address _cDai,
        address _uniswap,
        address _fundManager,
        uint256 _blockInterval

    ) public SchemeGuard(Avatar(address(0))) {
        dai = ERC20(_dai);
        cDai = cERC20(_cDai);
        uniswap = _uniswap;
        blockInterval = _blockInterval;
        lastUBICollection = block.number;
        transferOwnership(_fundManager);
    }

    /**
     * @dev stake some DAI
     * @param amount of dai to stake
     */
    function stakeDAI(uint256 amount) public whenNotPaused {
        require(
            amount > 0,
            "You need to stake a positive token amount"
        );
        require(
            dai.allowance(msg.sender, address(this)) >= amount,
            "You need to approve DAI transfer first"
        );
        require(
            dai.transferFrom(msg.sender, address(this), amount) == true,
            "transferFrom failed, make sure you approved DAI transfer"
        );

        // approve the transfer to compound dai
        dai.approve(address(cDai), amount);
        uint256 res = cDai.mint(amount); //mint ctokens

        if (
            res > 0
        ) //cDAI returns >0 if error happened while minting. make sure no errors, if error return DAI funds
        {
            require(res == 0, "Minting cDai failed, funds returned");
        }
        Staker storage staker = stakers[msg.sender];
        staker.stakedDAI = staker.stakedDAI + amount;
        staker.lastStake = block.number;
        totalStaked += amount;
        emit DAIStaked(msg.sender, amount);
    }

    /**
     * @dev withdraw all staked DAI
     */
    function withdrawStake() public {
        Staker storage staker = stakers[msg.sender];
        require(staker.stakedDAI > 0, "No DAI staked");
        require(
            cDai.redeemUnderlying(staker.stakedDAI) == 0,
            "Failed to redeem cDai"
        );
        uint256 daiWithdraw = staker.stakedDAI;
        staker.stakedDAI = 0; // update balance before transfer to prevent re-entry
        totalStaked -= daiWithdraw;
        uint256 daiActual = dai.balanceOf(address(this));
        if (daiActual < daiWithdraw) {
            daiWithdraw = daiActual;
        }
        //TODO: handle transfer failure
        dai.transfer(msg.sender, daiWithdraw);
        emit DAIStakeWithdraw(msg.sender, daiWithdraw, daiActual);
    }

    function currentDAIWorth() public view returns (uint256) {
        uint256 er = cDai.exchangeRateStored();

        //TODO: why 1e10? cDai is e8 so we should convert it to e28 like exchange rate
        uint256 daiBalance = rmul(cDai.balanceOf(address(this)) * 1e10, er).div(
            10
        );
        return daiBalance;
    }

    function currentUBIInterest()
        public
        view
        returns (uint256, uint256, uint256)
    {
        uint256 er = cDai.exchangeRateStored();
        uint256 daiWorth = currentDAIWorth();
        if (daiWorth < totalStaked) {
            return (0, 0, 0);
        }
        uint256 daiGains = daiWorth.sub(totalStaked);
        uint256 cdaiGains = rdiv(daiGains * 1e10, er); //mul by 1e10 to equalize precision otherwise since exchangerate is very big, dividing by it would result in 0.
        uint256 precisionLossCDaiRay = cdaiGains % 1e19; //get right most bits not covered by precision of cdai which is only 8 decimals while RAY is 27
        if (cdaiGains > 0) { // dividing 0 returns unexpected result
            cdaiGains = cdaiGains.div(1e19); //lower back to 8 decimals
        }
        uint256 precisionLossDai = rmul(precisionLossCDaiRay, er).div(1e10); //div by 1e10 to get results in dai precision 1e18
        return (cdaiGains, daiGains, precisionLossDai);
    }

    /**
     * @dev collect gained interest by owner(fundmanager)
     * @param recipient of cDAI gains
     */
    function collectUBIInterest(address recipient)
        public
        onlyFundManager
        returns (uint256, uint256, uint256)
    {
        require(
            recipient != address(this),
            "Recipient cannot be the staking contract"
        ); // otherwise fund manager has to wait for the next interval

        require(
            block.number.sub(lastUBICollection) > blockInterval,
            "Need to wait for the next interval"
        );

        (uint256 cdaiGains, uint256 daiGains, uint256 precisionLossDai) = currentUBIInterest();
        cDai.transfer(recipient, cdaiGains);
        lastUBICollection = block.number;
        emit InterestDonated(recipient, cdaiGains, daiGains, precisionLossDai);
        return (cdaiGains, daiGains, precisionLossDai);
    }

}
