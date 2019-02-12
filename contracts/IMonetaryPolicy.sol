pragma solidity ^0.5.0;

interface IMonetaryPolicy {
  function processTX(address from, address to, uint value) external returns (uint256, uint256);
  function setFees(uint txFee, uint burnFee) external;
}
