pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../token/GoodDollar.sol";

contract AddMinter {

    Avatar public avatar;
    address public minter;

    constructor(Avatar _avatar, address _minter) public {
        require(_avatar != Avatar(0), "Avatar must not be null");
        require(_minter != address(0), "Minter must not be null");

        avatar = _avatar;
        minter = _minter;
    }

    function addMinter() public {
        ControllerInterface controller = ControllerInterface(avatar.owner());

        require(controller.isSchemeRegistered(address(this), address(avatar)),
          "scheme is not registered");

        controller.genericCall(
            address(avatar.nativeToken()),
            abi.encodeWithSignature("addMinter(address)", minter),
            avatar,
            0);
    }
}