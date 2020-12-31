// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.6.12;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title Reputation system
 * @dev A DAO has Reputation System which allows peers to rate other peers in order to build trust .
 * A reputation is use to assign influence measure to a DAO'S peers.
 * Reputation is similar to regular tokens but with one crucial difference: It is non-transferable.
 * The Reputation contract maintain a map of address to reputation value.
 * It provides an onlyOwner functions to mint and burn reputation _to (or _from) a specific address.
 */
contract Reputation is OwnableUpgradeable {
	uint8 public decimals; //Number of decimals of the smallest unit
	// Event indicating minting of reputation to an address.
	event Mint(address indexed _to, uint256 _amount);
	// Event indicating burning of reputation for an address.
	event Burn(address indexed _from, uint256 _amount);
	uint256 private constant ZERO_HALF_256 = 0xffffffffffffffffffffffffffffffff;

	/// @dev `Checkpoint` is the structure that attaches a block number to a
	///  given value, the block number attached is the one that last changed the
	///  value
	//Checkpoint is uint256 :
	// bits 0-127 `fromBlock` is the block number that the value was generated from
	// bits 128-255 `value` is the amount of reputation at a specific block number

	// `balances` is the map that tracks the balance of each address, in this
	//  contract when the balance changes the block number that the change
	//  occurred is also included in the map
	mapping(address => uint256[]) public balances;

	// Tracks the history of the `totalSupply` of the reputation
	uint256[] public totalSupplyHistory;

	/// @notice Generates `_amount` reputation that are assigned to `_owner`
	/// @param _user The address that will be assigned the new reputation
	/// @param _amount The quantity of reputation generated
	/// @return True if the reputation are generated correctly
	function mint(address _user, uint256 _amount)
		external
		onlyOwner
		returns (bool)
	{
		uint256 curTotalSupply = totalSupply();
		require(
			curTotalSupply + _amount >= curTotalSupply,
			"total supply overflow"
		); // Check for overflow
		uint256 previousBalanceTo = balanceOf(_user);
		require(
			previousBalanceTo + _amount >= previousBalanceTo,
			"balace overflow"
		); // Check for overflow
		updateValueAtNow(totalSupplyHistory, curTotalSupply + _amount);
		updateValueAtNow(balances[_user], previousBalanceTo + _amount);
		emit Mint(_user, _amount);
		return true;
	}

	/// @notice Burns `_amount` reputation from `_owner`
	/// @param _user The address that will lose the reputation
	/// @param _amount The quantity of reputation to burn
	/// @return True if the reputation are burned correctly
	function burn(address _user, uint256 _amount)
		external
		onlyOwner
		returns (bool)
	{
		uint256 curTotalSupply = totalSupply();
		uint256 amountBurned = _amount;
		uint256 previousBalanceFrom = balanceOf(_user);
		if (previousBalanceFrom < amountBurned) {
			amountBurned = previousBalanceFrom;
		}
		updateValueAtNow(totalSupplyHistory, curTotalSupply - amountBurned);
		updateValueAtNow(balances[_user], previousBalanceFrom - amountBurned);
		emit Burn(_user, amountBurned);
		return true;
	}

	/**
	 * @dev initialize
	 */
	function initialize(address _owner) public initializer {
		decimals = 0;
		__Ownable_init_unchained();
		transferOwnership(_owner);
	}

	/// @dev This function makes it easy to get the total number of reputation
	/// @return The total number of reputation
	function totalSupply() public view returns (uint256) {
		return totalSupplyAt(block.number);
	}

	////////////////
	// Query balance and totalSupply in History
	////////////////
	/**
	 * @dev return the reputation amount of a given owner
	 * @param _owner an address of the owner which we want to get his reputation
	 */
	function balanceOf(address _owner) public view returns (uint256 balance) {
		return balanceOfAt(_owner, block.number);
	}

	/// @dev Queries the balance of `_owner` at a specific `_blockNumber`
	/// @param _owner The address from which the balance will be retrieved
	/// @param _blockNumber The block number when the balance is queried
	/// @return The balance at `_blockNumber`
	function balanceOfAt(address _owner, uint256 _blockNumber)
		public
		view
		virtual
		returns (uint256)
	{
		if (
			(balances[_owner].length == 0) ||
			(uint128(balances[_owner][0]) > _blockNumber)
		) {
			return 0;
			// This will return the expected balance during normal situations
		} else {
			return getValueAt(balances[_owner], _blockNumber);
		}
	}

	/// @notice Total amount of reputation at a specific `_blockNumber`.
	/// @param _blockNumber The block number when the totalSupply is queried
	/// @return The total amount of reputation at `_blockNumber`
	function totalSupplyAt(uint256 _blockNumber)
		public
		view
		virtual
		returns (uint256)
	{
		if (
			(totalSupplyHistory.length == 0) ||
			(uint128(totalSupplyHistory[0]) > _blockNumber)
		) {
			return 0;
			// This will return the expected totalSupply during normal situations
		} else {
			return getValueAt(totalSupplyHistory, _blockNumber);
		}
	}

	////////////////
	// Internal helper functions to query and set a value in a snapshot array
	////////////////
	/// @dev `getValueAt` retrieves the number of reputation at a given block number
	/// @param checkpoints The history of values being queried
	/// @param _block The block number to retrieve the value at
	/// @return The number of reputation being queried
	function getValueAt(uint256[] storage checkpoints, uint256 _block)
		internal
		view
		returns (uint256)
	{
		if (checkpoints.length == 0) {
			return 0;
		}

		// Shortcut for the actual value
		if (_block >= uint128(checkpoints[checkpoints.length - 1])) {
			return checkpoints[checkpoints.length - 1] >> 128;
		}
		if (_block < uint128(checkpoints[0])) {
			return 0;
		}

		// Binary search of the value in the array
		uint256 min = 0;
		uint256 max = checkpoints.length - 1;
		while (max > min) {
			uint256 mid = (max + min + 1) / 2;
			if (uint128(checkpoints[mid]) <= _block) {
				min = mid;
			} else {
				max = mid - 1;
			}
		}
		return checkpoints[min] >> 128;
	}

	/// @dev `updateValueAtNow` used to update the `balances` map and the
	///  `totalSupplyHistory`
	/// @param checkpoints The history of data being updated
	/// @param _value The new number of reputation
	function updateValueAtNow(uint256[] storage checkpoints, uint256 _value)
		internal
	{
		require(uint128(_value) == _value, "reputation overflow"); //check value is in the 128 bits bounderies
		if (
			(checkpoints.length == 0) ||
			(uint128(checkpoints[checkpoints.length - 1]) < block.number)
		) {
			checkpoints.push(uint256(uint128(block.number)) | (_value << 128));
		} else {
			checkpoints[checkpoints.length - 1] = uint256(
				(checkpoints[checkpoints.length - 1] & uint256(ZERO_HALF_256)) |
					(_value << 128)
			);
		}
	}
}
