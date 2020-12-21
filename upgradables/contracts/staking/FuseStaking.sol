// SPDX-License-Identifier: MIT

pragma solidity >=0.6;
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

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

contract FuseStaking is Initializable, OwnableUpgradeable {
	mapping(address => uint256) stakers;
	mapping(address => uint256) validatorsStaked;
	address[] validators;

	IConsensus public consensus;

	IConsensus public consensus2;

	// using SafeMathUpgradeable for uint256;

	/**
	 * @dev initialize
	 */
	function initialize(address _owner, address _consensus) public initializer {
		__Ownable_init_unchained();
		transferOwnership(_owner);
		consensus = IConsensus(_consensus);
	}

	function update() public {
		consensus2 = IConsensus(
			address(0x3014ca10b91cb3D0AD85fEf7A3Cb95BCAc9c0f79)
		);
	}

	// function stake() public payable {
	// 	require(msg.value > 0, "stake must be > 0");
	// 	stakeNextValidator();
	// 	stakers[msg.sender] = stakers[msg.sender].add(msg.value);
	// }

	// function balanceOf(address _owner) public view returns (uint256) {
	// 	return stakers[_owner];
	// }

	// function withdraw() public {
	// 	uint256 toWithdraw = stakers[msg.sender];
	// 	require(toWithdraw > 0, "no stake  to withdraw");
	// 	for (uint256 i = 0; i < validators.length; i++) {
	// 		uint256 cur = consensus.delegatedAmount(
	// 			address(this),
	// 			validators[i]
	// 		);
	// 		if (cur == 0) continue;
	// 		if (cur <= toWithdraw) {
	// 			consensus.withdraw(validators[i], cur);
	// 			toWithdraw = toWithdraw.sub(cur);
	// 		} else {
	// 			consensus.withdraw(validators[i], toWithdraw);
	// 			toWithdraw = 0;
	// 		}
	// 		if (toWithdraw == 0) break;
	// 	}
	// 	msg.sender.transfer(stakers[msg.sender]);
	// }

	// function stakeNextValidator() internal {
	// 	if (validators.length == 0) return;
	// 	uint256 min = validatorsStaked[validators[0]];
	// 	uint256 minIdx = 0;
	// 	for (uint256 i = 1; i < validators.length; i++) {
	// 		uint256 cur = consensus.delegatedAmount(
	// 			address(this),
	// 			validators[i]
	// 		);
	// 		if (cur < min) minIdx = i;
	// 	}
	// 	uint256 balance = payable(address(this)).balance;

	// 	consensus.delegate{ value: balance }(validators[minIdx]);
	// 	validatorsStaked[validators[minIdx]] = validatorsStaked[validators[minIdx]]
	// 		.add(balance);
	// }

	// function addValidator(address _v) public onlyOwner {
	// 	validators.push(_v);
	// }

	// function totalDelegated() public view returns (uint256) {
	// 	uint256 total = 0;
	// 	for (uint256 i = 0; i < validators.length; i++) {
	// 		uint256 cur = consensus.delegatedAmount(
	// 			address(this),
	// 			validators[i]
	// 		);
	// 		total = total.add(cur);
	// 	}
	// 	return total;
	// }

	// function undelegate(address _validator) public onlyOwner {
	// 	uint256 cur = consensus.delegatedAmount(address(this), _validator);
	// 	consensus.withdraw(_validator, cur);
	// }

	// function end() public onlyOwner {
	// 	uint256 total = 0;
	// 	for (uint256 i = 0; i < validators.length; i++) {
	// 		uint256 cur = consensus.delegatedAmount(
	// 			address(this),
	// 			validators[i]
	// 		);
	// 		consensus.withdraw(validators[i], cur);
	// 		total = total.add(cur);
	// 	}
	// 	// msg.sender.transfer(total);
	// }

	function testStake() public payable {
		IConsensus(address(0x3014ca10b91cb3D0AD85fEf7A3Cb95BCAc9c0f79))
			.delegate{ value: msg.value }(
			address(0xcb876A393F05a6677a8a029f1C6D7603B416C0A6)
		);
	}

	function testWithdraw() public {
		IConsensus(address(0x3014ca10b91cb3D0AD85fEf7A3Cb95BCAc9c0f79))
			.withdraw(address(0xcb876A393F05a6677a8a029f1C6D7603B416C0A6), 1);
	}

	function test() public {
		IConsensus(address(0x3014ca10b91cb3D0AD85fEf7A3Cb95BCAc9c0f79))
			.delegatedAmount(
			address(this),
			address(0xcb876A393F05a6677a8a029f1C6D7603B416C0A6)
		);
	}

	function test3() public view returns (address) {
		return address(this);
	}

	receive() external payable {}
}
