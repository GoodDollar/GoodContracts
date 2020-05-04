pragma solidity 0.5.4;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/SchemeGuard.sol";
import "./GoodMarketMaker.sol";
import "./GoodReserveCDai.sol";
import "../../contracts/DSMath.sol";
import "../../contracts/token/GoodDollar.sol";

/* @title Contribution calculation for selling gd tokens
 */
contract ContributionCalculation is DSMath, SchemeGuard {
    using SafeMath for uint256;

    GoodDollar public gooddollar;
    GoodMarketMaker public marketMaker;
    GoodReserveCDai public reserve;
    uint256 public sellContributionRatio;

    event SellContributionRatioUpdated(address indexed caller,
                                       uint256 nom,
                                       uint256 denom);

    constructor(
        Avatar _avatar,
        address _gooddollar,
        uint256 _nom,
        uint256 _denom
    )
        public
        SchemeGuard(_avatar)
    {
        gooddollar = GoodDollar(_gooddollar);
        sellContributionRatio = rdiv(_nom, _denom);
    }

    /**
     * @dev sets the marketMaker
     * @param _marketMaker contract
     */
    function setMarketMaker(GoodMarketMaker _marketMaker) public onlyAvatar {
        marketMaker = _marketMaker;
    }

    /**
     * @dev sets the reserve
     * @param _reserve contract
     */
    function setReserve(GoodReserveCDai _reserve) public onlyAvatar {
        reserve = _reserve;
    }

    /**
    @dev allow the DAO to change the sell contribution rate
    it is calculated by _nom/_denom with e27 precision
    @param _nom the nominator
    @param _denom the denominator
    */
    function setContributionRatio(uint256 _nom, uint256 _denom)
        external
        onlyAvatar
    {
        sellContributionRatio = rdiv(_nom, _denom);
        emit SellContributionRatioUpdated(msg.sender, _nom, _denom);
    }

    /**
    * @dev calculate the contribution amount during the sell action. there is a
    * `sellContributionRatio` percent contribution
    * @return (contributionAmount) the contribution amount for sell
    */
    function calculateContribution(ERC20 token, uint256 gdAmount)
        external
        view
        returns (uint256)
    {
        uint256 decimalsDiff = uint256(27).sub(uint256(gooddollar.decimals()));
        uint256 contribution =
        rmul(
                gdAmount.mul(10**decimalsDiff), // expand to e27 precision
                sellContributionRatio
            )
                .div(10**decimalsDiff); // return to e2 precision
        require(gdAmount > contribution, "Calculation error");
        return gdAmount.sub(contribution);
    }
 }