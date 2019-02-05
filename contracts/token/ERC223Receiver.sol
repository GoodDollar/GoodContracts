pragma solidity ^0.5.0;

 /* ERC223 additions to ERC20 */

import "./IERC223Receiver.sol";

contract ERC223Receiver is IERC223Receiver {
  Tkn tkn;
  bool __isTokenFallback;

  struct Tkn {
    address addr;
    address sender;
    address origin;
    uint256 value;
    bytes data;
    bytes4 sig;
  }
  mapping(uint8 => Tkn) public tkns;

  function tokenFallback(address _sender, address _origin, uint _value, bytes memory _data) public returns (bool ok) {
    if (!supportsToken(msg.sender)) return false;

    // Problem: This will do a sstore which is expensive gas wise. Find a way to keep it in memory.
    tkn = Tkn(msg.sender, _sender, _origin, _value, _data, getSig(_data));
    __isTokenFallback = true;
    (bool success,) = address(this).delegatecall(_data);

    // avoid doing an overwrite to .token, which would be more expensive
    // makes accessing .tkn values outside tokenPayable functions unsafe
    __isTokenFallback = false;

    return success;
  }

  function getSig(bytes memory _data) private pure returns (bytes4 sig) {
    uint l = _data.length < 4 ? _data.length : 4;
    for (uint i=0; i<l;i++)
        sig^=(bytes4(0xff000000)&_data[i])>>(i*8);
    return sig;
  }


  modifier tokenPayable {
    require(!__isTokenFallback,"No token fallback");
    _;
  }

  function supportsToken(address token) public returns (bool);
}