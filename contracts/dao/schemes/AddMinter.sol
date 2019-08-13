pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../token/GoodDollar.sol";
import "./SchemeGuard.sol";

/* @title Scheme for proposing and adding a new minter.
 */
contract AddMinter is SchemeGuard {

    address public minter;

    constructor(Avatar _avatar, address _minter) 
        public
        SchemeGuard(_avatar) 
    {
        require(_minter != address(0), "Minter must not be null");
        minter = _minter;
    }

    /* @dev Makes controller add the given minter to minters.
     * can only be done if scheme has been registered.
     */
    function addMinter() public onlyRegistered {
        controller.genericCall(
            address(avatar.nativeToken()),
            abi.encodeWithSignature("addMinter(address)", minter),
            avatar,
            0);

        selfdestruct(address(avatar));
    }
}