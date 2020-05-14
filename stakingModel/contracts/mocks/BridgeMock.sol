pragma solidity 0.5.4;

import "../../../contracts/token/ERC677/ERC677Receiver.sol";


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
        return true;
    }

    function parse32BytesToAddress(bytes memory data) public returns (address) {
        address parsed;
        assembly {
            parsed := mload(add(data, 32))
        }
        return parsed;
    }
}
