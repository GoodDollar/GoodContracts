pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/IdentityGuard.sol";
import "../../token/GoodDollar.sol";
import "./ActivePeriod.sol";
import "./FeelessScheme.sol";
import "./SchemeGuard.sol";

/* @title Sign-Up bonus scheme responsible for minting
 * a given amount to users
 */
contract SignUpBonus is ActivePeriod, FeelessScheme {
    using SafeMath for uint256;

    uint256 public maxBonus;
    uint256 public initalReserve;

    mapping(address => uint256) rewarded;

    event SignUpStarted(uint256 balance, uint256 time);
    event BonusClaimed(address indexed account, uint256 amount);

    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _initalReserve,
        uint256 _maxBonus
    )
        public
        ActivePeriod(now, now * 2)
        FeelessScheme(_identity, _avatar)
    {
        require(_maxBonus > 0, "Max bonus cannot be zero");

        initalReserve = _initalReserve;
        maxBonus = _maxBonus;
    }

    function start() public onlyRegistered {
        super.start();
        addRights();

        DAOToken token = avatar.nativeToken();

        if ( initalReserve > 0) {
            uint256 reserve = token.balanceOf(address(avatar));

            require(reserve >= initalReserve, "Not enough funds to start");

            controller.genericCall(
                address(token),
                abi.encodeWithSignature("transfer(address,uint256)", address(this), initalReserve),
                avatar,
                0
            );
        }
        emit SignUpStarted(token.balanceOf(address(this)), now);
    }

    function end(Avatar /*_avatar*/) public onlyIdentityAdmin {
        DAOToken token = avatar.nativeToken();

        uint256 remainingReserve = token.balanceOf(address(this));
        if (remainingReserve > 0) {
            token.transfer(address(avatar), remainingReserve);
        }

        removeRights();
        super.internalEnd(avatar);
    }

    function awardUser(address _user, uint256 _amount) public requireActive onlyIdentityAdmin {
        GoodDollar token = GoodDollar(address(avatar.nativeToken()));
        require(rewarded[_user].add(_amount) <= maxBonus, "Cannot award user beyond max");

        rewarded[_user] = rewarded[_user].add(_amount);
        token.transfer(_user, _amount);

        emit BonusClaimed(_user, _amount);
    }
 }