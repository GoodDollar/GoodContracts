pragma solidity >=0.6.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/upgrades-core/contracts/Initializable.sol";
import "../Interfaces.sol";

/**
 * @title InvitesV1 contract that handles invites with pre allocated bounty pool
 */
contract InvitesV1 is Initializable {
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
		uint256 level;
		uint256 levelStarted;
		uint256 totalApprovedInvites;
		uint256 totalEarned;
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
		address _gd
	) public initializer {
		owner = msg.sender;
		identity = IIdentity(_identity);
		active = true;
		levels[0] = Level({ toNext: 0, bounty: 1000 });
		goodDollar = cERC20(_gd);
	}

	function join(bytes32 _myCode, bytes32 _inviterCode) public isActive {
		User storage user = users[msg.sender];
		require(user.inviteCode == 0x0, "user already joined");
		require(
			codeToUser[_myCode] == address(0),
			"invite code already in use"
		);
		address inviter = codeToUser[_inviterCode];
		user.inviteCode = _myCode;
		user.levelStarted = now;
		codeToUser[_myCode] = msg.sender;
		if (inviter != address(0)) {
			user.invitedBy = inviter;
			User storage inviterUser = users[inviter];
			inviterUser.invitees.push(msg.sender);
			stats.totalInvited += 1;
		}
		emit InviteeJoined(inviter, msg.sender);
	}

	function canCollectBountyFor(address _invitee) public view returns (bool) {
		User memory user = users[_invitee];
		return
			!user.bountyPaid &&
			user.invitedBy != address(0) &&
			identity.isWhitelisted(_invitee);
	}

	function getInvitees(address _inviter)
		public
		view
		returns (address[] memory)
	{
		return users[_inviter].invitees;
	}

	/**
	 * @dev  pay bounty for the inviter of _invitee
	 * invitee need to be whitelisted
	 */
	function bountyFor(address _invitee) public isActive {
		require(
			canCollectBountyFor(_invitee),
			"user not elligble for bounty  yet"
		);
		User storage user = users[_invitee];

		require(
			identity.isWhitelisted(user.invitedBy),
			"inviter is not whitelisted"
		);
		User storage inviter = users[user.invitedBy];
		Level memory level = levels[inviter.level];

		user.bountyPaid = true;
		inviter.totalApprovedInvites += 1;
		inviter.totalEarned += level.bounty;
		stats.totalApprovedInvites += 1;
		stats.totalBountiesPaid += level.bounty;

		goodDollar.transfer(user.invitedBy, level.bounty);

		bool earnedLevel = false;
		if (
			level.toNext > 0 &&
			inviter.totalApprovedInvites >= level.toNext &&
			level.daysToComplete <= (now - inviter.levelStarted) / 1 days
		) {
			inviter.level += 1;
			inviter.levelStarted = now;
			earnedLevel = true;
		}

		emit InviterBounty(
			user.invitedBy,
			_invitee,
			level.bounty,
			inviter.level,
			earnedLevel
		);
	}

	/**
     @dev collect bounties for invitees by msg.sender that are now whitelisted
     */
	function collectBounties() public isActive {
		User memory inviter = users[msg.sender];
		if (inviter.totalApprovedInvites == inviter.invitees.length) return;

		for (uint256 i = 0; i < inviter.invitees.length; i++) {
			if (canCollectBountyFor(inviter.invitees[i])) {
				bountyFor(inviter.invitees[i]);
			}
		}
	}

	function setActive(bool _active) public ownerOrAvatar returns (uint256) {
		active = active;
	}

	function end() public ownerOrAvatar isActive {
		uint256 gdBalance = goodDollar.balanceOf(address(this));
		goodDollar.transfer(avatar, gdBalance);
		avatar.transfer(address(this).balance);
		active = false;
	}

	function version() public view returns (string memory) {
		return "1.0.0";
	}
}
