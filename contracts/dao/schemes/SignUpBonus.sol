pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/IdentityGuard.sol";
import "./SchemeGuard.sol";

/* @title Sign-Up bonus scheme responsible for minting
 * a given amount to users
 */
contract SignUpBonus is IdentityGuard, SchemeGuard {
    using SafeMath for uint256;

    uint256 public maxBonus;
    mapping(address => uint256) rewarded;

    event BonusClaimed(address indexed account, uint256 amount);

    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _maxBonus
    )
        public
        IdentityGuard(_identity)
        SchemeGuard(_avatar)
    {
        maxBonus = _maxBonus;
    }

    function awardUser(address _user, uint256 _amount) public onlyRegistered onlyIdentityAdmin {
        require(rewarded[_user].add(_amount) <= maxBonus, "Cannot award user beyond max");

        rewarded[_user] = rewarded[_user].add(_amount);
        controller.mintTokens(_amount, _user, address(avatar));

        emit BonusClaimed(_user, _amount);
    }
 }