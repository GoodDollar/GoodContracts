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

  event UBIClaimed(indexed address by, uint256 total);

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
    uint256 base = 100;
    uint256 interest = base.add(market.inflationRate());
    uint256 total = interest.mul(market.totalSupply());
    total = total.div(base);
    // total at this point is the existing supply plus
    // the suggested total interest, so we need to remove
    // the existing supply - what was causing the issue
    // in the earlier calculation.
    total = total.sub(market.totalSupply());
    uint256 amount = total.div(identity.whiteListedCount());
    //emit ClaimCalculated(base,interest,total);
    return amount;
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
  function checkEntitlement() public whiteListed view returns(uint) {
    if(data.getLastClaimed(msg.sender) + 1 days > now)
      return 0;
    return calculateClaim();
  }
}
