pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/Identity.sol";
import "../../identity/IdentityGuard.sol";

import "../../token/GoodDollar.sol";

import "./ActivePeriod.sol";
import "./SchemeGuard.sol";

/* @title Base contract template for UBI scheme 
 */
contract AbstractUBI is IdentityGuard, ActivePeriod, SchemeGuard {
    using SafeMath for uint256;

    uint256 public amountToMint;

    uint256 public claimDistribution;
    mapping (address => bool) hasClaimed;

    uint256 public amountOfClaimers;
    uint256 public claimAmount;

    event UBIClaimed(address indexed claimer, uint256 amount);

    /**
     * @dev Constructor. Checks if avatar is a zero address
     * and if periodEnd variable is after periodStart.
     * @param _avatar the avatar contract
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
        ActivePeriod(_periodStart, _periodEnd)
        SchemeGuard(_avatar)
    {
        amountToMint = _amountToMint;
    }

    /**
     * @dev function that returns an uint256 that
     * represents the amount each claimer can claim.
     * @param reserve the account balance to calculate from
     * @return The distribution for each claimer
     */
    function distributionFormula(uint256 reserve, address user) internal returns(uint256);

    function getClaimerCount() public view returns (uint256) {
        return amountOfClaimers;
    }

    function getClaimAmount() public view returns (uint256) {
        return claimAmount;
    }

    /* @dev Function that commences distribution period on contract.
     * Can only be called after periodStart and before periodEnd and
     * can only be done once.
     * Minting amount given in constructor is minted and the reserve is sent
     * to this contract to allow claimers to claim. The claim distribution
     * is then calculated and true is returned to indicate that claiming
     * can be done
     */
    function start() public onlyRegistered returns(bool) {
        require(super.start());

        amountOfClaimers = 0;
        claimAmount = 0;

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

        return true;
    }

    /**
     * @dev Function that ends the claiming period. Can only be done if
     * Contract has been started and periodEnd is passed.
     * Sends the remaining funds on contract back to the avatar contract
     * address
     */
    function end(Avatar /*_avatar*/) public {

        DAOToken token = avatar.nativeToken();

        uint256 remainingReserve = token.balanceOf(address(this));

        if (remainingReserve > 0) {
            token.transfer(address(avatar), remainingReserve);
        }

        super.end(avatar);
    }

    /* @dev Function that claims UBI to message sender.
     * Each claimer can only claim once per UBI contract
     */
    function claim() 
        public 
        requireActive
        onlyClaimer
        onlyAddedBefore(periodStart)
        returns(bool)
    {
        require(!hasClaimed[msg.sender], "has already claimed");

        GoodDollar token = GoodDollar(address(avatar.nativeToken()));

        hasClaimed[msg.sender] = true;
        token.transfer(msg.sender, claimDistribution);

        amountOfClaimers = amountOfClaimers.add(1);
        claimAmount = claimAmount.add(claimDistribution.sub(token.getFees(claimDistribution)));

        emit UBIClaimed(msg.sender, claimDistribution);
        return true;
    }
}

/* @title UBI scheme contract responsible for calculating distribution
 * and performing the distribution itself
 */
contract UBI is AbstractUBI {

    /* @dev Constructor. Checks if avatar is a zero address
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
        AbstractUBI(_avatar, _identity, _amountToMint, _periodStart, _periodEnd)
    {
    }

    /* @dev function that returns an uint256 that
     * represents the amount each claimer can claim.
     * @param reserve the account balance to calculate from
     * @return The reserve divided by the amount of registered claimers
     */
    function distributionFormula(uint256 reserve, address /*user*/) internal returns(uint256) {
        uint claimers = identity.getClaimerCount();
        return reserve.div(claimers);
    }

    function start() public returns (bool) {
        require(super.start());

        /* #TODO - Currently, distribution is calculated when contract starts
         * depending on amount of whitelisted users, but users who are whitelisted
         * after the start are still able to claim, resulting in the possibility of
         * the reserve running out preemptively.
         */
        DAOToken token = avatar.nativeToken();
        claimDistribution = distributionFormula(token.balanceOf(address(this)), address(0));
    }    
}
