pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/Identity.sol";

contract UBI {
    using SafeMath for uint256;

    Avatar public avatar;
    Identity public identity;

    uint256 public amountToMint;
    uint public periodStart;
    uint public periodEnd;

    bool public isActive;

    uint256 public claimDistribution;
    mapping (address => bool) hasClaimed;

    modifier requireActive() {
        require(isActive, "is not active");
        _;
    }

    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _amountToMint,
        uint _periodStart,
        uint _periodEnd
    )
    public
    {
        require(_avatar != Avatar(0), "avatar cannot be zero");
        require(_periodStart < _periodEnd, "start cannot be after nor equal to end");

        avatar = _avatar;
        identity = _identity;

        amountToMint = _amountToMint;
        periodStart = _periodStart;
        periodEnd = _periodEnd;

        isActive = false;
    }

    function calcDistribution(uint256 reserve) internal view returns(uint256) {
        uint claimers = identity.getClaimerCount();
        return reserve.div(claimers);
    }

    function start() external returns(bool) {
        ControllerInterface controller = ControllerInterface(avatar.owner());

        require(!isActive, "cannot start twice");
        require(now >= periodStart && now < periodEnd, "not in period");
        require(controller.isSchemeRegistered(address(this), address(avatar)),
          "scheme is not registered");

        // Transfer the fee reserve to this contract
        DAOToken token = avatar.nativeToken();
        uint256 reserve = token.balanceOf(address(avatar));

        controller.genericCall(
            address(token),
            abi.encodeWithSignature("transfer(address,uint256)", address(this), reserve),
            avatar,
            0);

        // Mint the required amount
        if (amountToMint > 0) {
            controller.mintTokens(amountToMint, address(this), address(avatar));
        }

        /**
         * #TODO - Currently, distribution is calculated when contract starts
         * depending on amount of whitelisted users, but users who are whitelisted
         * after the start are still able to claim, resulting in the possibility of
         * the reserve running out preemptively.
         */
        claimDistribution = calcDistribution(token.balanceOf(address(this)));

        isActive = true;
        return true;
    }

    function end() external requireActive returns(bool) {
        require(now >= periodEnd, "period has not ended");

        DAOToken token = avatar.nativeToken();

        uint256 remainingReserve = token.balanceOf(address(this));
        if (remainingReserve > 0) {
            token.transfer(address(avatar), remainingReserve);
        }

        isActive = false;
    }

    function claim() external requireActive returns(bool) {
        require(!hasClaimed[msg.sender], "has already claimed");

        DAOToken token = avatar.nativeToken();
        hasClaimed[msg.sender] = true;
        token.transfer(msg.sender, claimDistribution);

        return true;
    }
}
