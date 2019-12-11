pragma solidity 0.5.4;

/* @title ERC677 interface
 */
interface ERC677 {

    event Transfer(address indexed from, address indexed to, uint256 value, bytes data);

    function transferAndCall(address, uint256, bytes calldata) external returns (bool);
}