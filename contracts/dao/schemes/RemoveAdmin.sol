pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../identity/Identity.sol";
import "./SchemeGuard.sol";

/* @title Scheme contract responsible for removing given address from identity admins
 */
contract RemoveAdmin is SchemeGuard {

    Identity public identity;
    address public admin;

    /* @dev Constructor. Checks if given address is admin 
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        address _admin
    )
        public
        SchemeGuard(_avatar)
    {
        require(_identity.isIdentityAdmin(_admin), "Given address is not admin");
        identity = _identity;
        admin = _admin;
    }

    /* @dev starts scheme if within period, gets avatar to remove the
     * address from list of admins and then ends even if still within period
     */
    function start() public onlyRegistered {

        controller.genericCall(
            address(identity),
            abi.encodeWithSignature("removeIdentityAdmin(address)", admin),
            avatar,
            0);

        selfdestruct(address(avatar));
    }
}
