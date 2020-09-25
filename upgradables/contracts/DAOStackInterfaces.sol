pragma solidity >= 0.6;

interface Avatar {
    function nativeToken() external returns (address);
    function owner() external returns (address);

}

interface Controller {
    function genericCall(address _contract, bytes calldata _data, uint256 _value) external returns (bool, bytes memory);
    function isSchemeRegistered(address _scheme) external view returns(bool);
}