// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "../Interfaces.sol";

/**
 * @title InvitesV1 contract that handles invites with pre allocated bounty pool
 * 1.1 adds invitee bonus
 */
contract InvitesV1 is Initializable {
	using SafeMathUpgradeable for uint256;

	struct Stats {
		uint256 totalApprovedInvites;
		uint256 totalBountiesPaid;
		uint256 totalInvited;
		uint256[5] __reserevedSpace;
	}

	struct User {
		address invitedBy;
		bytes32 inviteCode;
		bool bountyPaid;
		address[] invitees;
		address[] pending;
		uint256 level;
		uint256 levelStarted;
		uint256 totalApprovedInvites;
		uint256 totalEarned;
		uint256 joinedAt;
		uint256[5] __reserevedSpace;
	}

	struct Level {
		uint256 toNext;
		uint256 bounty; //in G$ cents ie 2 decimals
		uint256 daysToComplete;
		uint256[5] __reserevedSpace;
	}

	mapping(bytes32 => address) public codeToUser;
	mapping(address => User) public users;
	address payable public avatar;

	mapping(uint256 => Level) public levels;

	address public owner;
	IIdentity public identity;
	cERC20 public goodDollar;
	bool public active;
	Stats public stats;

	bool public levelExpirationEnabled;

	event InviteeJoined(address indexed inviter, address indexed invitee);
	event InviterBounty(
		address indexed inviter,
		address indexed invitee,
		uint256 bountyPaid,
		uint256 inviterLevel,
		bool earnedLevel
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

	function initialize(
		address payable _avatar,
		address _identity,
		address _gd,
		uint256 level0Bounty
	) public initializer {
		owner = msg.sender;
		identity = IIdentity(_identity);
		active = true;
		Level storage lvl = levels[0];
		lvl.bounty = level0Bounty;
		goodDollar = cERC20(_gd);
		avatar = _avatar;
		levelExpirationEnabled = false;
	}

	function setLevelExpirationEnabled(bool _isEnabled) public ownerOrAvatar {
		levelExpirationEnabled = _isEnabled;
	}

	function join(bytes32 _myCode, bytes32 _inviterCode) public isActive {
		User storage user = users[msg.sender];
		require(
			codeToUser[_myCode] == address(0) ||
				codeToUser[_myCode] == msg.sender,
			"invite code already in use"
		);
		address inviter = codeToUser[_inviterCode];
		//allow user to set inviter if doesnt have one
		require(
			user.inviteCode == 0x0 ||
				(user.invitedBy == address(0) && inviter != address(0)),
			"user already joined"
		);
		if (user.inviteCode == 0x0) {
			user.inviteCode = _myCode;
			user.levelStarted = block.timestamp;
			user.joinedAt = block.timestamp;
			codeToUser[_myCode] = msg.sender;
		}
		if (inviter != address(0)) {
			user.invitedBy = inviter;
			User storage inviterUser = users[inviter];
			inviterUser.invitees.push(msg.sender);
			inviterUser.pending.push(msg.sender);
			stats.totalInvited += 1;
		}
		emit InviteeJoined(inviter, msg.sender);
	}

	function canCollectBountyFor(address _invitee) public view returns (bool) {
		User storage user = users[_invitee];
		User storage inviter = users[user.invitedBy];
		uint256 daysToComplete = levels[inviter.level].daysToComplete;
		bool isLevelExpired = levelExpirationEnabled == true &&
			daysToComplete > 0 &&
			daysToComplete <
			user.joinedAt.sub(inviter.levelStarted).div(1 days);

		return
			!user.bountyPaid &&
			user.invitedBy != address(0) &&
			identity.isWhitelisted(_invitee) &&
			identity.isWhitelisted(user.invitedBy) &&
			isLevelExpired == false;
	}

	function getInvitees(address _inviter)
		public
		view
		returns (address[] memory)
	{
		return users[_inviter].invitees;
	}

	function getPendingInvitees(address _inviter)
		public
		view
		returns (address[] memory)
	{
		address[] memory pending = users[_inviter].pending;
		uint256 cur = 0;
		uint256 total = 0;
		for (uint256 i; i < pending.length; i++) {
			if (!users[pending[i]].bountyPaid) {
				total++;
			}
		}

		address[] memory result = new address[](total);

		for (uint256 i; i < pending.length; i++) {
			if (!users[pending[i]].bountyPaid) {
				result[cur] = pending[i];
				cur++;
			}
		}

		return result;
	}

	function getPendingBounties(address _inviter)
		public
		view
		returns (uint256)
	{
		address[] memory pending = users[_inviter].pending;
		uint256 total = 0;
		for (uint256 i; i < pending.length; i++) {
			if (canCollectBountyFor(pending[i])) {
				total++;
			}
		}
		return total;
	}

	/**
	 * @dev  pay bounty for the inviter of _invitee
	 * invitee need to be whitelisted
	 */
	function bountyFor(address _invitee) public isActive {
		require(
			canCollectBountyFor(_invitee),
			"user not elligble for bounty yet"
		);
		return _bountyFor(_invitee);
	}

	function _bountyFor(address _invitee) internal {
		address invitedBy = users[_invitee].invitedBy;
		uint256 joinedAt = users[_invitee].joinedAt;
		Level memory level = levels[users[invitedBy].level];

		bool isLevelExpired = level.daysToComplete > 0 &&
			joinedAt > users[invitedBy].levelStarted && //prevent overflow in subtraction
			level.daysToComplete <
			joinedAt.sub(users[invitedBy].levelStarted).div(1 days); //how long after level started did invitee join

		users[_invitee].bountyPaid = true;
		users[invitedBy].totalApprovedInvites += 1;
		users[invitedBy].totalEarned += level.bounty;
		stats.totalApprovedInvites += 1;
		stats.totalBountiesPaid += level.bounty;

		bool earnedLevel = false;
		if (
			level.toNext > 0 &&
			users[invitedBy].totalApprovedInvites >= level.toNext &&
			isLevelExpired == false
		) {
			users[invitedBy].level += 1;
			users[invitedBy].levelStarted = block.timestamp;
			earnedLevel = true;
		}

		goodDollar.transfer(invitedBy, level.bounty);
		goodDollar.transfer(_invitee, level.bounty.div(2)); //pay invitee half the bounty

		emit InviterBounty(
			invitedBy,
			_invitee,
			level.bounty,
			users[invitedBy].level,
			earnedLevel
		);
	}

	/**
     @dev collect bounties for invitees by msg.sender that are now whitelisted
     */
	function collectBounties() public isActive {
		User storage inviter = users[msg.sender];

		for (uint256 i = 0; i < inviter.pending.length; ) {
			// if (gasleft() < 340000) return;
			address pending = inviter.pending[i];
			if (canCollectBountyFor(pending)) {
				_bountyFor(pending);
			}
			if (users[pending].bountyPaid) {
				//if still elements in array move last item to current position
				if (inviter.pending.length - 1 > i) {
					inviter.pending[i] = inviter.pending[
						inviter.pending.length - 1
					];
				}

				//extract item from pendig array
				inviter.pending.pop();
				//force loop to do current position again so we dont miss the just moved last item
				continue;
			}
			i++;
		}
	}

	function setLevel(
		uint256 _lvl,
		uint256 _toNext,
		uint256 _bounty,
		uint256 _daysToComplete
	) public ownerOrAvatar {
		Level storage lvl = levels[_lvl];
		lvl.toNext = _toNext;
		lvl.daysToComplete = _daysToComplete;
		lvl.bounty = _bounty;
	}

	function setActive(bool _active) public ownerOrAvatar {
		active = _active;
	}

	function end() public ownerOrAvatar isActive {
		uint256 gdBalance = goodDollar.balanceOf(address(this));
		goodDollar.transfer(avatar, gdBalance);
		avatar.transfer(address(this).balance);
		active = false;
	}

	/**
	 * @dev
	 * 1.2.0 - final changes before release
	 * 1.3.0 - allow to set inviter later
	 * 1.4.0 - improve gas for bounty collection
	 */
	function version() public pure returns (string memory) {
		return "1.4.0";
	}
}
