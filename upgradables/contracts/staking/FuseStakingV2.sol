pragma solidity >=0.6;
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

// SPDX-License-Identifier: MIT

interface IConsensus {
	/**
	 * @dev delegate to a validator
	 * @param _validator the address of the validator msg.sender is delegating to
	 */
	function delegate(address _validator) external payable;

	/**
	 * @dev Function to be called when a delegator whishes to withdraw some of his staked funds for a validator
	 * @param _validator the address of the validator msg.sender has delegating to
	 * @param _amount the amount msg.sender wishes to withdraw from the contract
	 */
	function withdraw(address _validator, uint256 _amount) external;

	function delegatedAmount(address _address, address _validator)
		external
		view
		returns (uint256);

	function stakeAmount(address _address) external view returns (uint256);
}

contract FuseStakingV2 is Initializable, OwnableUpgradeable {
	using SafeMathUpgradeable for uint256;

	mapping(address => uint256) public stakers;
	address[] public validators;

	IConsensus public consensus;

	/**
	 * @dev initialize
	 */
	function initialize() public initializer {
		__Ownable_init_unchained();
		consensus = IConsensus(
			address(0x3014ca10b91cb3D0AD85fEf7A3Cb95BCAc9c0f79)
		);
		validators.push(address(0xcb876A393F05a6677a8a029f1C6D7603B416C0A6));
	}

	function stake() public payable {
		require(msg.value > 0, "stake must be > 0");
		stakeNextValidator();
		stakers[msg.sender] = stakers[msg.sender].add(msg.value);
	}

	function balanceOf(address _owner) public view returns (uint256) {
		return stakers[_owner];
	}

	function withdraw() public {
		uint256 orgAmount = stakers[msg.sender];
		uint256 toWithdraw = orgAmount - payable(address(this)).balance;
		require(orgAmount > 0, "no stake  to withdraw");
		for (uint256 i = 0; i < validators.length; i++) {
			uint256 cur =
				consensus.delegatedAmount(address(this), validators[i]);
			if (cur == 0) continue;
			if (cur <= toWithdraw) {
				consensus.withdraw(validators[i], cur);
				toWithdraw = toWithdraw.sub(cur);
			} else {
				consensus.withdraw(validators[i], toWithdraw);
				toWithdraw = 0;
			}
			if (toWithdraw == 0) break;
		}
		msg.sender.transfer(orgAmount);
	}

	function stakeNextValidator() public {
		if (validators.length == 0) return;
		uint256 min = consensus.delegatedAmount(address(this), validators[0]);
		uint256 minIdx = 0;
		for (uint256 i = 1; i < validators.length; i++) {
			uint256 cur =
				consensus.delegatedAmount(address(this), validators[i]);
			if (cur < min) minIdx = i;
		}
		uint256 balance = payable(address(this)).balance;

		consensus.delegate{ value: balance }(validators[minIdx]);
	}

	function addValidator(address _v) public onlyOwner {
		validators.push(_v);
	}

	function totalDelegated() public view returns (uint256) {
		uint256 total = 0;
		for (uint256 i = 0; i < validators.length; i++) {
			uint256 cur =
				consensus.delegatedAmount(address(this), validators[i]);
			total = total.add(cur);
		}
		return total;
	}

	function removeValidator(address _validator) public onlyOwner {
		for (uint256 i = 0; i < validators.length; i++) {
			if (validators[i] == _validator) {
				uint256 cur =
					consensus.delegatedAmount(address(this), _validator);
				consensus.withdraw(_validator, cur);
				if (i < validators.length - 1)
					validators[i] = validators[validators.length - 1];
				validators.pop();
			}
		}
	}

	receive() external payable {}
}
