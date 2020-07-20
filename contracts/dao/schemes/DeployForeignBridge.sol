pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "./SchemeGuard.sol";

/* @title Scheme for deploying a token bridge on a foreign network using the fuseio bridge factory.
 * For more information see https://fuse.io/
 */
contract DeployForeignBridge is SchemeGuard {
    /* Taken from fuse foreign bridge factory contract.
     * Must be changed if changed on factory contract
     */
    event ForeignBridgeDeployed(
        address indexed _foreignBridge,
        address indexed _foreignValidators,
        address _foreignToken,
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

    /* @dev Deploys the foreign bridge on current network and then self-destructs, transferring any
     * ether on the contract to the avatar. Reverts if scheme is not registered
     */
    function setBridge() public onlyRegistered {
        (bool ok, ) = controller.genericCall(
            factory,
            abi.encodeWithSignature(
                "deployForeignBridge(address)",
                address(avatar.nativeToken())
            ),
            avatar,
            0
        );
        require(ok, "Calling deployForeignBridge in ForeignBridgeFactory failed");
        selfdestruct(address(avatar));
    }
}
