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
    event DAIStakeWithdraw(address indexed staker, uint256 daiValue);
    event InterestDonated(
        uint256 cdaiValue,
        uint256 daiValue,
        uint256 daiPrecisionLoss
    );

    ERC20 dai;
    cERC20 cDai;
    address uniswap;
    uint256 totalStaked = 0;
    uint256 lastUBICollection = now + 1 days;

    modifier onlyFundManager {
        require(msg.sender == owner(), "Only FundManager can call this method");
        _;
    }

    constructor(
        address _dai,
        address _cDai,
        address _uniswap,
        address _fundManager
    ) public SchemeGuard(Avatar(address(0))) {
        dai = ERC20(_dai);
        cDai = cERC20(_cDai);
        uniswap = _uniswap;
        transferOwnership(_fundManager);
    }

    /**
     * @dev stake some DAI
     * @param amount of dai to stake
     */
    function stakeDAI(uint256 amount) public whenNotPaused {
        require(
            dai.allowance(msg.sender, address(this)) >= amount,
            "You need to approve DAI transfer first"
        );
        require(
            dai.transferFrom(msg.sender, address(this), amount) == true,
            "transferFrom failed, make sure you approved DAI transfer"
        ); // approve the transfer
        dai.approve(address(cDai), amount);
        uint256 res = cDai.mint(amount); //mint ctokens

        if (res > 0) //make sure no errors, if error return DAI funds
        {
            dai.transfer(msg.sender, amount);
            require(res == 0, "Minting cDai failed, funds returned");
        }
        Staker storage staker = stakers[msg.sender];
        staker.stakedDAI = staker.stakedDAI + amount;
        staker.lastStake = block.timestamp;
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
        dai.transfer(msg.sender, daiWithdraw);
        emit DAIStakeWithdraw(msg.sender, daiWithdraw);
    }

    function currentDAIWorth() public view returns (uint256) {
        uint256 er = cDai.exchangeRateStored();
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
        uint256 daiGains = rmul(cDai.balanceOf(address(this)) * 1e10, er).div(
            10
        ) -
            totalStaked; //mul by 1e10 to convert cdai precision to dai precision, div to reduce precision from 1e28 of exchange rate to 1e27 that DSMath works on
        uint256 cdaiGains = rdiv(daiGains * 1e10, er); //mul by 1e10 to equalize precision otherwise since exchangerate is very big, dividing by it would result in 0.
        uint256 precisionLossCDaiRay = cdaiGains % 1e19; //get right most bits not covered by precision of cdai which is only 8 decimals while RAY is 27
        cdaiGains = cdaiGains.div(1e19); //lower back to 8 decimals
        uint256 precisionLossDai = rmul(precisionLossCDaiRay, er).div(1e10); //div by 1e10 to get results in dai precision 1e18
        return (cdaiGains, daiGains, precisionLossDai);
    }
    /**
     * @dev collect gained interest by owner(fundmanager)
     */
    function collectUBIInterest()
        public
        onlyFundManager
        returns (uint256, uint256, uint256)
    {
        require(
            block.timestamp.sub(lastUBICollection) > 23 hours,
            "Need to wait at least 23 hours between collections"
        );
        (uint256 cdaiGains, uint256 daiGains, uint256 precisionLossDai) = currentUBIInterest();
        cDai.transfer(msg.sender, cdaiGains);
        lastUBICollection = block.timestamp;
        emit InterestDonated(cdaiGains, daiGains, precisionLossDai);
        return (cdaiGains, daiGains, precisionLossDai);
    }

}
