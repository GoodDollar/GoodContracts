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

	function initialize(address _identity) public initializer {
		toppingAmount = 1200000 * 1e9; //1.2M gwei
		perDayRoughLimit = 2 * toppingAmount;
		maxDailyToppings = 3;
		gasPrice = 1e9;
		startTime = block.timestamp;
		identity = IIdentity(_identity);
	}

	modifier reimburseGas() {
		uint256 _gasRefund = gasleft();
		_;
		_gasRefund = _gasRefund - gasleft() + 42000;
		payable(msg.sender).transfer(_gasRefund * gasPrice); //gas price assumed 1e9 = 1gwei
	}

	function upgrade1() public {
		toppingAmount = 1200000 * 1e9; //1M gwei
		perDayRoughLimit = 2 * toppingAmount;
		maxDailyToppings = 3;
		gasPrice = 1e9;
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
			toppings[currentDay][_user] < perDayRoughLimit,
			"User wallet has been topped too many times today"
		);

		require(
			identity.isWhitelisted(_user) || notFirstTime[_user] == false,
			"User not whitelisted or not first time"
		);

		uint256 dayOfWeek = currentDay % 7;
		uint128 weekTotal = 0;
		for (uint256 i = 0; i <= dayOfWeek; i++) {
			weekTotal += wallets[_user].lastWeekToppings[uint256(i)];
		}

		require(
			weekTotal < perDayRoughLimit * 3,
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
			wallets[_user].lastWeekToppings[_currentDay % 7] <
			perDayRoughLimit &&
			(identity.isWhitelisted(_user) || notFirstTime[_user] == false);

		uint128 weekTotal = 0;
		uint256 dayOfWeek = currentDay % 7;
		for (uint256 i = 0; i <= dayOfWeek; i++) {
			weekTotal += wallets[_user].lastWeekToppings[uint256(i)];
		}

		can = can && weekTotal < perDayRoughLimit * 3;
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
		Wallet storage wallet = wallets[_wallet];

		uint256 dayOfWeek = currentDay % 7;
		uint256 dayDiff = (currentDay - wallet.lastDayTopped);
		dayDiff = dayDiff > 7 ? 7 : dayDiff;
		dayDiff = dayDiff > dayOfWeek ? dayOfWeek + 1 : dayDiff;
		for (uint256 day = dayOfWeek + 1 - dayDiff; day <= dayOfWeek; day++) {
			wallet.lastWeekToppings[day] = 0;
		}

		// toppings[currentDay][_wallet] += toTop;
		if (wallet.lastDayTopped == uint128(currentDay))
			wallet.dailyToppingCount += 1;
		else wallet.dailyToppingCount = 1;
		wallet.lastDayTopped = uint128(currentDay);
		wallet.lastWeekToppings[dayOfWeek] += uint128(toTop);

		notFirstTime[_wallet] = true;
		_wallet.transfer(toTop);
		emit WalletTopped(_wallet, toTop);
	}
}
