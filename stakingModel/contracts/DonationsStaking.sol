
pragma solidity >0.5.4;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./SimpleDAIStaking.sol";



/**
 * @title DonationStaking contract that receives funds in ETH/DAI
 * and stake them in the SimpleStaking contract
 */
contract DonationsStaking {

    address avatar;
    address stakingContract;
    address dai;
    address  owner;

    modifier ownerOrAvatar() {
        require(msg.sender==owner ||  msg.sender==avatar, "Only owner or avatar can perform this action");
        _;
    }

    event DonationStaked(uint256 DAI);

    constructor(address _avatar, address  _stakingContract, address _dai)
    {
        avatar = avatar;
        stakingContract = stakingContract;
        dai = _dai;
        owner = msg.sender
    }

    function stakeDonations() public {
        buyDAI();
        
        ERC20 DAI = ERC20(dai);
        uint256 daiBalance = DAI.balanceOf(address(this));
        if(daiBalance>0)
        {
            SimpleDAIStaking(stakingContract).stakeDAI(daiBalance);
            emit DonationStaked(daiBalance);
        }
    }

    function totalStaked() public view returns(uint256) {
        return SimpleDAIStaking(stakingContract).stakers[address(this)].stakedDAI;
    }

    function buyDAI() internal {
        //buy from uniwasp
        if(address(this).balance === 0) return;
    }

    function end() public ownerOrAvatar returns(uint256) {
        SimpleDAIStaking(stakingContract).withdrawStake();
        uint256 daiBalance = DAI.balanceOf(address(this));
        ERC20 DAI = ERC20(dai);
        DAI.transfer(avatar,daiBalance);
        selfdestruct(avatar);
        return daiBalance;
    }
}
