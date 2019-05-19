pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';

import './Identity.sol';
import './BancorFormula.sol';
import './Math.sol';
import './GoodDollar.sol';

contract UBI is Ownable,DSMath {
  using SafeMath for uint256;

  mapping(address => uint256) public last_claimed;

  uint lastCalculatedDailyUBI;
  uint[7] public dailyUBIAmounts;
  uint[30] public monetaryBaseHistory;
  uint[30] public claimsHistory;
  uint[30] public userBaseHistory;

  uint public currentDay = 0;
  uint INFLATION = 10;
  uint DECIMALS = 2;
  uint MINIMUM_UBI = 100;
  Identity public identity;
  BancorFormula public formula;
  GoodDollar public token;

  event UBIClaimed(address indexed by, uint256 total,uint8 forDays);
  event UBICalculated(uint indexed day, uint256 amount);


  modifier whiteListed() {
    bool check = identity.isUBIWhitelisted(msg.sender);
    require(check);
    _;
  }  

  constructor(address _identity_contract, address _token, address _bancor_formula) public {
    identity = Identity(_identity_contract);
    formula = BancorFormula(_bancor_formula);
    token = GoodDollar(_token);
    DECIMALS = uint(token.decimals());
    //1 GD
    MINIMUM_UBI = 10**DECIMALS;
    lastCalculatedDailyUBI = now;
    //initialize day 1
    dailyUBIAmounts[0] = MINIMUM_UBI;
    
  }


  function getLastClaimed(
      address _account
  ) public view returns(uint256) {
      return last_claimed[_account]; 
  }

  function setLastClaimed(
      address _account
  ) public onlyOwner returns(bool) {
      last_claimed[_account] = now;
      return true;
  }

  function shouldCalculateDailyUBI() public view returns (bool) {
    return (now - lastCalculatedDailyUBI >= 1 days);
  }

  function setFakeLastClaimed(uint passDays) public {
    last_claimed[msg.sender] = now - (passDays * 1 days);
  }

  function setFakeLastCalculated(uint passDays) public {
    lastCalculatedDailyUBI = now - (passDays * 1 days);
  }

  function calcFakeDay(uint _userbase, uint _totalclaims, uint _supply) public returns (uint) {
    userBaseHistory[currentDay%30] = _userbase;
    monetaryBaseHistory[currentDay%30] = token.totalSupply() + _supply;
    claimsHistory[currentDay%30] = _totalclaims;
    // uint dailyUBI = 10;
    currentDay += 1;
    // //calc ubi for new day
    uint dailyUBI = calcUBI();
    dailyUBIAmounts[currentDay%7] = dailyUBI;
    return dailyUBI;
  }

  function calculateDailyUBI() public {
    if( shouldCalculateDailyUBI() ) {
      uint passedDays = (now - lastCalculatedDailyUBI).div(1 days);
      for(uint i=0; i<passedDays; i++) {
        //record end of day statistics
        userBaseHistory[currentDay%30] = identity.whiteListedCount();
        monetaryBaseHistory[currentDay%30] = token.totalSupply();
        //increase current day
        currentDay += 1;
        //calc ubi for new day
        uint dailyUBI = calcUBI();
        dailyUBIAmounts[currentDay%7] = dailyUBI;
        emit UBICalculated(currentDay,dailyUBI);
      }
      lastCalculatedDailyUBI = now;
    }
  }

  /**
  helper function to calculate sum of last X days claims and user base
  used in UBI formula to calculate the weighted average of a day claims
   */
  function getClaimsAndUsersSum(uint passDays) public view returns (uint, uint) {
    if( currentDay < passDays) passDays = currentDay;
    uint  startPos = (currentDay - 1)%30;
    uint sumClaims = 0;
    uint sumUsers = 0;
    for(uint i = 0; i<passDays; i++) {
      //go backwards in history array (since its a round robin array)
      uint arrPos = startPos < i ? 30 + startPos - i : startPos - i;
      sumUsers += userBaseHistory[arrPos];
      sumClaims += claimsHistory[arrPos];
    }
    return (sumUsers, sumClaims);
  }

  function calcUBI() public view returns ( uint ) {
    (uint sumClaims, uint sumUsers) = getClaimsAndUsersSum(10);
    uint formulaResult = calcUBIHelper(currentDay, sumClaims, sumUsers, INFLATION);
    //make sure UBI is minimum 1 GD
    return formulaResult<MINIMUM_UBI ? MINIMUM_UBI : formulaResult;
  }

  /*
    t=current day
    ( (1.1^(t/365)-1) * M(t-1) ) / L*N(t-1)
    Mt = number of total tokens at day t
    Nt = number of total whitelisted users for ubi at day t
    L = weighted average claim rate at last 10 days = sum(claims at last 10 days)/sum(number of whitelisted users at last 10 days)

  */
  uint BASE_D = 100;
  uint32 EXP_D = 365;
  function calcUBIHelper(uint _day, uint _sumClaims, uint _sumUsers, uint _inflation) public view returns ( uint ) {
    uint baseN = 100 + _inflation;
    uint32 expN = uint32(_day);
    //1.1^(t/365)
    (uint res, uint8 precision) = formula.power(baseN, BASE_D, expN, EXP_D);
    //add token precision ie decimals
    uint Mt = monetaryBaseHistory[(_day - 1)%30] * (10**DECIMALS);
    uint Nt = userBaseHistory[(_day - 1)%30];
    //wad precision = 18 decimals
    uint L_wad = (_sumClaims == 0 || _sumUsers == 0) ? 1 * WAD : wdiv(_sumClaims,_sumUsers);
    //after multiplying convert back to decimals precision
    uint dailyExpansion = (res.mul(Mt) >> precision);
    dailyExpansion = dailyExpansion - Mt;
    //convert Nt to WAD precision
    uint LtimesNt_wad = wmul(L_wad,Nt*WAD);
    //convert dailyExpansion ie monetary infaltion to WAD precision
    uint ubi_wad = wdiv(dailyExpansion*WAD,LtimesNt_wad);
    //return result in GD decimals precision back from WAD
    return ubi_wad / WAD;
  }

  /**
  calculate total daily UBIs user can receive. upto 7 days.
   */
  function calculateClaim(address _user) public view returns (uint amount) {
    uint8 ubiDays = uint8( (now - last_claimed[_user]).div(1 days) );
    ubiDays = identity.isUBIWhitelisted(msg.sender)? ubiDays : 1
    if(ubiDays < 1)
      return 0;
    ubiDays = ubiDays > 7 ? 7 : ubiDays;
    uint  startPos = currentDay % 7;
    amount = 0;
    //calculate missed claims up to 7 days
    for(uint i=0; i<ubiDays; i++)
    {
      //go backwards in history array (since its a round robin array)
      uint dayPos = startPos < i ? 7 + startPos - i : startPos - i;
      amount += dailyUBIAmounts[dayPos];
    }
    return amount;
  }

  function claimTokens() public whiteListed returns(uint) {
    uint8 ubiDays = uint8( (now - last_claimed[msg.sender]).div(1 days) );
    ubiDays = ubiDays > 7 ? 7 : ubiDays;
    require(ubiDays > 0,"No UBI to claim");
    calculateDailyUBI();
    uint amount = calculateClaim(msg.sender);
    token.mint(msg.sender, amount);
    last_claimed[msg.sender] = now;
    claimsHistory[currentDay%30] += 1;
    emit UBIClaimed(msg.sender, amount, ubiDays);
    
    return amount;
  }

  /**
  * @dev Function to check if and how many tokens a user is entitled to receive as UBI
  * @return Number of tokens you are entitled to
  */
  function checkEntitlement() public whiteListed view returns(uint) {    
    return calculateClaim(msg.sender);
  }
  
}
