pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/access/roles/SignerRole.sol";

import "./BancorFormula.sol";
import "./GoodDollar.sol";
import "./IMonetaryPolicy.sol";

contract GoodDollarReserve is IMonetaryPolicy, Ownable, SignerRole {
  using SafeMath for uint256;
  using SafeMath for uint;

  GoodDollar public token;
  BancorFormula public formula;

  // Members
  // =======
  // totalSupply(): The GoodDollar (GTC coins) amount the contract supervise (the whole GTC coins ever exists are documented here). Initiated on "InitialMove()"
  // poolBalance(): The ethers (ETH coins) amount the GoodDollarReserve as a contract has in the accounthas. Initiated in the deployment of the contract.

  // Reserve ratio, represented in value between
  // 1 and 1,000,000. So 0.1 = 100000.
  uint32 public reserveRatio = 10000;

  uint256 public inflationRate = 1;

  //1% tx fee as default
  uint transactionFee = 10000 ;
  uint burnFee = 0;

  constructor(address _token, address _formula, uint32 ratio) public payable {
    reserveRatio = ratio;
    token = GoodDollar(_token);
    formula = BancorFormula(_formula);
  }

  function setFees(uint _txFee, uint _burnFee) external onlySigner {
    transactionFee = _txFee;
    burnFee = _burnFee;
  }

  function calcFees(uint _value) public view returns (uint txFee, uint burn) {
    txFee = _value.mul(transactionFee).div(1000000);
    burn = _value.mul(burnFee).div(1000000);
  }
  function processTX(address _from, address _to, uint256 _value) external returns (uint txFee, uint burn) {
    return calcFees(_value);
  }

  // The etherium amount the GoodDollarReserve has. Initiated in the deployment of the contract.
  function poolBalance() public view returns(uint256) {
    return address(this).balance;
  }

  function calculateAmountPurchased(uint256 _eth) public view returns(uint256) {
    uint256 tokensForPrice = formula.calculatePurchaseReturn(
        totalSupply(),
        poolBalance(),
        reserveRatio,
        _eth
    );

    return tokensForPrice;
  }

  function calculatePriceForSale(uint256 _sellAmount) public view returns(uint256) {
    uint256 ethAmount = formula.calculateSaleReturn(
        totalSupply(),
        poolBalance(),
        reserveRatio,
        _sellAmount
    );

    return ethAmount;
  }

  function buy() public payable returns(bool) {
    require(msg.value > 0,"value can't be 0");
    uint256 tokensToMint = formula.calculatePurchaseReturn(
        totalSupply(),

        // the function is payable. Means the money sent was *already reflected* in the poolBalance! (eth)
        // But the user requested to buy according to the amount of poolBalance before he/she made the payment and changeed the formula
          //when purchasing with eth the poolbalance is changed before this calculation

        //so we have to consider this
        poolBalance()-msg.value,
        reserveRatio,
        msg.value
    );
    token.mint(msg.sender, tokensToMint);

    return true;
  }

  function sell(uint256 _sellAmount) public returns(bool){
    require(_sellAmount > 0 && token.balanceOf(msg.sender) >= _sellAmount, "Not enough balance or amount 0");
    uint256 ethAmount = formula.calculateSaleReturn(
        totalSupply(),
        poolBalance(),
        reserveRatio,
        _sellAmount
    );

    token.burn(_sellAmount);
    msg.sender.transfer(ethAmount);

    return true;
  }

  function totalSupply() public view returns (uint256) {
    return token.totalSupply();
  }

  function mint(
    address _account,
    uint256 _amount
  ) onlyOwner public returns (bool) {
    token.mint(_account, _amount);

    return true;
  }
}
