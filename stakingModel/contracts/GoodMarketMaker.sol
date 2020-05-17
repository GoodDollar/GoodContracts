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

    event BalancesUpdated(address indexed caller,
                          address indexed reserveToken,
                          uint256 amount,
                          uint256 returnAmount,
                          uint256 totalSupply,
                          uint256 reserveBalance);

    event ReserveRatioUpdated(address indexed caller,
                              uint256 nom,
                              uint256 denom);

    event InterestMinted(address indexed caller,
                         address indexed reserveToken,
                         uint256 addInterest,
                         uint256 oldSupply,
                         uint256 mint);

    event UBIExpansionMinted(address indexed caller,
                             address indexed reserveToken,
                             uint256 oldReserveRatio,
                             uint256 oldSupply,
                             uint256 mint);

    uint32 public reserveRatio = 1e6;

    uint256 public reserveRatioDailyExpansion;

    constructor(
        address _gooddollar,
        address _owner,
        uint256 _nom,
        uint256 _denom,
        address payable _avatar
    ) public SchemeGuard(Avatar(_avatar)) {
        gooddollar = ERC20Detailed(_gooddollar);
        reserveRatioDailyExpansion = rdiv(_nom, _denom);
        transferOwnership(_owner);
    }

    modifier onlyActiveToken(ERC20 _token) {
        ReserveToken storage rtoken = reserveTokens[address(_token)];
        require(rtoken.gdSupply > 0, "Reserve token not initialized");
        _;
    }

    /**
    @dev allow the DAO to change the daily expansion rate
    it is calculated by _nom/_denom with e27 precision
    @param _nom the nominator
    @param _denom the denominator
    */
    function setReserveRatioDailyExpansion(uint256 _nom, uint256 _denom)
        public
        onlyAvatar
    {
        reserveRatioDailyExpansion = rdiv(_nom, _denom);
        emit ReserveRatioUpdated(msg.sender, _nom, _denom);
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
    @dev calculate how much decrease the reserve ratio for _token by the
    reserveRatioDailyExpansion
    @param _token he token to calculate the reserve ratio for
    @return the new reserve ratio
     */
    function calculateNewReserveRatio(ERC20 _token)
        public
        view
        onlyActiveToken(_token)
        returns (uint32)
    {
        ReserveToken memory reserveToken = reserveTokens[address(_token)];
        uint32 ratio = reserveToken.reserveRatio;
        if (ratio == 0) {
            ratio = 1e6;
        }
        return uint32(
            rmul(
                uint256(ratio) * 1e21, //expand to e27 precision
                reserveRatioDailyExpansion
            )
                .div(1e21) //return to e6 precision
        );
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
        uint32 ratio = reserveToken.reserveRatio;
        if (ratio == 0) {
            ratio = 1e6;
        }
        reserveToken.reserveRatio = calculateNewReserveRatio(_token);
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
        rtoken.gdSupply = rtoken.gdSupply.add(gdReturn);
        rtoken.reserveSupply = rtoken.reserveSupply.add(_tokenAmount);
        emit BalancesUpdated(msg.sender,
                             address(_token),
                             _tokenAmount,
                             gdReturn,
                             rtoken.gdSupply,
                             rtoken.reserveSupply);
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
        ReserveToken storage rtoken = reserveTokens[address(_token)];
        require(rtoken.gdSupply > _gdAmount, "GD amount is higher than the total supply");
        uint256 tokenReturn = sellReturn(_token, _gdAmount);
        rtoken.gdSupply = rtoken.gdSupply.sub(_gdAmount);
        rtoken.reserveSupply = rtoken.reserveSupply.sub(tokenReturn);
        emit BalancesUpdated(msg.sender,
                             address(_token),
                             _gdAmount,
                             tokenReturn,
                             rtoken.gdSupply,
                             rtoken.reserveSupply);
        return tokenReturn;
    }

    /**
    @dev calculate the sell return with contribution in _token and update the bonding curve params
    @param _token the token buying for G$s
    @param _gdAmount the amount of G$ sold
    @return number of tokens that will be given in exchange as calculated by the bonding curve
    */
    function sellWithContribution(ERC20 _token, uint256 _gdAmount, uint256 _contributionGdAmount)
        public
        onlyOwner
        onlyActiveToken(_token)
        returns (uint256)
    {
        require(_gdAmount >= _contributionGdAmount, "GD amount is lower than the contribution amount");
        ReserveToken storage rtoken = reserveTokens[address(_token)];
        require(rtoken.gdSupply > _gdAmount, "GD amount is higher than the total supply");
        uint256 amountAfterContribution = _gdAmount.sub(_contributionGdAmount);
        uint256 tokenReturn = sellReturn(_token, amountAfterContribution);
        rtoken.gdSupply = rtoken.gdSupply.sub(_gdAmount);
        rtoken.reserveSupply = rtoken.reserveSupply.sub(tokenReturn);
        emit BalancesUpdated(msg.sender,
                             address(_token),
                             _contributionGdAmount,
                             tokenReturn,
                             rtoken.gdSupply,
                             rtoken.reserveSupply);
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
                (10**uint256(gooddollar.decimals()))
            );
    }

    //TODO: need real calculation and tests
    /**
    @dev calculate how much G$ to mint based on added token supply (from interest)
    and on current reserve ratio, in order to keep G$ price the same at the bonding curve
    formula to calculate the gd to mint: gd to mint =
    addreservebalance * (gdsupply / (reservebalance * reserveratio))
    @param _token the reserve token
    @param _addTokenSupply amount of token added to supply
    @return how much to mint in order to keep price in bonding curve the same
     */
    function calculateMintInterest(ERC20 _token, uint256 _addTokenSupply)
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
    function mintInterest(ERC20 _token, uint256 _addTokenSupply)
        public
        onlyOwner
        returns (uint256)
    {
        require(_addTokenSupply > 0, "added supply must be above 0");
        uint256 toMint = calculateMintInterest(_token, _addTokenSupply);
        ReserveToken storage reserveToken = reserveTokens[address(_token)];
        uint256 gdSupply = reserveToken.gdSupply;
        uint256 reserveBalance = reserveToken.reserveSupply;
        reserveToken.gdSupply = gdSupply.add(toMint);
        reserveToken.reserveSupply = reserveBalance.add(_addTokenSupply);
        emit InterestMinted(msg.sender, address(_token), _addTokenSupply, gdSupply, toMint);
        return toMint;
    }

    /**
    @dev calculate how much G$ to mint based on expansion change (new reserve
    ratio), in order to keep G$ price the same at the bonding curve. the
    formula to calculate the gd to mint: gd to mint =
    (reservebalance / (newreserveratio * currentprice)) - gdsupply
    @param _token the reserve token
    @return how much to mint in order to keep price in bonding curve the same
     */
    function calculateMintExpansion(ERC20 _token)
        public
        view
        onlyActiveToken(_token)
        returns (uint256)
    {
        ReserveToken memory reserveToken = reserveTokens[address(_token)];
        uint32 newReserveRatio = calculateNewReserveRatio(_token); // new reserve ratio
        uint256 reserveDecimalsDiff = uint256(
                uint256(27)
                .sub(ERC20Detailed(address(_token)).decimals())
            ); // //result is in RAY precision
        uint256 denom = rmul(
                uint256(newReserveRatio).mul(1e21),
                currentPrice(_token).mul(10**reserveDecimalsDiff)
            ); // (newreserveratio * currentprice) in RAY precision
        uint256 gdDecimalsDiff = uint256(27).sub(uint256(gooddollar.decimals()));
        uint256 toMint = rdiv(
                reserveToken.reserveSupply.mul(10**reserveDecimalsDiff), // reservebalance in RAY precision
                denom
            ).div(10**gdDecimalsDiff); // return to gd precision
        return toMint.sub(reserveToken.gdSupply);
    }

    /**
    @dev update bonding curve based on expansion change and new minted amount
    @param _token the reserve token
    @return how much to mint in order to keep price in bonding curve the same
     */
    function mintExpansion(ERC20 _token)
        public
        onlyOwner
        returns (uint256)
    {
        uint256 toMint = calculateMintExpansion(_token);
        ReserveToken storage reserveToken = reserveTokens[address(_token)];
        uint256 gdSupply = reserveToken.gdSupply;
        uint256 ratio = reserveToken.reserveRatio;
        reserveToken.gdSupply = gdSupply.add(toMint);
        expandReserveRatio(_token);
        emit UBIExpansionMinted(msg.sender, address(_token), ratio, gdSupply, toMint);
        return toMint;
    }
}
