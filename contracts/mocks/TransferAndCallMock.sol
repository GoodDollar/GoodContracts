pragma solidity >0.5.4;

import "../token/ERC677/ERC677Receiver.sol";

contract TransferAndCallMock is ERC677Receiver {
    address public sender;
    uint256 public value;

    bool public calledFallback = false;

    function onTokenTransfer(
        address _sender,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool) {
        sender = _sender;
        value = _value;

        (bool res, ) = address(this).call(_data);
        return res;
    }

    function mockTransfer() public returns (bool) {
        calledFallback = true;
        return true;
    }

    function wasCalled() public view returns (bool) {
        return calledFallback;
    }
}
