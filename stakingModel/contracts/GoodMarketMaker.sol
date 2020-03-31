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

    //TODO: this should probably be moved to the Reserve
    mapping(address => ReserveToken) public reserveTokens;

    uint32 public reserveRatio = 1e6;

    uint256 public reserveRatioDailyExpansion = rdiv(999388834642296, 1e15); //20% yearly
    //second day RR 99.9388834642296 = 999388
    //3rd day RR 99.9388 * 0.999388834642296 = 998777

    constructor(
        address _gooddollar,
        address _owner
    ) public SchemeGuard(Avatar(0)) {
        gooddollar = ERC20Detailed(_gooddollar);
        transferOwnership(_owner);
    }

    modifier onlyActiveToken(ERC20 _token) {
        ReserveToken storage rtoken = reserveTokens[address(_token)];
        require(rtoken.gdSupply > 0, "Reserve token not initialized");
        _;
    }

    /**
    @dev allow the DAO to change the daily expansion rate, defaults at 20% yearly
    it is calculated by _nom/_denom with e27 precision
    @param _nom the nominator
    @param _denom the denominator
    */
    function setReserveRatioDailyExpansion(uint256 _nom, uint256 _denom)
        public
        onlyAvatar
    {
        reserveRatioDailyExpansion = rdiv(_nom, _denom);
    }

    /**
    @dev initialize a token with basic parameters
    @param _token the reserve token
    @param _gdSupply initial supply of GoodDollars to set the price
    @param _tokenSupply initial supply of token to set the price
    @param _reserveRatio the starting reserve ratio
    */
    function initializeToken(
        ERC20 _token,
        uint256 _gdSupply,
        uint256 _tokenSupply,
        uint32 _reserveRatio
    ) public onlyOwner {
        reserveTokens[address(_token)] = ReserveToken({
            gdSupply: _gdSupply,
            reserveSupply: _tokenSupply,
            reserveRatio: _reserveRatio
        });

    }

    /**
    @dev decrease the reserve ratio for _token by the reserveRatioDailyExpansion
    @param _token the token to change the reserve ratio for
    @return the new reserve ratio
    */
    function expandReserveRatio(ERC20 _token)
        public
        onlyOwner
        onlyActiveToken(_token)
        returns (uint32)
    {
        ReserveToken storage reserveToken = reserveTokens[address(_token)];
        if (reserveToken.reserveRatio == 0) {
            reserveToken.reserveRatio = 1e6;
        }
        reserveToken.reserveRatio = uint32(
            rmul(
                uint256(reserveToken.reserveRatio) * 1e21, //expand to e27 precision
                reserveRatioDailyExpansion
            )
                .div(1e21) //return to e6 precision
        );
        return reserveToken.reserveRatio;
    }

    /**
    @dev calculate the buy return in G$
    @param _token the token buying with
    @param _tokenAmount the amount of tokens sold
    @return number of G$ that will be given in exchange as calculated by the bonding curve
    */
    function buyReturn(ERC20 _token, uint256 _tokenAmount)
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
                _tokenAmount
            );
    }

    /**
    @dev calculate the sell return in _token
    @param _token the token buying for G$s
    @param _gdAmount the amount of G$ sold
    @return number of tokens that will be given in exchange as calculated by the bonding curve
    */
    function sellReturn(ERC20 _token, uint256 _gdAmount)
        public
        view
        onlyActiveToken(_token)
        returns (uint256)
    {
        ReserveToken memory rtoken = reserveTokens[address(_token)];
        return
            calculateSaleReturn(
                rtoken.gdSupply,
                rtoken.reserveSupply,
                rtoken.reserveRatio,
                _gdAmount
            );
    }

    /**
    @dev calculate the buy return in G$ and update the bonding curve params
    @param _token the token buying with
    @param _tokenAmount the amount of tokens sold
    @return number of G$ that will be given in exchange as calculated by the bonding curve
    */
    function buy(ERC20 _token, uint256 _tokenAmount)
        public
        onlyOwner
        onlyActiveToken(_token)
        returns (uint256)
    {
        uint256 gdReturn = buyReturn(_token, _tokenAmount);
        ReserveToken storage rtoken = reserveTokens[address(_token)];
        rtoken.gdSupply += gdReturn;
        rtoken.reserveSupply += _tokenAmount;
        return gdReturn;
    }

    /**
    @dev calculate the sell return in _token and update the bonding curve params
    @param _token the token buying for G$s
    @param _gdAmount the amount of G$ sold
    @return number of tokens that will be given in exchange as calculated by the bonding curve
    */
    function sell(ERC20 _token, uint256 _gdAmount)
        public
        onlyOwner
        onlyActiveToken(_token)
        returns (uint256)
    {
        uint256 tokenReturn = sellReturn(_token, _gdAmount);

        ReserveToken storage rtoken = reserveTokens[address(_token)];
        rtoken.gdSupply -= _gdAmount;
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
    }

    //TODO: need real calculation
    /**
    @dev calculate how much G$ to mint based on added token supply (from interest)
    and on current reserve ratio, in order to keep G$ price the same at the bonding curve
    @param _token the reserve token
    @param _addTokenSupply amount of token added to supply
    @return how much to mint in order to keep price in bonding curve the same
     */
    function calculateToMint(ERC20 _token, uint256 _addTokenSupply)
        public
        view
        onlyActiveToken(_token)
        returns (uint256)
    {
        uint256 decimalsDiff = uint256(27).sub(uint256(gooddollar.decimals()));
        //resulting amount is in RAY precision
        //we divide by decimalsdiff to get precision in GD (2 decimals)
        return
            rdiv(_addTokenSupply, currentPrice(_token)).div(10**decimalsDiff);
    }

    /**
    @dev update bonding curve based on added supply and new minted amount
    @param _token the reserve token
    @param _addTokenSupply amount of token added to supply
    @return how much to mint in order to keep price in bonding curve the same
     */

    function mint(ERC20 _token, uint256 _addTokenSupply) public onlyOwner {
        uint256 tomint = calculateToMint(_token, _addTokenSupply);
    }
}
