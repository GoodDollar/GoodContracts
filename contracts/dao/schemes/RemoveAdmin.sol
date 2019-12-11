pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../identity/Identity.sol";
import "./SchemeGuard.sol";

/* @title Scheme responsible for removing a given address from identity admins
 */
contract RemoveAdmin is SchemeGuard {

    Identity public identity;
    address public admin;

    /* @dev Constructor. Reverts if given address is not an identity admin.
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract
     * @param _admin The address to remove
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

    /* @dev Starts scheme, removing the address from identity admins.
     * Can only be called if scheme has been registered by the DAO.
     * Self-destructs after removing admin, transferring any remaining
     * ETH on the contract to the address of the avatar of the DAO.
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
