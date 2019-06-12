pragma solidity 0.5.4;

contract ERC677 {

    event Transfer(address indexed from, address indexed to, uint256 value, bytes data);

    function transferAndCall(address, uint256, bytes memory) public returns (bool);
}