pragma solidity >0.5.4;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/SchemeGuard.sol";
import "./GoodMarketMaker.sol";
import "./GoodReserveCDai.sol";
import "../../contracts/DSMath.sol";

/* @title Contribution calculation for selling gd tokens
 */
contract ContributionCalculation is DSMath, SchemeGuard {
    using SafeMath for uint256;

    // The contribution ratio, declares how much
    // to contribute from the given amount
    uint256 public sellContributionRatio;

    // Emits when the contribution ratio is updated
    event SellContributionRatioUpdated(
        address indexed caller,
        uint256 nom,
        uint256 denom
    );

    /**
     * @dev Constructor
     * @param _avatar The avatar of the DAO
     * @param _nom The numerator to calculate the contribution ratio from
     * @param _denom The denominator to calculate the contribution ratio from
     */
    constructor(
        Avatar _avatar,
        uint256 _nom,
        uint256 _denom
    ) public SchemeGuard(_avatar) {
        sellContributionRatio = rdiv(_nom, _denom);
    }

    /**
     * @dev Allow the DAO to change the sell contribution rate
     * it is calculated by _nom/_denom with e27 precision. Emits
     * that the contribution ratio was updated.
     * @param _nom the nominator
     * @param _denom the denominator
     */
    function setContributionRatio(uint256 _nom, uint256 _denom) external onlyAvatar {
        require(_denom > 0, "denominator must be above 0");
        sellContributionRatio = rdiv(_nom, _denom);
        emit SellContributionRatioUpdated(msg.sender, _nom, _denom);
    }

    /**
     * @dev Calculate the amount after contribution during the sell action. There is a
     * `sellContributionRatio` percent contribution
     * @param _marketMaker The market maker address
     * @param _reserve The reserve address
     * @param _contributer The contributer address
     * @param _token The token to convert from
     * @param _gdAmount The total GD amount to contribute from
     * @return (contributionAmount) The contribution amount for sell
     */
    function calculateContribution(
        GoodMarketMaker _marketMaker,
        GoodReserveCDai _reserve,
        address _contributer,
        ERC20 _token,
        uint256 _gdAmount
    ) external view returns (uint256) {
        uint256 decimalsDiff = uint256(27).sub(2); // 2 gooddollar decimals
        uint256 contributionAmount = rmul(
            _gdAmount.mul(10**decimalsDiff), // expand to e27 precision
            sellContributionRatio
        )
            .div(10**decimalsDiff); // return to e2 precision
        require(_gdAmount > contributionAmount, "Calculation error");
        return contributionAmount;
    }
}
