pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../token/GoodDollar.sol";
import "./SchemeGuard.sol";

/* 
 */
contract SetForeignBridge is SchemeGuard {

    address public factory;

    /* 
     */
    constructor(Avatar _avatar, address _factory) 
        public
        SchemeGuard(_avatar) 
    {
        require(_factory != address(0), "Factory must not be null");
        factory = _factory;
    }

    /*
     */
    function SetBridge() public onlyRegistered {
        controller.genericCall(
            address(avatar.nativeToken()),
            abi.encodeWithSignature("addMinter(address)", factory),
            avatar,
            0);

        controller.genericCall(
            factory,
            abi.encodeWithSignature("deployHomeBridgeWithToken(address)", address(avatar.nativeToken())),
            avatar,
            0);

        selfdestruct(address(avatar));
    }
}