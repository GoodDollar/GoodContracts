pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../../../contracts/dao/schemes/SchemeGuard.sol";
import "../../GoodFundManager.sol";

/* @title Scheme contract for upgrading the ubischeme on fundmanager
 */
contract FundManagerSetUBI {
    address public fundmanager;
    address public ubiScheme;
    Avatar avatar;

    constructor(
        Avatar _avatar,
        address _fundmanager,
        address _ubiScheme
    ) public {
        require(_ubiScheme != address(0), "scheme cannot be null address");
        fundmanager = _fundmanager;
        ubiScheme = _ubiScheme;
        avatar = _avatar;
    }

    function setUBIScheme() public {
        ControllerInterface controller = ControllerInterface(avatar.owner());
        address bridge = GoodFundManager(fundmanager).bridgeContract();
        controller.genericCall(
            fundmanager,
            abi.encodeWithSignature("setBridgeAndUBIRecipient(address,address)", bridge,  ubiScheme),
            avatar,
            0
        );

        selfdestruct(address(avatar));
    }
}
