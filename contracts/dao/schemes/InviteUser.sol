pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/IdentityGuard.sol";
import "./SchemeGuard.sol";

/* @title Scheme for inviting non-whitelisted users and claiming rewards
 */
contract InviteUser is IdentityGuard, SchemeGuard {
    using SafeMath for uint256;

    uint256 public maxBonus;
    uint256 public reward;

    mapping(address => uint256) public rewarded;
    mapping(address => address) public invited;
    mapping(address => bool) public claimed;

    event BonusClaimed(address indexed account, uint256 amount);
    event UserSigned(address indexed newUser, address indexed referrer);

    /* @dev Constructor. Sets the amount users are rewarded per invite and
     * the max amount addresses can claim
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract of the DAO
     * @param _maxBonus The max bonus addresses can be awarded
     * @param _reward The reward users receive per invite
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _maxBonus,
        uint256 _reward
    )
        public
        IdentityGuard(_identity)
        SchemeGuard(_avatar)
    {
        require(_maxBonus >= _reward, "Reward cannot be greater than max bonus");
        maxBonus = _maxBonus;
        reward = _reward;
    }

    /* @dev Modifier that requires user to not have been invited and is not whitelisted
     * @param _user The address to check
     */
    modifier requireNotAdded(address _user) {
        require(invited[_user] == address(0), "User already invited");
        require(!(identity.isWhitelisted(_user)), "User already in system");
        _;
    }

    /* @dev Modifier that requires user to be whitelisted
     * @param _user The address to check
     */
    modifier requireAdded(address _user) {
        require(identity.isWhitelisted(_user), "User not in system");
        _;
    }

    /* @dev Function for inviting a given address. Can only be done if contract
     * is registered and address has not received an invite yet
     * @param _user The address to invite
     * @return a bool indicating if the user was invited
     */
    function inviteUser(address _user)
        public
        onlyRegistered
        requireNotAdded(_user)
        returns (bool)
    {
        require(_user != msg.sender, "Cannot invite self");
        invited[_user] = msg.sender;

        return true;
    }

    /* @dev Function for claiming rewards from entering the system. Can only be called
     * if contract is registered and if address has been added.
     * @return a bool indicating if the caller has been rewarded
     */
    function claimReward()
        public
        onlyRegistered
        requireAdded(msg.sender)
        returns (bool)
    {
        require(!claimed[msg.sender], "Cannot claim twice");

        claimed[msg.sender] = true;

        awardUser(msg.sender);

        if (invited[msg.sender] != address(0)) {
            awardUser(invited[msg.sender]);
        }

        return true;
    }

    /* @dev Internal function for rewarding an address. Rewards the address the
     * parameter set in the constructor. If the reward makes the address exceed
     * the maximum reward amount, the address will instead be rewarded the
     * difference between the max reward amount and their current rewarded amount
     */
    function awardUser(address _user) internal {
        if (rewarded[_user].add(reward) > maxBonus) {
            uint256 newReward = maxBonus.sub(rewarded[_user]);
            rewarded[_user] = maxBonus;
            controller.mintTokens(newReward, _user, address(avatar));
            emit BonusClaimed(_user, newReward);
        }
        else {
            rewarded[_user] = rewarded[_user].add(reward);
            controller.mintTokens(reward, _user, address(avatar));

            emit BonusClaimed(_user, reward);
        }
    }
}