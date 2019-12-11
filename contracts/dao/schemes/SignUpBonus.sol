pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/IdentityGuard.sol";
import "../../token/GoodDollar.sol";
import "./ActivePeriod.sol";
import "./FeelessScheme.sol";
import "./SchemeGuard.sol";

/* @title Sign-Up bonus scheme responsible for transferring
 * a given amount of GoodDollar to users
 */
contract SignUpBonus is ActivePeriod, FeelessScheme {
    using SafeMath for uint256;

    uint256 public maxBonus;
    uint256 public initalReserve;

    mapping(address => uint256) rewarded;

    event SignUpStarted(uint256 balance, uint256 time);
    event BonusClaimed(address indexed account, uint256 amount);

    /* @dev Constructor
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract
     * @param _initialReserve The amount to transfer from the avatar at start.
     * @param _maxBonus The max amount a user can be awarded
     */
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

    /* @dev Start function. Activates the contract and transfers the given
     * reserve from the avatar to this contract.
     * Reverts if the Avatar doesn't have any funds.
     */
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

    /* @dev End function. Deactivates the contract and transfers any
     * remaining GoodDollar back to the avatar. Can be called at any
     * Time by identity admins
     */
    function end(Avatar /*_avatar*/) public onlyIdentityAdmin {
        DAOToken token = avatar.nativeToken();

        uint256 remainingReserve = token.balanceOf(address(this));
        if (remainingReserve > 0) {
            token.transfer(address(avatar), remainingReserve);
        }

        removeRights();
        super.internalEnd(avatar);
    }

    /* @dev Function for awarding users. Can only be done by identity admins
     * while contract is active. Reverts if rewarding beyond max allowed amount
     * @param _user The address to award
     * @param _amount The amount to award
     */
    function awardUser(address _user, uint256 _amount) public requireActive onlyIdentityAdmin {
        GoodDollar token = GoodDollar(address(avatar.nativeToken()));
        require(rewarded[_user].add(_amount) <= maxBonus, "Cannot award user beyond max");

        rewarded[_user] = rewarded[_user].add(_amount);
        token.transfer(_user, _amount);

        emit BonusClaimed(_user, _amount);
    }
 }