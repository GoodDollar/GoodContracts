// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../Interfaces.sol";

/**
 * @title DonationStaking contract that receives funds in ETH/DAI
 * and stake them in the SimpleStaking contract
 */
contract DonationsStaking is Initializable {
	address payable public avatar;
	Staking public stakingContract;
	cERC20 public DAI;
	address public owner;
	Uniswap public uniswap;
	bool public active;
	uint256 public totalETHDonated;
	uint256 public totalDAIDonated;

	event DonationStaked(
		address caller,
		uint256 stakedDAI,
		uint256 ethDonated,
		uint256 daiDonated
	);

	modifier ownerOrAvatar() {
		require(
			msg.sender == owner || msg.sender == avatar,
			"Only owner or avatar can perform this action"
		);
		_;
	}

	modifier onlyAvatar() {
		require(
			msg.sender == avatar,
			"Only DAO avatar can perform this action"
		);
		_;
	}

	modifier isActive() {
		require(active);
		_;
	}

	receive() external payable {}

	function initialize(
		address payable _avatar,
		address _stakingContract,
		address _dai
	) public initializer {
		owner = msg.sender;
		uniswap = Uniswap(address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D));
		DAI = cERC20(_dai);
		avatar = _avatar;
		stakingContract = Staking(_stakingContract);
		DAI.approve(
			address(stakingContract),
			0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
		); //we trust the staking contract
		active = true;
	}

	/**
	 * @dev stake available funds. It
	 * take balance in eth and buy DAI from uniswap then stake outstanding DAI balance.
	 * anyone can call this.
	 * @param _minDAIAmount enforce expected return from uniswap when converting eth balance to DAI
	 */
	function stakeDonations(uint256 _minDAIAmount) public payable isActive {
		uint256 daiDonated = DAI.balanceOf(address(this));
		uint256 ethDonated = _buyDAI(_minDAIAmount);

		uint256 daiBalance = DAI.balanceOf(address(this));
		require(daiBalance > 0, "no DAI to stake");

		stakingContract.stakeDAI(daiBalance);
		totalETHDonated += ethDonated;
		totalDAIDonated += daiDonated;
		emit DonationStaked(msg.sender, daiBalance, ethDonated, daiDonated);
	}

	/**
	 * @dev total DAI value staked
	 * @return DAI value staked
	 */
	function totalStaked() public view returns (uint256) {
		Staking.Staker memory staker = stakingContract.stakers(address(this));
		return staker.stakedDAI;
	}

	/**
	 * @dev internal method to buy DAI from uniswap
	 * @param _minDAIAmount enforce expected return from uniswap when converting eth balance to DAI
	 * @return eth value converted
	 */
	function _buyDAI(uint256 _minDAIAmount) internal returns (uint256) {
		//buy from uniwasp
		uint256 ethBalance = address(this).balance;
		if (ethBalance == 0) return 0;
		address[] memory path = new address[](2);
		path[1] = address(DAI);
		path[0] = uniswap.WETH();
		uniswap.swapExactETHForTokens{ value: ethBalance }(
			_minDAIAmount,
			path,
			address(this),
			block.timestamp
		);
		return ethBalance;
	}

	function setActive(bool _active) public ownerOrAvatar {
		active = _active;
	}

	/**
	 * @dev withdraws all stakes and then transfer all balances to avatar
	 * this can also be called by owner(Foundation) but it is safe as funds are transfered to avatarMock
	 * and only avatar can upgrade this contract logic
	 */
	function end() public ownerOrAvatar returns (uint256, uint256) {
		stakingContract.withdrawStake();
		uint256 daiBalance = DAI.balanceOf(address(this));
		uint256 ethBalance = address(this).balance;
		DAI.transfer(avatar, daiBalance);
		avatar.transfer(ethBalance);
		active = false;
		return (daiBalance, ethBalance);
	}

	function getVersion() public pure returns (string memory) {
		return "1.1.0";
	}
}
