pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "./SchemeGuard.sol";


/* @title Scheme for deploying a token bridge on the fuse network using the
 * fuseio bridge factory. For more information see https://fuse.io/
 */
contract DeployHomeBridge is SchemeGuard {
    /* Taken from fuse home bridge factory contract.
     * Must be changed if changed on factory contract
     */
    event HomeBridgeDeployed(
        address indexed _homeBridge,
        address indexed _homeValidators,
        address indexed _token,
        uint256 _blockNumber
    );

    address public factory;

    /* @dev constructor. Sets the factory address. Reverts if given address is null
     * @param _factory The address of the bridge factory
     */
    constructor(Avatar _avatar, address _factory) public SchemeGuard(_avatar) {
        require(_factory != address(0), "Factory must not be null");
        factory = _factory;
    }

    /* @dev Adds the factory address to minters, deploys the home bridge on
     * current network, and then self-destructs, transferring any ether on the
     * contract to the avatar. Reverts if scheme is not registered
     */
    function setBridge(bool addMinter) public onlyRegistered {
        if (addMinter) {
            (bool ok, ) = controller.genericCall(
                address(avatar.nativeToken()),
                abi.encodeWithSignature("addMinter(address)", factory),
                avatar,
                0
            );

            require(ok, "Adding HomeBridgeFactory as minter failed");
        }

        (bool deployOk, ) = controller.genericCall(
            factory,
            abi.encodeWithSignature(
                "deployHomeBridgeWithToken(address)",
                address(avatar.nativeToken())
            ),
            avatar,
            0
        );

        require(
            deployOk,
            "Calling deployHomeBridgeWithToken in HomeBridgeFactory failed"
        );

        selfdestruct(address(avatar));
    }
}
