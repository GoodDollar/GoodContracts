pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/SchemeGuard.sol";
import "../../contracts/DSMath.sol";
import "./BancorFormula.sol";

/**
@title Dynamic reserve ratio market maker
*/
contract GoodMarketMaker is BancorFormula, DSMath, SchemeGuard {
    using SafeMath for uint256;

    ERC20Detailed gooddollar;
    BancorFormula bancor;
    struct ReserveToken {
        uint256 reserveSupply;
        uint32 reserveRatio;
        uint256 gdSupply;
    }

    mapping(address => ReserveToken) public reserveTokens;

    uint32 public reserveRatio = 1e6;
    uint32 public constant MAX_RATIO = 1e6;
    uint256 public reserveRatioDailyExpansion = rdiv(999388834642296, 1e15); //20% yearly
    //second day RR 99.9388834642296 = 999388
    //3rd day RR 99.9388 * 0.999388834642296 = 998777

    constructor(address _gooddollar, address _reserve)
        public
        SchemeGuard(Avatar(0))
    {
        gooddollar = ERC20Detailed(_gooddollar);
        transferOwnership(_reserve);
    }

    modifier onlyActiveToken(ERC20 _token) {
        ReserveToken storage rtoken = reserveTokens[address(_token)];
        require(rtoken.gdSupply > 0, "Reserve token not initialized");
        _;
    }

    function initializeToken(
        ERC20 token,
        uint256 _gdSupply,
        uint256 _tokenSupply,
        uint32 _reserveRatio
    ) public onlyOwner {
        reserveTokens[address(token)] = ReserveToken({
            gdSupply: _gdSupply,
            reserveSupply: _tokenSupply,
            reserveRatio: _reserveRatio
        });

    }
    function expandReserveRatio(ERC20 _token)
        public
        onlyOwner
        returns (uint32)
    {
        ReserveToken storage reserveToken = reserveTokens[address(_token)];
        if (reserveToken.reserveRatio == 0) {
            reserveToken.reserveRatio = 1e6;
        }
        reserveToken.reserveRatio = uint32(
            rmul(
                uint256(reserveToken.reserveRatio) * 1e21,
                reserveRatioDailyExpansion
            )
                .div(1e21)
        );
        return reserveToken.reserveRatio;
    }

    function buyReturn(ERC20 _token, uint256 tokenAmount)
        public
        view
        onlyActiveToken(_token)
        returns (uint256)
    {
        ReserveToken memory rtoken = reserveTokens[address(_token)];
        return
            calculatePurchaseReturn(
                rtoken.gdSupply,
                rtoken.reserveSupply,
                rtoken.reserveRatio,
                tokenAmount
            );
    }

    function sellReturn(ERC20 _token, uint256 gdAmount)
        public
        view
        onlyActiveToken(_token)
        returns (uint256)
    {
        ReserveToken memory rtoken = reserveTokens[address(_token)];
        return
            calculateSellReturn(
                rtoken.gdSupply,
                rtoken.reserveSupply,
                rtoken.reserveRatio,
                gdAmount
            );
    }

    function buyUpdate(ERC20 _token, uint256 tokenAmount)
        public
        onlyOwner
        onlyActiveToken(_token)
        returns (uint256)
    {
        uint256 gdReturn = buyReturn(_token, tokenAmount);
        ReserveToken storage rtoken = reserveTokens[address(_token)];
        rtoken.gdSupply += gdReturn;
        rtoken.reserveSupply += tokenAmount;
        return gdReturn;
    }

    function sellUpdate(ERC20 _token, uint256 gdSold)
        public
        onlyOwner
        onlyActiveToken(_token)
        returns (uint256)
    {
        uint256 tokenReturn = sellReturn(_token, gdSold);

        ReserveToken storage rtoken = reserveTokens[address(_token)];
        rtoken.gdSupply -= gdBurned;
        rtoken.reserveSupply -= tokenReturn;
        return tokenReturn;
    }

    /**
    @dev current price of G$ in `token` currently only cDAI is supported
    @return price of G$
     */
    function currentPrice(ERC20 _token)
        public
        view
        onlyActiveToken(_token)
        returns (uint256)
    {
        ReserveToken memory rtoken = reserveTokens[address(_token)];
        require(rtoken.gdSupply > 0, "Reserve token not initialized");
        return
            calculateSaleReturn(
                rtoken.gdSupply,
                rtoken.reserveSupply,
                rtoken.reserveRatio,
                uint256(10**gooddollar.decimals())
            );
        // uint256 decimalsDiff = uint256(
        //     ERC20Detailed(address(token)).decimals() / 2
        // );
        // return uint256(10**decimalsDiff);
    }

    function shouldMint(ERC20 token, uint256 addTokenSupply)
        public
        view
        returns (uint256)
    {
        uint256 decimalsDiff = uint256(27).sub(uint256(gooddollar.decimals()));
        //resulting amount is in RAY precision
        //we divide by decimalsdiff to get precision in GD (2 decimals)
        return rdiv(addTokenSupply, currentPrice(token)).div(10**decimalsDiff);
    }
}
