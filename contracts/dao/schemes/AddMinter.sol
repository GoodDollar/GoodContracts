pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../token/GoodDollar.sol";
import "./SchemeGuard.sol";

/* @title Scheme for adding a new minter to minters.
 */
contract AddMinter is SchemeGuard {

    address public minter;

    /* @dev Constructor. Requires the given address to be a valid address
     * @param _avatar The avatar of the DAO
     * @param _minter address to grant minter rights
     */
    constructor(Avatar _avatar, address _minter) 
        public
        SchemeGuard(_avatar) 
    {
        require(_minter != address(0), "Minter must not be null");
        minter = _minter;
    }

    /* @dev Adds the given address to minters if contract is a registered scheme.
     * After adding minter, self-destructs contract, transferring any remaining
     * eth to the address of the avatar.
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