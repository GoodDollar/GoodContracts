pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/Identity.sol";
import "../../identity/IdentityGuard.sol";

/** @title UBI scheme contract responsible for calculating distribution
 * and performing the distribution itself
 */
contract UBI is IdentityGuard {
    using SafeMath for uint256;

    Avatar public avatar;
    Identity public identity;

    uint256 public amountToMint;
    uint public periodStart;
    uint public periodEnd;

    bool public isActive;

    uint256 public claimDistribution;
    mapping (address => bool) hasClaimed;

    /**
     * @dev Modifier that requires that the
     * contract is active
     */
    modifier requireActive() {
        require(isActive, "is not active");
        _;
    }


    /**
     * @dev Constructor. Checks if avatar is a zero address
     * and if periodEnd variable is after periodStart.
     * @param _avatar the avatar contract
     * @param _identity the identity contract
     * @param _amountToMint the amount to mint once UBI starts
     * @param _periodStart period from when the contract is able to start
     * @param _periodEnd period from when the contract is able to end
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _amountToMint,
        uint _periodStart,
        uint _periodEnd
    )
    public
    IdentityGuard(_identity)
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

    /**
     * @dev function that returns an uint256 that
     * represents the amount each claimer can claim.
     * @param reserve the account balance to calculate from
     * @return The reserve divided by the amount of registered claimers
     */
    function calcDistribution(uint256 reserve) internal view returns(uint256) {
        uint claimers = identity.getClaimerCount();
        return reserve.div(claimers);
    }

    /**
     * @dev Function that commences distribution period on contract.
     * Can only be called after periodStart and before periodEnd and
     * can only be done once.
     * Minting amount given in constructor is minted and the reserve is sent
     * to this contract to allow claimers to claim. The claim distribution
     * is then calculated and true is returned to indicate that claiming
     * can be done
     */
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


    /**
     * @dev Function that ends the claiming period. Can only be done if
     * Contract has been started and periodEnd is passed.
     * Sends the remaining funds on contract back to the avatar contract
     * address
     */
    function end() external requireActive returns(bool) {
        require(now >= periodEnd, "period has not ended");

        DAOToken token = avatar.nativeToken();

        uint256 remainingReserve = token.balanceOf(address(this));
        if (remainingReserve > 0) {
            token.transfer(address(avatar), remainingReserve);
        }

        isActive = false;
        return true;
    }

    /**
     * @dev Function that claims UBI to message sender.
     * Each claimer can only claim once per UBI contract
     */
    function claim() external requireActive onlyClaimer returns(bool) {
        require(!hasClaimed[msg.sender], "has already claimed");

        DAOToken token = avatar.nativeToken();
        hasClaimed[msg.sender] = true;
        token.transfer(msg.sender, claimDistribution);

        return true;
    }
}
