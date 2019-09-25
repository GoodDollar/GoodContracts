pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "./SchemeGuard.sol";
import "../../identity/Identity.sol";

contract FeelessScheme is SchemeGuard {

    Identity public identity;

    constructor(Identity _identity, Avatar _avatar)
        public
        SchemeGuard(_avatar)
    {
        identity = _identity;
    }

    function addRights() internal onlyRegistered {
        controller.genericCall(
            address(identity),
            abi.encodeWithSignature("addContract(address)", address(this)),
            avatar,
            0);
    }

    function removeRights() internal onlyRegistered {
        controller.genericCall(
            address(identity),
            abi.encodeWithSignature("removeContract(address)", address(this)),
            avatar,
            0);    
    }
}