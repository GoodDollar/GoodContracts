pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../identity/Identity.sol";
import "../../identity/IdentityGuard.sol";
import "./SchemeGuard.sol";

/* @title Scheme contract responsible for adding address given
 * in constructor to identity admins.
 */
contract AddAdmin is SchemeGuard, IdentityGuard {
    Identity public identity;
    address public admin;

    /* @dev Constructor. Requires given address to be a valid address
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract
     * @param _admin The address to add to admins
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        address _admin
    ) public SchemeGuard(_avatar) IdentityGuard(_identity) {
        require(_admin != address(0), "admin cannot be null address");
        identity = _identity;
        admin = _admin;
    }

    /* @dev starts scheme if registered by DAO, gets avatar to add the
     * address to list of identity admins and then self-destructs, sending
     * all remaining eth to the address of the DAO avatar.
     */
    function start() public onlyRegistered {
        controller.genericCall(
            address(identity),
            abi.encodeWithSignature("addIdentityAdmin(address)", admin),
            avatar,
            0
        );

        selfdestruct(address(avatar));
    }
}
