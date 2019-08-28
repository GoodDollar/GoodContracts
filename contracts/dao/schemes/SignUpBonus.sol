pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/IdentityGuard.sol";
import "./ActivePeriod.sol";
import "./SchemeGuard.sol";
import "../../token/GoodDollar.sol";

/* @title Sign-Up bonus scheme responsible for minting
 * a given amount to users
 */
contract SignUpBonus is IdentityGuard, ActivePeriod, SchemeGuard {
    using SafeMath for uint256;

    uint256 public maxBonus;
    uint256 public initalReserve;

    mapping(address => uint256) rewarded;

    event BonusClaimed(address indexed account, uint256 amount);

    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _initalReserve,
        uint256 _maxBonus
    )
        public
        IdentityGuard(_identity)
        ActivePeriod(now, now * 2)
        SchemeGuard(_avatar)
    {
        initalReserve = _initalReserve;
        maxBonus = _maxBonus;
    }

    function start() public onlyRegistered returns(bool) {
        super.start();

        if ( initalReserve > 0) {
            DAOToken token = avatar.nativeToken();
            uint256 reserve = token.balanceOf(address(avatar));

            require(reserve >= initalReserve, "Not enough funds to start");

            controller.genericCall(
                address(token),
                abi.encodeWithSignature("transfer(address,uint256)", address(this), initalReserve),
                avatar,
                0
            );
        }
        return true;
    }

    function end(Avatar /*_avatar*/) public onlyIdentityAdmin {
        DAOToken token = avatar.nativeToken();

        uint256 remainingReserve = token.balanceOf(address(this));
        if (remainingReserve > 0) {
            token.transfer(address(avatar), remainingReserve);
        }

        super.internalEnd(avatar);
    }

    function awardUser(address _user, uint256 _amount) public requireActive onlyIdentityAdmin {
        GoodDollar token = GoodDollar(address(avatar.nativeToken()));
        require(rewarded[_user].add(_amount.sub(token.getFees(_amount))) <= maxBonus, "Cannot award user beyond max");

        rewarded[_user] = rewarded[_user].add(_amount.sub(token.getFees(_amount)));
        token.transfer(_user, _amount);

        emit BonusClaimed(_user, _amount);
    }
 }