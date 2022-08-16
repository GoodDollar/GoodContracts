//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../Interfaces.sol";

/**
 * @title DonationStaking contract that receives funds in ETH/DAI
 * and stake them in the SimpleStaking contract
 */
contract FuseFaucet is Initializable {
	event WalletTopped(address indexed user, uint256 amount);

	uint256 public perDayRoughLimit;
	uint256 public toppingAmount;
	uint256 public gasRefund;
	uint256 public startTime;
	uint256 public currentDay;

	IIdentity public identity;

	mapping(uint256 => mapping(address => uint256)) public toppings;
	mapping(address => bool) public notFirstTime;

	struct Wallet {
		uint128 lastDayTopped;
		uint32 dailyToppingCount;
		uint128[7] lastWeekToppings;
	}

	mapping(address => Wallet) public wallets;
	uint32 public maxDailyToppings;
	uint32 public gasPrice;
	uint32 public maxPerWeekMultiplier;
	uint32 public maxSwapAmount;
	address public goodDollar;

	function initialize(address _identity) public initializer {
		toppingAmount = 600000 * 1e9; //0.6M gwei
		perDayRoughLimit = 2 * toppingAmount;
		maxDailyToppings = 3;
		gasPrice = 1e9;
		startTime = block.timestamp;
		identity = IIdentity(_identity);
		maxPerWeekMultiplier = 2;
		maxSwapAmount = 1000;
	}

	modifier reimburseGas() {
		uint256 _gasRefund = gasleft();
		_;
		_gasRefund = _gasRefund - gasleft() + 42000;
		payable(msg.sender).transfer(_gasRefund * gasPrice); //gas price assumed 1e9 = 1gwei
	}

	function upgrade1() public {
		toppingAmount = 600000 * 1e9; //1M gwei
		perDayRoughLimit = 2 * toppingAmount;
		maxDailyToppings = 3;
		gasPrice = 1e9;
		maxPerWeekMultiplier = 2;
		maxSwapAmount = 1000;
		goodDollar = address(0x495d133B938596C9984d462F007B676bDc57eCEC);
		cERC20(goodDollar).approve(
			address(0xE3F85aAd0c8DD7337427B9dF5d0fB741d65EEEB5),
			type(uint256).max
		); //voltage swap
	}

	receive() external payable {}

	modifier toppingLimit(address _user) {
		setDay();
		require(
			wallets[_user].lastDayTopped != uint128(currentDay) ||
				wallets[_user].dailyToppingCount < maxDailyToppings,
			"max daily toppings"
		);

		require(
			identity.isWhitelisted(_user) || notFirstTime[_user] == false,
			"User not whitelisted or not first time"
		);

		//reset inactive days
		uint256 dayOfWeek = currentDay % 7;
		uint256 dayDiff = (currentDay - wallets[_user].lastDayTopped);
		dayDiff = dayDiff > 7 ? 7 : dayDiff;
		dayDiff = dayDiff > dayOfWeek ? dayOfWeek + 1 : dayDiff;
		for (uint256 day = dayOfWeek + 1 - dayDiff; day <= dayOfWeek; day++) {
			wallets[_user].lastWeekToppings[day] = 0;
		}

		uint128 weekTotal = 0;
		for (uint256 i = 0; i <= dayOfWeek; i++) {
			weekTotal += wallets[_user].lastWeekToppings[uint256(i)];
		}

		require(
			weekTotal < perDayRoughLimit * maxPerWeekMultiplier,
			"User wallet has been topped too many times this week"
		);
		_;
	}

	/* @dev Internal function that sets current day
	 */
	function setDay() internal {
		currentDay = (block.timestamp - startTime) / 1 days;
	}

	function canTop(address _user) public view returns (bool) {
		uint256 _currentDay = (block.timestamp - startTime) / 1 days;
		bool can = (wallets[_user].lastDayTopped != uint128(currentDay) ||
			wallets[_user].dailyToppingCount < 3) &&
			(identity.isWhitelisted(_user) || notFirstTime[_user] == false);

		uint128 weekTotal = 0;
		uint256 dayOfWeek = currentDay % 7;
		for (uint256 i = 0; i <= dayOfWeek; i++) {
			weekTotal += wallets[_user].lastWeekToppings[uint256(i)];
		}

		can = can && weekTotal < perDayRoughLimit * maxPerWeekMultiplier;
		return can;
	}

	/* @dev Function to top given address with amount of G$ given in constructor
	 * can only be done by admin the amount of times specified in constructor per day
	 * @param _user The address to transfer to
	 */
	function topWallet(address payable _user)
		public
		reimburseGas
		toppingLimit(_user)
	{
		_topWallet(_user);
	}

	function _topWallet(address payable _wallet) internal {
		require(toppingAmount > address(_wallet).balance);
		uint256 toTop = toppingAmount - address(_wallet).balance;

		uint256 dayOfWeek = currentDay % 7;

		if (wallets[_wallet].lastDayTopped == uint128(currentDay))
			wallets[_wallet].dailyToppingCount += 1;
		else wallets[_wallet].dailyToppingCount = 1;
		wallets[_wallet].lastDayTopped = uint128(currentDay);
		wallets[_wallet].lastWeekToppings[dayOfWeek] += uint128(toTop);

		notFirstTime[_wallet] = true;
		_wallet.transfer(toTop);
		emit WalletTopped(_wallet, toTop);
	}

	function onTokenTransfer(
		address payable _from,
		uint256 amount,
		bytes calldata
	) external returns (bool) {
		require(msg.sender == address(goodDollar), "not G$");
		require(amount <= maxSwapAmount, "slippage");
		Uniswap uniswap = Uniswap(0xE3F85aAd0c8DD7337427B9dF5d0fB741d65EEEB5);
		address[] memory path = new address[](2);
		path[0] = address(msg.sender);
		path[1] = uniswap.WETH();
		uniswap.swapExactTokensForETH(amount, 0, path, _from, block.timestamp);
		return true;
	}
}
