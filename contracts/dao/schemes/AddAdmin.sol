pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../identity/Identity.sol";
import "../../identity/IdentityGuard.sol";
import "./SchemeGuard.sol";

/* @title Scheme contract responsible for adding given address to identity admins
 */
contract AddAdmin is SchemeGuard, IdentityGuard {

    Identity public identity;
    address public admin;

    /* @dev Constructor. Checks if given address is valid
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        address _admin
    )
        public
        SchemeGuard(_avatar)
        IdentityGuard(_identity)
    {
        require(_admin != address(0), "admin cannot be null address");
        identity = _identity;
        admin = _admin;
    }

    /* @dev starts scheme if within period, gets avatar to add the
     * address to list of admins and then ends even if still within period
     */
    function start() public onlyRegistered {

        controller.genericCall(
            address(identity),
            abi.encodeWithSignature("addIdentityAdmin(address)", admin),
            avatar,
            0);

        selfdestruct(address(avatar));
    }
}
