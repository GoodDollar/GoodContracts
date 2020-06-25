pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/token/GoodDollar.sol";
import "../../contracts/dao/schemes/SchemeGuard.sol";
import "../../contracts/DSMath.sol";
import "./BancorFormula.sol";


/**
@title Dynamic reserve ratio market maker
*/
contract GoodMarketMaker is BancorFormula, DSMath, SchemeGuard {
    using SafeMath for uint256;

    // For calculate the return value on buy and sell
    BancorFormula bancor;

    // Entity that holds a reserve token
    struct ReserveToken {
        // Determines the reserve token balance
        // that the reserve contract holds
        uint256 reserveSupply;
        // Determines the current ratio between
        // the reserve token and the GD token
        uint32 reserveRatio;
        // How many GD tokens have been minted
        // against that reserve token
        uint256 gdSupply;
    }

    // The map which holds the reserve token entities
    mapping(address => ReserveToken) public reserveTokens;

    // Emits when a change has occurred in a
    // reserve balance, i.e. buy / sell will
    // change the balance
    event BalancesUpdated(
        // The account who initiated the action
        address indexed caller,
        // The address of the reserve token
        address indexed reserveToken,
        // The incoming amount
        uint256 amount,
        // The return value
        uint256 returnAmount,
        // The updated total supply
        uint256 totalSupply,
        // The updated reserve balance
        uint256 reserveBalance
    );

    // Emits when the ratio changed. The caller should be the Avatar by definition
    event ReserveRatioUpdated(address indexed caller, uint256 nom, uint256 denom);

    // Emits when new tokens should be minted
    // as a result of incoming interest.
    // That event will be emitted after the
    // reserve entity has been updated
    event InterestMinted(
        // The account who initiated the action
        address indexed caller,
        // The address of the reserve token
        address indexed reserveToken,
        // How much new reserve tokens been
        // added to the reserve balance
        uint256 addInterest,
        // The GD supply in the reserve entity
        // before the new minted GD tokens were
        // added to the supply
        uint256 oldSupply,
        // The number of the new minted GD tokens
        uint256 mint
    );

    // Emits when new tokens should be minted
    // as a result of a reserve ratio expansion
    // change. This change should have occurred
    // on a regular basis. That event will be
    // emitted after the reserve entity has been
    // updated
    event UBIExpansionMinted(
        // The account who initiated the action
        address indexed caller,
        // The address of the reserve token
        address indexed reserveToken,
        // The reserve ratio before the expansion
        uint256 oldReserveRatio,
        // The GD supply in the reserve entity
        // before the new minted GD tokens were
        // added to the supply
        uint256 oldSupply,
        // The number of the new minted GD tokens
        uint256 mint
    );

    // Defines the daily change in the reserve ratio in RAY precision.
    // In the current release, only global ratio expansion is supported.
    // That will be a part of each reserve token entity in the future.
    uint256 public reserveRatioDailyExpansion;

    /**
     * @dev Constructor
     * @param _avatar The avatar of the DAO
     * @param _nom The numerator to calculate the global `reserveRatioDailyExpansion` from
     * @param _denom The denominator to calculate the global `reserveRatioDailyExpansion` from
     */
    constructor(
        Avatar _avatar,
        uint256 _nom,
        uint256 _denom
    ) public SchemeGuard(_avatar) {
        reserveRatioDailyExpansion = rdiv(_nom, _denom);
    }

    modifier onlyActiveToken(ERC20 _token) {
        ReserveToken storage rtoken = reserveTokens[address(_token)];
        require(rtoken.gdSupply > 0, "Reserve token not initialized");
        _;
    }

    /**
    * @dev Allows the DAO to change the daily expansion rate
    * it is calculated by _nom/_denom with e27 precision. Emits
    * `ReserveRatioUpdated` event after the ratio has changed.
    * Only Avatar can call this method.
    * @param _nom The numerator to calculate the global `reserveRatioDailyExpansion` from
    * @param _denom The denominator to calculate the global `reserveRatioDailyExpansion` from
    */
    function setReserveRatioDailyExpansion(uint256 _nom, uint256 _denom)
        public
        onlyAvatar
    {
        reserveRatioDailyExpansion = rdiv(_nom, _denom);
        emit ReserveRatioUpdated(msg.sender, _nom, _denom);
    }

    // NOTICE: In the current release, if there is a wish to add another reserve token,
    //  `end` method in the reserve contract should be called first. Then, the DAO have
    //  to deploy a new reserve contract that will own the market maker. A scheme for
    // updating the new reserve must be deployed too.

    /**
    * @dev Initialize a reserve token entity with the given parameters
    * @param _token The reserve token
    * @param _gdSupply Initial supply of GD to set the price
    * @param _tokenSupply Initial supply of reserve token to set the price
    * @param _reserveRatio The starting reserve ratio
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
    * @dev Calculates how much to decrease the reserve ratio for _token by
    * the `reserveRatioDailyExpansion`
    * @param _token The reserve token to calculate the reserve ratio for
    * @return The new reserve ratio
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
        return
            uint32(
                rmul(
                    uint256(ratio) * 1e21, // expand to e27 precision
                    reserveRatioDailyExpansion
                )
                    .div(1e21) // return to e6 precision
            );
    }

    /**
    * @dev Decreases the reserve ratio for _token by the `reserveRatioDailyExpansion`
    * @param _token The token to change the reserve ratio for
    * @return The new reserve ratio
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
    * @dev Calculates the buy return in GD according to the given _tokenAmount
    * @param _token The reserve token buying with
    * @param _tokenAmount The amount of reserve token buying with
    * @return Number of GD that should be given in exchange as calculated by the bonding curve
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
    * @dev Calculates the sell return in _token according to the given _gdAmount
    * @param _token The desired reserve token to have
    * @param _gdAmount The amount of GD that are sold
    * @return Number of tokens that should be given in exchange as calculated by the bonding curve
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
    * @dev Updates the _token bonding curve params. Emits `BalancesUpdated` with the
    * new reserve token information.
    * @param _token The reserve token buying with
    * @param _tokenAmount The amount of reserve token buying with
    * @return (gdReturn) Number of GD that will be given in exchange as calculated by the bonding curve
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
        emit BalancesUpdated(
            msg.sender,
            address(_token),
            _tokenAmount,
            gdReturn,
            rtoken.gdSupply,
            rtoken.reserveSupply
        );
        return gdReturn;
    }

    /**
    * @dev Updates the _token bonding curve params. Emits `BalancesUpdated` with the
    * new reserve token information.
    * @param _token The desired reserve token to have
    * @param _gdAmount The amount of GD that are sold
    * @return Number of tokens that will be given in exchange as calculated by the bonding curve
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
        emit BalancesUpdated(
            msg.sender,
            address(_token),
            _gdAmount,
            tokenReturn,
            rtoken.gdSupply,
            rtoken.reserveSupply
        );
        return tokenReturn;
    }

    /**
    * @dev Calculates the sell return with contribution in _token and update the bonding curve params.
    * Emits `BalancesUpdated` with the new reserve token information.
    * @param _token The desired reserve token to have
    * @param _gdAmount The amount of GD that are sold
    * @param _contributionGdAmount The number of GD tokens that will not be traded for the reserve token
    * @return Number of tokens that will be given in exchange as calculated by the bonding curve
    */
    function sellWithContribution(
        ERC20 _token,
        uint256 _gdAmount,
        uint256 _contributionGdAmount
    ) public onlyOwner onlyActiveToken(_token) returns (uint256) {
        require(
            _gdAmount >= _contributionGdAmount,
            "GD amount is lower than the contribution amount"
        );
        ReserveToken storage rtoken = reserveTokens[address(_token)];
        require(rtoken.gdSupply > _gdAmount, "GD amount is higher than the total supply");

        // Deduces the convertible amount of GD tokens by the given contribution amount
        uint256 amountAfterContribution = _gdAmount.sub(_contributionGdAmount);

        // The return value after the deduction
        uint256 tokenReturn = sellReturn(_token, amountAfterContribution);
        rtoken.gdSupply = rtoken.gdSupply.sub(_gdAmount);
        rtoken.reserveSupply = rtoken.reserveSupply.sub(tokenReturn);
        emit BalancesUpdated(
            msg.sender,
            address(_token),
            _contributionGdAmount,
            tokenReturn,
            rtoken.gdSupply,
            rtoken.reserveSupply
        );
        return tokenReturn;
    }

    /**
    * @dev Current price of GD in `token`. currently only cDAI is supported.
    * @param _token The desired reserve token to have
    * @return price of GD
    */
    function currentPrice(ERC20 _token)
        public
        view
        onlyActiveToken(_token)
        returns (uint256)
    {
        ReserveToken memory rtoken = reserveTokens[address(_token)];
        require(rtoken.gdSupply > 0, "Reserve token not initialized");
        GoodDollar gooddollar = GoodDollar(address(avatar.nativeToken()));
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
    * @dev Calculates how much G$ to mint based on added token supply (from interest)
    * and on current reserve ratio, in order to keep G$ price the same at the bonding curve
    * formula to calculate the gd to mint: gd to mint =
    * addreservebalance * (gdsupply / (reservebalance * reserveratio))
    * @param _token the reserve token
    * @param _addTokenSupply amount of token added to supply
    * @return how much to mint in order to keep price in bonding curve the same
    */
    function calculateMintInterest(ERC20 _token, uint256 _addTokenSupply)
        public
        view
        onlyActiveToken(_token)
        returns (uint256)
    {
        GoodDollar gooddollar = GoodDollar(address(avatar.nativeToken()));
        uint256 decimalsDiff = uint256(27).sub(uint256(gooddollar.decimals()));
        //resulting amount is in RAY precision
        //we divide by decimalsdiff to get precision in GD (2 decimals)
        return rdiv(_addTokenSupply, currentPrice(_token)).div(10**decimalsDiff);
    }

    /**
    * @dev Updates bonding curve based on _addTokenSupply and new minted amount
    * @param _token The reserve token
    * @param _addTokenSupply Amount of token added to supply
    * @return How much to mint in order to keep price in bonding curve the same
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
        emit InterestMinted(
            msg.sender,
            address(_token),
            _addTokenSupply,
            gdSupply,
            toMint
        );
        return toMint;
    }

    /**
    * @dev Calculate how much G$ to mint based on expansion change (new reserve
    * ratio), in order to keep G$ price the same at the bonding curve. the
    * formula to calculate the gd to mint: gd to mint =
    * (reservebalance / (newreserveratio * currentprice)) - gdsupply
    * @param _token The reserve token
    * @return How much to mint in order to keep price in bonding curve the same
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
            uint256(27).sub(ERC20Detailed(address(_token)).decimals())
        ); // //result is in RAY precision
        uint256 denom = rmul(
            uint256(newReserveRatio).mul(1e21),
            currentPrice(_token).mul(10**reserveDecimalsDiff)
        ); // (newreserveratio * currentprice) in RAY precision
        GoodDollar gooddollar = GoodDollar(address(avatar.nativeToken()));
        uint256 gdDecimalsDiff = uint256(27).sub(uint256(gooddollar.decimals()));
        uint256 toMint = rdiv(
            reserveToken.reserveSupply.mul(10**reserveDecimalsDiff), // reservebalance in RAY precision
            denom
        )
            .div(10**gdDecimalsDiff); // return to gd precision
        return toMint.sub(reserveToken.gdSupply);
    }

    /**
    * @dev Updates bonding curve based on expansion change and new minted amount
    * @param _token The reserve token
    * @return How much to mint in order to keep price in bonding curve the same
    */
    function mintExpansion(ERC20 _token) public onlyOwner returns (uint256) {
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
