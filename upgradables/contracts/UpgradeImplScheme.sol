pragma solidity >=0.6;

import "./DAOStackInterfaces.sol";

/* @title Scheme for upgrading an upgradable contract to new impl
* see openzeppelin upgradables
 */
contract UpgradeImplScheme {
   
    event UpgradedImpl(
        address indexed proxy,
        address  impl
    );

    Avatar public avatar;
    Controller public controller;
    address public newImpl;
    address public proxy;
    address public proxyAdmin;
    bytes public callData;
    uint public timeLockHours;
    uint public timeLockEnd;
    /* @dev constructor. Sets the factory address. Reverts if given address is null
     * @param _factory The address of the bridge factory
     */
    constructor(Avatar _avatar, address _newImpl, address _proxy, address _proxyAdmin, bytes memory _callData, uint _timeLockHours) public {
        newImpl = _newImpl;
        avatar = _avatar;
        proxy = _proxy;
        proxyAdmin = _proxyAdmin;
        callData = _callData;
        controller = Controller(avatar.owner());
        timeLockHours = _timeLockHours;
    }

    /* @dev 
    * calls upgrade on the proxyadmin contract
     */
    function upgrade() public {
        if(timeLockEnd == 0)
        {
            timeLockEnd = block.timestamp + (timeLockHours * 1 hours);
        }
        if(timeLockEnd < block.timestamp) return;
        if(callData.length > 0)
        {
            (bool ok, ) = controller.genericCall(
                proxyAdmin,
                abi.encodeWithSignature(
                    "upgradeAndCall(address,address,bytes)",
                    proxy, newImpl, callData
                ),
                avatar,
                0
            );
            require(ok, "Calling upgradeAndCall failed");
        }
        else {
            (bool ok, ) = controller.genericCall(
                proxyAdmin,
                abi.encodeWithSignature(
                    "upgrade(address,address)",
                    proxy, newImpl
                ),
                avatar,
                0
            );
            require(ok, "Calling upgrade failed");
        }
        emit UpgradedImpl(proxy, newImpl);
        selfdestruct(payable(address(avatar)));
    }
}
