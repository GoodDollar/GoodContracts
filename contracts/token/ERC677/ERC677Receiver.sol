pragma solidity 0.5.4;

interface ERC677Receiver {
    function onTokenTransfer(address _from, uint256 _value, bytes calldata _data) external returns(bool);
}