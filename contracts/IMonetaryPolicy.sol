pragma solidity ^0.5.0;

interface IMonetaryPolicy {
  function processTX(address from, address to, uint256 value) external returns (uint256, uint256);
}
