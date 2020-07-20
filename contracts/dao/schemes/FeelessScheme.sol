pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "./SchemeGuard.sol";
import "../../identity/Identity.sol";
import "../../identity/IdentityGuard.sol";

/**
 * @dev Contract for letting scheme add itself to identity
 * to allow transferring GoodDollar without paying fees
 * and transfer ownership to Avatar
 */
contract FeelessScheme is SchemeGuard, IdentityGuard {
    /* @dev Constructor
     * @param _identity The identity contract
     * @param _avatar The avatar of the DAO
     */
    constructor(Identity _identity, Avatar _avatar)
        public
        SchemeGuard(_avatar)
        IdentityGuard(_identity)
    {}

    /* @dev Internal function to add contract to identity.
     * Can only be called if scheme is registered.
     */
    function addRights() internal onlyRegistered {
        controller.genericCall(
            address(identity),
            abi.encodeWithSignature("addContract(address)", address(this)),
            avatar,
            0
        );
        transferOwnership(address(avatar));
    }

    /* @dev Internal function to remove contract from identity.
     * Can only be called if scheme is registered.
     */
    function removeRights() internal onlyRegistered {
        controller.genericCall(
            address(identity),
            abi.encodeWithSignature("removeContract(address)", address(this)),
            avatar,
            0
        );
    }
}
