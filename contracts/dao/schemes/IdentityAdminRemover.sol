pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../identity/Identity.sol";
import "./ActivePeriod.sol";
import "./SchemeGuard.sol";

/* @title Scheme contract responsible for removing given address from identity admins
 * @
 */
contract IdentityAdminRemover is ActivePeriod, SchemeGuard {

    Identity public identity;
    address public admin;

    /* @dev Constructor. Checks if periodEnd variable is after periodStart.
     * @param _periodStart period from when the contract is able to start
     * @param _periodEnd period from when the contract is able to end
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        address _admin,
        uint _periodStart,
        uint _periodEnd
    )
        public
        ActivePeriod(_periodStart, _periodEnd)
        SchemeGuard(_avatar)
    {
        require(_identity.isIdentityAdmin(_admin), "Given address is not admin");
        identity = _identity;
        admin = _admin;
    }

    /* @dev starts scheme if within period, gets avatar to remove the
     * address from list of admins and then ends even if still within period
     */
    function start() onlyRegistered public returns(bool) {
        require(super.start());

        controller.genericCall(
            address(identity),
            abi.encodeWithSignature("removeIdentityAdmin(address,address)", admin, address(avatar)),
            avatar,
            0);

        return super.internalEnd();
    }
}
