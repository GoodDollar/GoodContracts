pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../../../contracts/dao/schemes/SchemeGuard.sol";

/* @title Scheme contract responsible for setting the contribution address
 * in reserve contract
 */
contract SetContributionAddress is SchemeGuard {
    address public reserve;
    address public contribution;

    constructor(
        Avatar _avatar,
        address _reserve,
        address _contribution
    ) public SchemeGuard(_avatar) {
        require(_reserve != address(0), "reserve cannot be null address");
        require(_contribution != address(0), "contribution cannot be null address");
        reserve = _reserve;
        contribution = _contribution;
    }

    function setContributionAddress() public onlyRegistered {
        controller.genericCall(
            reserve,
            abi.encodeWithSignature("setContributionAddress(address)", contribution),
            avatar,
            0
        );

        selfdestruct(address(avatar));
    }
}
