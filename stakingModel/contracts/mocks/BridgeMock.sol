pragma solidity 0.5.4;

import "../../../contracts/token/ERC677/ERC677Receiver.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract BridgeMock is ERC677Receiver {
    address public sender;
    uint256 public value;

    bool public calledFallback = false;

    address to;

    function onTokenTransfer(
        address _sender,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool) {
        sender = _sender;
        value = _value;

        to = parse32BytesToAddress(_data);
        IERC20 token = IERC20(msg.sender);
        token.transfer(to, value);
        return true;
    }

    function parse32BytesToAddress(bytes memory data) public returns (address) {
        address parsed;

        assembly {
            parsed := div(mload(add(data, 32))), 0x1000000000000000000000000)
        }

        return parsed;
    }
}
