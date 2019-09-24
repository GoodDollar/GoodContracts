pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/IdentityGuard.sol";
import "./SchemeGuard.sol";

/* @title Sign-Up bonus scheme responsible for minting
 * a given amount to users
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
        maxBonus = _maxBonus;
        reward = _reward;
    }

    modifier requireNotAdded(address _user) {
        require(invited[_user] == address(0), "User already invited");
        require(!(identity.isWhitelisted(_user)), "User already in system");
        _;
    }

    modifier requireAdded(address _user) {
        require(identity.isWhitelisted(_user), "User not in system");
        _;
    }

    function inviteUser(address _user)
        public
        onlyRegistered
        requireNotAdded(_user)
        returns (bool)
    {
        invited[_user] = msg.sender;

        return true;
    }

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

    function awardUser(address _user) internal {
        if (rewarded[_user].add(reward) > maxBonus) {
            rewarded[_user] = maxBonus;
            uint256 newReward = maxBonus.sub(rewarded[_user]);
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