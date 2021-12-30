pragma solidity >=0.6;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

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
		stakers[msg.sender] += msg.value;
	}

	function balanceOf(address _owner) public view returns (uint256) {
		return stakers[_owner];
	}

	function withdraw(uint256 _value) public returns (uint256) {
		uint256 toWithdraw = _value == 0 ? stakers[msg.sender] : _value;
		uint256 toCollect = toWithdraw;
		require(
			toWithdraw > 0 && toWithdraw <= stakers[msg.sender],
			"invalid withdraw amount"
		);
		for (uint256 i = 0; i < validators.length; i++) {
			uint256 cur = consensus.delegatedAmount(
				address(this),
				validators[i]
			);
			if (cur == 0) continue;
			if (cur <= toCollect) {
				consensus.withdraw(validators[i], cur);
				toCollect = toCollect.sub(cur);
			} else {
				undelegateWithCatch(validators[i], toCollect);
				toCollect = 0;
			}
			if (toCollect == 0) break;
		}

		// in case some funds where not withdrawn
		if (toWithdraw > balance()) {
			toWithdraw = balance();
		}

		stakers[msg.sender] = stakers[msg.sender].sub(toWithdraw);
		if (toWithdraw > 0) payable(msg.sender).transfer(toWithdraw);
		return toWithdraw;
	}

	function stakeNextValidator() public {
		require(validators.length > 0, "no approved validators");

		uint256 min = consensus.delegatedAmount(address(this), validators[0]);
		uint256 minIdx = 0;
		for (uint256 i = 1; i < validators.length; i++) {
			uint256 cur = consensus.delegatedAmount(
				address(this),
				validators[i]
			);
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
			uint256 cur = consensus.delegatedAmount(
				address(this),
				validators[i]
			);
			total += cur;
		}
		return total;
	}

	function removeValidator(address _validator) public onlyOwner {
		uint256 delegated = consensus.delegatedAmount(
			address(this),
			_validator
		);
		if (delegated > 0) {
			uint256 prevBalance = balance();
			undelegateWithCatch(_validator, delegated);

			// wasnt withdrawn because validator needs to be taken of active validators
			if (balance() == prevBalance) {
				// pendingValidators.push(_validator);
				return;
			}
		}

		for (uint256 i = 0; i < validators.length; i++) {
			if (validators[i] == _validator) {
				if (i < validators.length - 1)
					validators[i] = validators[validators.length - 1];
				validators.pop();
				break;
			}
		}
	}

	function undelegateWithCatch(address _validator, uint256 _amount)
		internal
		returns (bool)
	{
		try consensus.withdraw(_validator, _amount) {
			return true;
		} catch Error(
			string memory /*reason*/
		) {
			// This is executed in case
			// revert was called inside getData
			// and a reason string was provided.
			return false;
		} catch (
			bytes memory /*lowLevelData*/
		) {
			// This is executed in case revert() was used
			// or there was a failing assertion, division
			// by zero, etc. inside getData.
			return false;
		}
	}

	function balance() internal view returns (uint256) {
		return payable(address(this)).balance;
	}

	receive() external payable {}
}
