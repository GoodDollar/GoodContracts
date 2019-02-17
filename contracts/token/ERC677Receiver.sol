pragma solidity ^0.5.0;

contract ERC677Receiver {
    function onTokenTransfer(address _from, uint _value, bytes calldata _data) external returns(bool);
}
