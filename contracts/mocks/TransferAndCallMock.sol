pragma solidity 0.5.4;

contract TransferAndCallMock {
    address public sender;
    uint256 public value;

    bool public calledFallback = false;

    function onTokenTransfer(address _sender, uint256 _value, bytes calldata _data)
        external
        returns(bool)
    {
        sender = _sender;
        value = _value;

        if (_data.length > 0) {
            (bool res,) = address(this).call(_data);
            return res;
        }
        return true;
    }

    function mockTransfer() public returns (bool) {
        calledFallback = true;
        return true;
    }

    function wasCalled() public view returns(bool) {
        require(calledFallback, "function not called");
        return true;
    }
}