
pragma solidity >=0.6.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/upgrades-core/contracts/Initializable.sol";
import "../Interfaces.sol";

/**
 * @title DonationStaking contract that receives funds in ETH/DAI
 * and stake them in the SimpleStaking contract
 */
contract DonationsStaking is Initializable{

    address payable public avatar;
    Staking public stakingContract;
    cERC20 public DAI;
    address public owner;
    Uniswap public uniswap;
    bool public active;
        
    event DonationStaked(address donator, uint256 DAI);

    modifier ownerOrAvatar() {
        require(msg.sender==owner ||  msg.sender==avatar, "Only owner or avatar can perform this action");
        _;
    }

    modifier onlyAvatar() {
        require(msg.sender==avatar, "Only DAO avatar can perform this action");
        _;
    }

    modifier isActive() {
        require(active);
        _;
    }

    receive()  external  payable {}

    function initialize(address payable _avatar, address  _stakingContract, address _dai) public {
        owner = msg.sender;
        uniswap = Uniswap(address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D));
        DAI = cERC20(_dai);
        avatar = _avatar;
        stakingContract = Staking(_stakingContract);
        DAI.approve(address(stakingContract),0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        active = true;
    }

    function stakeDonations(uint256 _minDAIAmount) public payable isActive {
        _buyDAI(_minDAIAmount);
        
        uint256 daiBalance = DAI.balanceOf(address(this));
        if(daiBalance>0)
        {
            stakingContract.stakeDAI(daiBalance);
            emit DonationStaked(msg.sender, daiBalance);
        }
    }

    function totalStaked() public view returns(uint256) {
        Staking.Staker memory staker = stakingContract.stakers(address(this));
        return staker.stakedDAI;
    }

    function _buyDAI(uint256 _minDAIAmount) internal {
        //buy from uniwasp
        uint256 ethBalance = address(this).balance;
        if(ethBalance == 0) return;
        address[] memory path = new address[](2);
        path[1] = address(DAI);
        path[0] = uniswap.WETH();
        uniswap.swapExactETHForTokens{value:ethBalance}(_minDAIAmount, path, address(this), now);
    }

    function setActive(bool _active) public ownerOrAvatar returns(uint256) {
        active = _active;
    }
    
    function end() public ownerOrAvatar isActive returns(uint256) {
        stakingContract.withdrawStake();
        uint256 daiBalance = DAI.balanceOf(address(this));
        DAI.transfer(avatar,daiBalance);
        avatar.transfer(address(this).balance);
        return daiBalance;
    }

    function getVersion() public view returns(string memory) {
        return "1.0.0";
    }
}
