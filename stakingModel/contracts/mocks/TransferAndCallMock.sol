pragma solidity >0.5.4;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../../../contracts/token/ERC677/ERC677Receiver.sol";


contract TransferAndCallMock is ERC677Receiver {
    bool public calledFallback = false;
    ERC20 token;

    constructor(ERC20 _token) public {
        token = _token;
    }

    function onTokenTransfer(
        address _sender,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool) {
        address to = bytesToAddress(_data);
        return token.transfer(to, _value);
    }

    function mockTransfer() public returns (bool) {
        calledFallback = true;
        return true;
    }

    function wasCalled() public view returns (bool) {
        return calledFallback;
    }

    function bytesToAddress(bytes memory _data) internal view returns (address addr) {
        assembly {
            addr := mload(add(_data, 32))
        }
    }
}
