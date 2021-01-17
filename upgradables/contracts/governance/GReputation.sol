// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/cryptography/MerkleProofUpgradeable.sol";

import "./Reputation.sol";
import "../Interfaces.sol";

/**
 * @title GReputation extends Reputation with delegation and cross blockchain merkle states
 */
contract GReputation is Reputation {
	using SafeMathUpgradeable for uint256;

	string public constant name = "GReputation";

	/// @notice The EIP-712 typehash for the contract's domain
	bytes32 public constant DOMAIN_TYPEHASH =
		keccak256(
			"EIP712Domain(string name,uint256 chainId,address verifyingContract)"
		);

	/// @notice The EIP-712 typehash for the delegation struct used by the contract
	bytes32 public constant DELEGATION_TYPEHASH =
		keccak256("Delegation(address delegate,uint256 nonce,uint256 expiry)");

	/// @notice describe a single blockchain states
	/// @param stateHash the hash with the reputation state
	/// @param hashType the type of hash. currently just 0 = merkle tree root hash
	/// @param totalSupply the totalSupply at the blockchain
	/// @param blockNumber the effective blocknumber
	struct BlockchainState {
		bytes32 stateHash;
		uint256 hashType;
		uint256 totalSupply;
		uint256 blockNumber;
		uint256[5] __reserevedSpace;
	}

	/// @notice A record of states for signing / validating signatures
	mapping(address => uint256) public nonces;

	/// @notice mapping from blockchain id hash to list of states
	mapping(bytes32 => BlockchainState[]) public blockchainStates;

	/// @notice mapping from stateHash to the user balance can be >0 only after supplying state proof
	mapping(bytes32 => mapping(address => uint256)) public stateHashBalances;

	/// @notice list of blockchains having a statehash for easy iteration
	bytes32[] public activeBlockchains;

	/// @notice keep map of user -> delegate
	mapping(address => address) public delegates;

	/// @notice map of user non delegatd + delegated votes to user. this is used for actual voting
	mapping(address => uint256[]) public activeVotes;

	/// @notice An event thats emitted when a delegate account's vote balance changes
	event DelegateVotesChanged(
		address indexed delegate,
		address indexed delegator,
		uint256 previousBalance,
		uint256 newBalance
	);

	/// @notice internal function that overrides Reputation.sol with consideration to delegation
	/// @param _user the address to mint for
	/// @param _amount the amount of rep to mint
	/// @return the actual amount minted
	function _mint(address _user, uint256 _amount)
		internal
		override
		returns (uint256)
	{
		super._mint(_user, _amount);
		address delegator = delegates[_user];
		delegator = delegator != address(0) ? delegator : _user;
		delegates[_user] = delegator;
		uint256 previousVotes = getVotes(delegator);

		_updateDelegateVotes(
			delegator,
			_user,
			previousVotes,
			previousVotes.add(_amount)
		);
		return _amount;
	}

	/// @notice internal function that overrides Reputation.sol with consideration to delegation
	/// @param _user the address to burn from
	/// @param _amount the amount of rep to mint
	/// @return the actual amount burned
	function _burn(address _user, uint256 _amount)
		internal
		override
		returns (uint256)
	{
		uint256 amountBurned = super._burn(_user, _amount);
		address delegator = delegates[_user];
		delegator = delegator != address(0) ? delegator : _user;
		delegates[_user] = delegator;
		uint256 previousVotes = getVotes(delegator);

		_updateDelegateVotes(
			delegator,
			_user,
			previousVotes,
			previousVotes.sub(amountBurned)
		);

		return amountBurned;
	}

	/// @notice sets the state hash of a blockchain, can only be called by owner
	/// @param _id the string name of the blockchain (will be hashed to produce byte32 id)
	/// @param _hash the state hash
	/// @param _totalSupply total supply of reputation on the specific blockchain
	function setBlockchainStateHash(
		string memory _id,
		bytes32 _hash,
		uint256 _totalSupply
	) public onlyOwner {
		bytes32 idHash = keccak256(bytes(_id));

		//dont consider rootState as blockchain,  it is a special state hash
		bool isRootState = idHash == keccak256(bytes("rootState"));
		require(
			!isRootState || super.totalSupplyAt(block.number) == 0,
			"rootState already created"
		);

		uint256 i = 0;
		for (; !isRootState && i < activeBlockchains.length; i++) {
			if (activeBlockchains[i] == idHash) break;
		}

		//if new blockchain
		if (!isRootState && i == activeBlockchains.length) {
			activeBlockchains.push(idHash);
		}

		if (isRootState) {
			updateValueAtNow(totalSupplyHistory, _totalSupply);
		}

		BlockchainState memory state;
		state.stateHash = _hash;
		state.totalSupply = _totalSupply;
		state.blockNumber = block.number;
		blockchainStates[idHash].push(state);
	}

	/// @notice get the number of active votes a user holds after delegation (vs the basic balance of reputation he holds)
	/// @param _user the user to get active votes for
	/// @param _global wether to include reputation from other blockchains
	/// @param _blockNumber get votes state at specific block
	/// @return the number of votes
	function getVotesAt(
		address _user,
		bool _global,
		uint256 _blockNumber
	) public view returns (uint256) {
		uint256 startingBalance = getValueAt(activeVotes[_user], _blockNumber);

		if (_global) {
			for (uint256 i = 0; i < activeBlockchains.length; i++) {
				startingBalance = startingBalance.add(
					getVotesAtBlockchain(
						activeBlockchains[i],
						_user,
						_blockNumber
					)
				);
			}
		}

		return startingBalance;
	}

	/**
	 * @notice returns aggregated active votes in all blockchains and delegated
	 * @param _user the user to get active votes for
	 * @return the number of votes
	 */
	function getVotes(address _user) public view returns (uint256) {
		return getVotesAt(_user, true, block.number);
	}

	/**
	 * @notice returns aggregated active votes in all blockchains and delegated at specific block
	 * @param _user user to get active votes for
	 * @param _blockNumber get votes state at specific block
	 * @return the number of votes
	 */
	function getVotesAt(address _user, uint256 _blockNumber)
		public
		view
		returns (uint256)
	{
		return getVotesAt(_user, true, _blockNumber);
	}

	/**
	 * @notice returns total supply in current blockchain (super.balanceOfAt)
	 * @param _blockNumber get total supply at specific block
	 * @return the totaly supply
	 */
	function totalSupplyLocal(uint256 _blockNumber)
		public
		view
		returns (uint256)
	{
		return super.totalSupplyAt(_blockNumber);
	}

	/**
	 * @notice returns total supply in all blockchain aggregated
	 * @param _blockNumber get total supply at specific block
	 * @return the totaly supply
	 */
	function totalSupplyAt(uint256 _blockNumber)
		public
		view
		override
		returns (uint256)
	{
		uint256 startingSupply = super.totalSupplyAt(_blockNumber);
		for (uint256 i = 0; i < activeBlockchains.length; i++) {
			startingSupply = startingSupply.add(
				totalSupplyAtBlockchain(activeBlockchains[i], _blockNumber)
			);
		}
		return startingSupply;
	}

	/// @notice get the number of active votes a user holds after delegation in specific blockchain
	/// @param _id the keccak hash of the blockchain string id
	/// @param _user the user to get active votes for
	/// @param _blockNumber get votes state at specific block
	/// @return the number of votes
	function getVotesAtBlockchain(
		bytes32 _id,
		address _user,
		uint256 _blockNumber
	) public view returns (uint256) {
		BlockchainState[] storage states = blockchainStates[_id];
		int256 i = int256(states.length);

		if (i == 0) return 0;
		BlockchainState storage state = states[uint256(i - 1)];
		for (i = i - 1; i >= 0; i--) {
			if (state.blockNumber <= _blockNumber) break;
			state = states[uint256(i - 1)];
		}
		if (i < 0) return 0;

		return stateHashBalances[state.stateHash][_user];
	}

	/**
	 * @notice returns total supply in a specific blockchain
	 * @param _blockNumber get total supply at specific block
	 * @return the totaly supply
	 */
	function totalSupplyAtBlockchain(bytes32 _id, uint256 _blockNumber)
		public
		view
		returns (uint256)
	{
		BlockchainState[] storage states = blockchainStates[_id];
		int256 i;
		if (states.length == 0) return 0;
		for (i = int256(states.length - 1); i >= 0; i--) {
			if (states[uint256(i)].blockNumber <= _blockNumber) break;
		}
		if (i < 0) return 0;

		BlockchainState storage state = states[uint256(i)];
		return state.totalSupply;
	}

	/**
	 * @notice prove user balance in a specific blockchain state hash
	 * @dev "rootState" is a special state that can be supplied once, and actually mints reputation on the current blockchain
	 * @param _id the string id of the blockchain we supply proof for
	 * @param _user the user to prove his balance
	 * @param _balance the balance we are prooving
	 * @param _proof array of byte32 with proof data (currently merkle tree path)
	 * @return true if proof is valid
	 */
	function proveBalanceOfAtBlockchain(
		string memory _id,
		address _user,
		uint256 _balance,
		bytes32[] memory _proof
	) public returns (bool) {
		bytes32 idHash = keccak256(bytes(_id));
		require(
			blockchainStates[idHash].length > 0,
			"no state found for given _id"
		);
		bytes32 stateHash =
			blockchainStates[idHash][blockchainStates[idHash].length - 1]
				.stateHash;

		//this is specifically important for rootState that should update real balance only once
		require(
			stateHashBalances[stateHash][_user] == 0,
			"stateHash already proved"
		);

		(, bool isProofValid) =
			_checkMerkleProof(_user, _balance, stateHash, _proof);
		require(isProofValid, "invalid merkle proof");

		//if initiial state then set real balance
		if (idHash == keccak256(bytes("rootState"))) {
			_mint(_user, _balance);
		}

		//if proof is valid then set balances
		stateHashBalances[stateHash][_user] = _balance;
		return true;
	}

	/// @notice returns current delegate of _user
	/// @param _user the delegatee
	/// @return the address of the delegate (can be _user  if no delegate or 0x0 if _user doesnt exists)
	function delegateOf(address _user) public view returns (address) {
		return delegates[_user];
	}

	/// @notice delegate votes to another user
	/// @param _delegate the recipient of votes
	function delegateTo(address _delegate) public {
		return _delegateTo(msg.sender, _delegate);
	}

	/// @notice cancel user delegation
	/// @dev makes user his own delegate
	function undelegate() public {
		return _delegateTo(msg.sender, msg.sender);
	}

	/**
	 * @notice Delegates votes from signatory to `delegate`
	 * @param _delegate The address to delegate votes to
	 * @param _nonce The contract state required to match the signature
	 * @param _expiry The time at which to expire the signature
	 * @param _v The recovery byte of the signature
	 * @param _r Half of the ECDSA signature pair
	 * @param _s Half of the ECDSA signature pair
	 */
	function delegateBySig(
		address _delegate,
		uint256 _nonce,
		uint256 _expiry,
		uint8 _v,
		bytes32 _r,
		bytes32 _s
	) public {
		bytes32 domainSeparator =
			keccak256(
				abi.encode(
					DOMAIN_TYPEHASH,
					keccak256(bytes(name)),
					getChainId(),
					address(this)
				)
			);
		bytes32 structHash =
			keccak256(
				abi.encode(DELEGATION_TYPEHASH, _delegate, _nonce, _expiry)
			);
		bytes32 digest =
			keccak256(
				abi.encodePacked("\x19\x01", domainSeparator, structHash)
			);
		address signatory = ecrecover(digest, _v, _r, _s);
		require(
			signatory != address(0),
			"GReputation::delegateBySig: invalid signature"
		);
		require(
			_nonce == nonces[signatory]++,
			"GReputation::delegateBySig: invalid nonce"
		);
		require(
			now <= _expiry,
			"GReputation::delegateBySig: signature expired"
		);
		return _delegateTo(signatory, _delegate);
	}

	/// @notice internal function to delegate votes to another user
	/// @param _user the source of votes (delegator)
	/// @param _delegate the recipient of votes
	function _delegateTo(address _user, address _delegate) internal {
		require(
			_delegate != address(0),
			"GReputation::delegate can't delegat to null address"
		);

		address curDelegator = delegates[_user];
		require(curDelegator != _delegate, "already delegating to delegator");

		delegates[_user] = _delegate;

		// remove votes from current delegator
		uint256 coreBalance = balanceOf(_user);
		//redundant check - should not be possible to have address 0 as delegator
		if (curDelegator != address(0)) {
			uint256 curVotes = getVotesAt(curDelegator, false, block.number);
			_updateDelegateVotes(
				curDelegator,
				_user,
				curVotes,
				curVotes.sub(coreBalance)
			);
		}

		//move votes to new delegator
		uint256 curVotes = getVotesAt(_delegate, false, block.number);
		_updateDelegateVotes(
			_delegate,
			_user,
			curVotes,
			curVotes.add(coreBalance)
		);
	}

	/// @notice internal function to update delegated votes, emits event with changes
	/// @param _delegate the delegate whose record we are updating
	/// @param _delegator the delegator
	/// @param _oldVotes the delegate previous votes
	/// @param _newVotes the delegate votes after the change
	function _updateDelegateVotes(
		address _delegate,
		address _delegator,
		uint256 _oldVotes,
		uint256 _newVotes
	) internal {
		updateValueAtNow(activeVotes[_delegate], _newVotes);
		emit DelegateVotesChanged(_delegate, _delegator, _oldVotes, _newVotes);
	}

	/// @notice helper function to check merkle proof using openzeppelin
	/// @return leafHash isProofValid tuple (byte32, bool) with the hash of the leaf data we prove and true if proof is valid
	function _checkMerkleProof(
		address _user,
		uint256 _balance,
		bytes32 _root,
		bytes32[] memory _proof
	) internal pure returns (bytes32 leafHash, bool isProofValid) {
		leafHash = keccak256(abi.encode(_user, _balance));
		isProofValid = MerkleProofUpgradeable.verify(_proof, _root, leafHash);
	}

	/// @notice helper function to get current chain id
	/// @return chain id
	function getChainId() internal pure returns (uint256) {
		uint256 chainId;
		assembly {
			chainId := chainid()
		}
		return chainId;
	}
}
