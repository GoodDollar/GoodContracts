pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/FeelessScheme.sol";
import "../../contracts/dao/schemes/ActivePeriod.sol";
import "./UBIScheme.sol";


/**
 * @title FirstClaimPool contract that transfer bonus tokens when claiming for
 * the first time
 */
contract FirstClaimPool is FeelessScheme, ActivePeriod {
    using SafeMath for uint256;

    // The whitelisted ubi scheme contrat
    UBIScheme public ubi;

    // The transfer amount to a
    // given user address
    uint256 public claimAmount;

    modifier onlyUBIScheme {
        require(msg.sender == address(ubi), "Only UBIScheme can call this method");
        _;
    }

    modifier ubiHasInitialized {
        require(address(ubi) != address(0), "ubi has not initialized");
        _;
    }

    /**
     * @dev Constructor
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract
     * @param _claimAmount The transfer amount to a given user
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _claimAmount
    )
        public
        FeelessScheme(_identity, _avatar)
        ActivePeriod(now, now * 2, _avatar)
    {
        claimAmount = _claimAmount;
    }

    /* @dev Start function. Adds this contract to identity as a feeless scheme.
     * Can only be called if scheme is registered.
     */
    function start() public onlyRegistered {
        addRights();
        super.start();
    }

    /**
     * @dev Sets the whitelisted ubi scheme. Only Avatar
     * can call this method.
     * @param _ubi The new ubi scheme to be whitelisted
     */
    function setUBIScheme(UBIScheme _ubi) public onlyAvatar {
        ubi = _ubi;
    }

    /**
     * @dev Sets the claim amount. Only Avatar
     * can call this method.
     * @param _claimAmount The new claim amount
     */
    function setClaimAmount(uint256 _claimAmount) public onlyAvatar {
        claimAmount = _claimAmount;
    }

    /**
     * @dev Transfers claimAmount to the given account address.
     * Only the whitelisted ubi scheme can call this method.
     * @param _account Recieves the claimAmount
     * @return (claimAmount) The amount that was transferred to the given _account
     */
    function awardUser(address _account)
        public
        requireActive
        ubiHasInitialized
        onlyUBIScheme
        returns (uint256)
    {
        DAOToken token = avatar.nativeToken();
        uint256 balance = token.balanceOf(address(this));
        if (balance >= claimAmount) {
            require(token.transfer(_account, claimAmount), "award transfer failed");
            return claimAmount;
        }
        return 0;
    }

    /**
     * @dev making the contract inactive after it has transferred funds to `_avatar`
     * Only the avatar can destroy the contract.
     */
    function end() public onlyAvatar {
        DAOToken token = avatar.nativeToken();
        uint256 remainingGDReserve = token.balanceOf(address(this));
        if (remainingGDReserve > 0) {
            require(
                token.transfer(address(avatar), remainingGDReserve),
                "end transfer failed"
            );
        }
        removeRights();
        super.internalEnd(avatar);
    }
}
