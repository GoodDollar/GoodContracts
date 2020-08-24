pragma solidity 0.5.4;

import "../GoodMarketMaker.sol";

contract GoodMarketMakerMock is GoodMarketMaker {


    constructor(
        Avatar _avatar,
        uint256 _nom,
        uint256 _denom
    ) public GoodMarketMaker(_avatar, _nom, _denom) {
    }

  // function currentPrice(ERC20 _token)
  //       public
  //       view
  //       returns (uint256)
  //   {
        
  //       return 500000;
  //   }

  function resetGDRate(ERC20 _token)
        public
        returns (uint32)
    {
        ReserveToken storage  reserveToken = reserveTokens[address(_token)];
        reserveToken.reserveSupply = 500000;
        reserveToken.reserveRatio = 1000000;
        reserveToken.gdSupply = 100;
    }


    
}