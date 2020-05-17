pragma solidity 0.5.4;

import "../../../contracts/token/ERC677/ERC677Receiver.sol";

interface ERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract TransferAndCallMock is ERC677Receiver {
    bool public calledFallback = false;
    ERC20 token;

    constructor(
        ERC20 _token
    )
        public
    {
        token = _token;
    }

    function onTokenTransfer(address _sender, uint256 _value, bytes calldata _data)
        external
        returns(bool)
    {
        address to = bytesToAddress(_data);
        return token.transfer(to, _value);
    }

    function mockTransfer() public returns (bool) {
        calledFallback = true;
        return true;
    }

    function wasCalled() public view returns(bool) {
        return calledFallback;
    }

    function bytesToAddress(bytes memory _data) internal view returns (address addr) {
        assembly {
            addr := mload(add(_data,32))
        }
    }
}