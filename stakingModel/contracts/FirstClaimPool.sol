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

    UBIScheme public ubi;
    uint256 public claimAmount;

    modifier onlyUBIScheme {
        require(
            msg.sender == address(ubi),
            "Only UBIScheme can call this method"
        );
        _;
    }

    modifier ubiHasInitialized {
        require(address(ubi) != address(0), "ubi has not initialized");
        _;
    }

    constructor(
        uint256 _claimAmount,
        Avatar _avatar,
        Identity _identity
    )
        public
        FeelessScheme(_identity, _avatar)
        ActivePeriod(now, now * 2)
    {
        claimAmount = _claimAmount;
    }

    /* @dev Start function. Adds this contract to identity as a feeless scheme.
     * Can only be called if scheme is registered
     */
    function start()
        public
        onlyRegistered
    {
        addRights();
        super.start();
    }

    /**
     * @dev sets the ubi scheme
     * @param _ubi contract
     */
    function setUBIScheme(UBIScheme _ubi) public onlyAvatar {
        ubi = _ubi;
    }

    /**
     * @dev sets the claim amount
     * @param _claimAmount the new claim amount
     */
    function setClaimAmount(uint256 _claimAmount) public onlyAvatar {
        claimAmount = _claimAmount;
    }

    /**
     * @dev transfers claimAmount to the given account address
     * @param account recieves the claimAmount
     * a given address.
     */
    function awardUser(address account)
        public
        requireActive
        ubiHasInitialized
        onlyUBIScheme
        returns(uint256)
    {
        DAOToken token = avatar.nativeToken();
        uint256 balance = token.balanceOf(address(this));
        if(balance >= claimAmount) {
            token.transfer(account, claimAmount);
            return claimAmount;
        }
        return 0;
    }

    /**
    * @dev making the contract inactive after it has transferred funds to `_avatar`
    * only the avatar can destroy the contract.
    * @param _avatar destination avatar address for funds
    */
    function end(Avatar _avatar)
        public
        onlyAvatar
    {
        DAOToken token = avatar.nativeToken();
        uint256 remainingGDReserve = token.balanceOf(address(this));
        if (remainingGDReserve > 0) {
            token.transfer(address(_avatar), remainingGDReserve);
        }
        removeRights();
        super.internalEnd(_avatar);
    }
}
