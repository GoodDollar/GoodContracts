pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../../../contracts/dao/schemes/SchemeGuard.sol";
import "../../GoodFundManager.sol";

/* @title Scheme contract for upgrading the ubischeme on fundmanager
 */
contract FundManagerSetUBIAndBridge {
    address public fundmanager;
    address public ubiScheme;
    address public bridge;

    Avatar avatar;

    event BridgeAndUBIChanged(
        address indexed foreignBridge,
        address indexed ubiRecipient,
        address indexed _avatar
    );

    constructor(
        Avatar _avatar,
        address _fundmanager,
        address _ubiScheme,
        address _bridge
    ) public {
        require(_ubiScheme != address(0), "scheme cannot be null address");
        fundmanager = _fundmanager;
        ubiScheme = _ubiScheme;
        bridge = _bridge;
        avatar = _avatar;
    }

    function setContracts() public {
        ControllerInterface controller = ControllerInterface(avatar.owner());
        address setBridge;
        address setUBI;
        if (bridge != address(0)) setBridge = bridge;
        else setBridge = GoodFundManager(fundmanager).bridgeContract();

        if (ubiScheme != address(0)) setUBI = ubiScheme;
        else setUBI = GoodFundManager(fundmanager).ubiRecipient();

        (bool ok, ) = controller.genericCall(
            fundmanager,
            abi.encodeWithSignature(
                "setBridgeAndUBIRecipient(address,address)",
                setBridge,
                setUBI
            ),
            avatar,
            0
        );

        require(ok, "Changing bridge and ubi failed");

        emit BridgeAndUBIChanged(setBridge, setUBI, address(avatar));

        selfdestruct(address(avatar));
    }
}
