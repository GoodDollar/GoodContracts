pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./UBI.sol";

import "./GoodUBI/BancorFormula.sol";
import "./GoodUBI/ExpArray.sol";
import "./GoodUBI/Math.sol";

contract GoodUBI is AbstractUBI, DSMath {
    using SafeMath for uint256;

    BancorFormula formula;

    mapping (address => uint256) public lastClaimed;
    uint lastCalculatedDailyUBI;
    uint[7] public dailyUBIAmounts;
    uint[30] public monetaryBaseHistory;
    uint[30] public claimsHistory;
    uint[30] public userBaseHistory;

    uint public currentDay = 0;
    uint public INFLATION = 10;
    uint public DECIMALS = 2;
    uint public MINIMUM_UBI = 100;
    uint BASE_D = 100;
    uint32 EXP_D = 365;

    constructor (
        Avatar _avatar,
        Identity _identity,
        BancorFormula _formula,
        uint256 _amountToMint,
        uint _periodStart,
        uint _periodEnd
    )
        public
        AbstractUBI(_avatar, _identity, _amountToMint, _periodStart, _periodEnd)
    {
        formula = _formula;
    }

    function distributionFormula(uint256 _value, address _user) internal returns(uint256) {
        uint256 ubiDays = (now - lastClaimed[_user]).div(1 days);
        ubiDays = ubiDays > 7 ? 7 : ubiDays;
        if (ubiDays < 1) {
            return 0;
        }

        if ((now - lastCalculatedDailyUBI) < 1) {
            calculateDailyUBI();
        } 

        hasClaimed[_user] = false;
        uint256 amount = calculateClaim(_user);
        claimsHistory[currentDay%30] += 1;

        return amount;
    }

    function calcFormula(address _user) public returns (uint256) {
        return distributionFormula(0, _user);
    }

    function getClaimsAndUsersSum(uint _passedDays) public view returns (uint, uint) {
        if (currentDay < _passedDays) {
            _passedDays = currentDay;
        }

        uint startPos = (currentDay - 1) % 30;
        uint sumClaims = 0;
        uint sumUsers = 0;

        for (uint i = 0; i < _passedDays; i++) {
            uint arrPos = startPos < i ? 30 + startPos - i : startPos - i;
            sumUsers += userBaseHistory[arrPos];
            sumClaims += claimsHistory[arrPos];
        }

        return (sumUsers, sumClaims);
    }

    function calculateClaim(address _user) public view returns (uint256) {
        uint8 ubiDays = uint8((now - lastClaimed[_user]).div(1 days));
        ubiDays = identity.isClaimer(_user) ? ubiDays : 1;

        if (ubiDays < 1) { return 0; }

        ubiDays = ubiDays > 7 ? 7 : ubiDays;

        uint startPos = currentDay % 7;
        uint amount = 0;

        for (uint i = 0; i < ubiDays; i++) {
            uint dayPos = startPos < i ? 7 + startPos - i : startPos - i;
            amount += dailyUBIAmounts[dayPos];
        }

        return amount;
    } 

    function claim() public requireActive onlyClaimer returns(bool) {
        claimDistribution = distributionFormula(0, msg.sender);
        lastClaimed[msg.sender] = now;

        require(super.claim());
        return true;
    }

    function calculateDailyUBI() public {
        require((now - lastCalculatedDailyUBI) >= 1 days, "Already calculated today");

        uint passedDays = (now - lastCalculatedDailyUBI).div(1 days);

        for (uint i = 0; i < passedDays; i++) {
            
            userBaseHistory[currentDay%30] = identity.getClaimerCount();
            monetaryBaseHistory[currentDay%30] = avatar.nativeToken().totalSupply();

            currentDay += 1;

            uint dailyUBI = calcUBI();
            dailyUBIAmounts[currentDay%7] = dailyUBI;
        }
        lastCalculatedDailyUBI = now;
    }

    function calcFakeDay(uint _userBase, uint _totalClaims, uint _supply) public returns (uint) {
        userBaseHistory[currentDay%30] = _userBase;
        monetaryBaseHistory[currentDay%30] = avatar.nativeToken().totalSupply() + _supply;
        claimsHistory[currentDay%30] = _totalClaims;

        currentDay += 1;

        uint dailyUBI = calcUBI();
        dailyUBIAmounts[currentDay%7] = dailyUBI;
        return dailyUBI;
    }

    function calcUBI() public view returns (uint) {
        (uint sumClaims, uint sumUsers) = getClaimsAndUsersSum(10); //TODO
        uint formulaResult = calcUBIHelper(currentDay, sumClaims, sumUsers, INFLATION); //TODO

        return formulaResult < MINIMUM_UBI ? MINIMUM_UBI : formulaResult;
    }

    function calcUBIHelper(uint _day, uint _sumClaims, uint _sumUsers, uint _inflation) public view returns ( uint ) {
        uint baseN = 100 + _inflation;
        uint32 expN = uint32(_day);
        //1.1^(t/365)
        (uint res, uint8 precision) = formula.power(baseN, BASE_D, expN, EXP_D);

        uint Mt = monetaryBaseHistory[(_day - 1)%30] * (10**DECIMALS);
        uint Nt = userBaseHistory[(_day -1)%30];

        uint lWad = (_sumClaims == 0 || _sumUsers == 0) ? 1 * WAD : wdiv(_sumClaims, _sumUsers);

        uint monetaryInflation = (res.mul(Mt) >> precision);
        monetaryInflation = monetaryInflation - Mt;

        uint LtimesNtWad = wmul(lWad, Nt * WAD);

        uint ubiWad = wdiv(monetaryInflation * WAD, LtimesNtWad);

        return ubiWad / WAD;        
    }
}