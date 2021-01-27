//SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
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

	function initialize(address _identity) public initializer {
		toppingAmount = 1000000 * 1e9; //1M gwei
		gasRefund = 131350 * 1e9; //100K gwei
		perDayRoughLimit = 2 * toppingAmount;
		startTime = now;
		identity = IIdentity(_identity);
	}

	modifier reimburseGas() {
		_;
		msg.sender.transfer(gasRefund);
	}

	receive() external payable {}

	modifier toppingLimit(address _user) {
		setDay();
		require(
			address(_user).balance < toppingAmount / 2,
			"User balance above minimum"
		);

		require(
			toppings[currentDay][_user] < perDayRoughLimit,
			"User wallet has been topped too many times today"
		);

		require(
			identity.isWhitelisted(_user) || notFirstTime[_user] == false,
			"User not whitelisted or not first time"
		);

		uint256 weekTotal = 0;
		for (
			int256 i = int256(currentDay);
			i >= 0 && i > int256(currentDay) - 7;
			i--
		) {
			weekTotal += toppings[uint256(i)][_user];
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
		currentDay = (now - startTime) / 1 days;
	}

	function canTop(address _user) public view returns (bool) {
		uint256 currentDay = (now - startTime) / 1 days;
		bool can =
			address(_user).balance < toppingAmount / 2 &&
				toppings[currentDay][_user] < perDayRoughLimit &&
				(identity.isWhitelisted(_user) || notFirstTime[_user] == false);

		uint256 weekTotal = 0;
		for (
			int256 i = int256(currentDay);
			i >= 0 && i > int256(currentDay) - 7;
			i--
		) {
			weekTotal += toppings[uint256(i)][_user];
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
		toppings[currentDay][_wallet] += toTop;
		notFirstTime[_wallet] = true;
		_wallet.transfer(toTop);
		emit WalletTopped(_wallet, toTop);
	}
}
