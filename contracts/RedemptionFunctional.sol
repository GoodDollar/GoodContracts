pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';

import './GoodDollarReserve.sol';
import './RedemptionData.sol';
import './Identity.sol';

contract RedemptionFunctional is Ownable {
  using SafeMath for uint256;

  Identity public identity;
  RedemptionData public data;
  GoodDollarReserve public market;

  event UBIClaimed(address indexed by, uint256 total);

  modifier whiteListed() {
    bool check = identity.isVerified(msg.sender);
    require(check);
    _;
  }  

  constructor(address _identity_contract, address _data_contract, address _token) public {
    identity = Identity(_identity_contract);
    data = RedemptionData(_data_contract);
    market = GoodDollarReserve(_token);
  }



  function getLastClaimed() public view returns(uint256) {
    return data.getLastClaimed(msg.sender);
  }



  function calculateClaim() internal view returns(uint256) {
    return 100;
  }

  function claimTokens() public whiteListed returns(bool) {
    require(data.getLastClaimed(msg.sender) + 1 days < now);

    data.setLastClaimed(msg.sender);
    uint256 amount = calculateClaim();
    market.mint(msg.sender, amount);
    emit UBIClaimed(msg.sender, amount);
    return true;
  }
  /**
  * @dev Function to check how many tokens a user is entitled to mint
  * @return Number of tokens you are entitled to
  */
  function checkEntitlement() public view returns(uint) {
    if(data.getLastClaimed(msg.sender) + 1 days > now)
      return 0;
    return calculateClaim();
  }
}
