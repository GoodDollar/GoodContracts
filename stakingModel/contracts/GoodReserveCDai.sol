pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/FeelessScheme.sol";
import "../../contracts/dao/schemes/ActivePeriod.sol";
import "../../contracts/DSMath.sol";
import "../../contracts/token/GoodDollar.sol";

import "./GoodMarketMaker.sol";


interface cERC20 {
    function mint(uint256 mintAmount) external returns (uint256);

    function redeemUnderlying(uint256 mintAmount) external returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function balanceOf(address addr) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);
}


interface ContributionCalc {
    function calculateContribution(
        GoodMarketMaker _marketMaker,
        GoodReserveCDai _reserve,
        address _contributer,
        ERC20 _token,
        uint256 _gdAmount
    ) external view returns (uint256);
}


/**
@title Reserve based on cDAI and dynamic reserve ratio market maker
*/
contract GoodReserveCDai is DSMath, FeelessScheme, ActivePeriod {
    using SafeMath for uint256;

    ERC20 dai;

    cERC20 cDai;

    GoodDollar gooddollar;

    GoodMarketMaker public marketMaker;

    Avatar public avatar;

    address public fundManager;

    uint256 public daysFromStart = 0;

    uint256 public sellContributionRatio;

    uint256 public blockInterval;

    uint256 public lastMinted;

    ContributionCalc public contribution;

    modifier onlyFundManager {
        require(msg.sender == fundManager, "Only FundManager can call this method");
        _;
    }

    modifier onlyCDai(ERC20 token) {
        require(address(token) == address(cDai), "Only cDAI is supported");
        _;
    }

    event UBIMinted(
        uint256 indexed day,
        uint256 cDaiValue,
        uint256 daiValue,
        uint256 gdInterest,
        uint256 gdUBI
    );

    event TokenPurchased(
        address indexed caller,
        address indexed reserveToken,
        uint256 reserveAmount,
        uint256 minReturn,
        uint256 actualReturn
    );

    event TokenSold(
        address indexed caller,
        address indexed reserveToken,
        uint256 gdAmount,
        uint256 contributionAmount,
        uint256 minReturn,
        uint256 actualReturn
    );

    event ContributionAddressUpdated(
        address indexed caller,
        address prevAddress,
        address newAddress
    );

    event GDInterestAndExpansionMinted(
        address indexed caller,
        address indexed interestCollector,
        address indexed ubiCollector,
        uint256 gdInterestMinted,
        uint256 gdExpansionMinted,
        uint256 gdInterestTransferred,
        uint256 gdUbiTransferred
    );

    constructor(
        ERC20 _dai,
        cERC20 _cDai,
        GoodDollar _gooddollar,
        address _fundManager,
        Avatar _avatar,
        Identity _identity,
        address _marketMaker,
        ContributionCalc _contribution,
        uint256 _blockInterval
    ) public FeelessScheme(_identity, _avatar) ActivePeriod(now, now * 2, _avatar) {
        dai = _dai;
        cDai = _cDai;
        gooddollar = _gooddollar;
        avatar = _avatar;
        fundManager = _fundManager;
        marketMaker = GoodMarketMaker(_marketMaker);
        blockInterval = _blockInterval;
        contribution = _contribution;
    }

    /* @dev Start function. Adds this contract to identity as a feeless scheme.
     * Can only be called if scheme is registered
     */
    function start() public onlyRegistered {
        addRights();
        controller.genericCall(
            address(gooddollar),
            abi.encodeWithSignature("addMinter(address)", address(this)),
            avatar,
            0
        );
        super.start();
    }

    /**
    @dev allow the DAO to change the market maker contract
    @param _marketMaker address of the new contract
    */
    function setMarketMaker(address _marketMaker) public onlyAvatar {
        marketMaker = GoodMarketMaker(_marketMaker);
    }

    /**
    @dev allow the DAO to change the block interval
    @param _blockInterval the new value
    */
    function setBlockInterval(uint256 _blockInterval) public onlyAvatar {
        blockInterval = _blockInterval;
    }

    /**
    @dev allow the DAO to change the contribution formula contract
    @param _contribution address of the new contribution contract
    */
    function setContributionAddress(address _contribution) public onlyAvatar {
        address prevAddress = address(contribution);
        contribution = ContributionCalc(_contribution);
        emit ContributionAddressUpdated(msg.sender, prevAddress, _contribution);
    }

    /**
     * @dev buy G$ from buyWith and update the bonding curve params. buy occurs only if
     * the G$ return is above the given minimum. it is possible to buy only with cDAI
     * and when the contract is set to active. MUST call to `buyWith` `approve` prior
     * this buying action to allow this contract to accomplish the conversion.
     * @param tokenAmount how much `buyWith` tokens convert to G$ tokens
     * @param minReturn the minimum allowed return in G$ tokens
     * @return (gdReturn) how much G$ tokens were transferred
     */
    function buy(
        ERC20 buyWith,
        uint256 tokenAmount,
        uint256 minReturn
    ) public requireActive onlyCDai(buyWith) returns (uint256) {
        require(
            buyWith.allowance(msg.sender, address(this)) >= tokenAmount,
            "You need to approve cDAI transfer first"
        );
        require(
            buyWith.transferFrom(msg.sender, address(this), tokenAmount) == true,
            "transferFrom failed, make sure you approved cDAI transfer"
        );
        uint256 gdReturn = marketMaker.buy(buyWith, tokenAmount);
        require(gdReturn >= minReturn, "GD return must be above the minReturn");
        ERC20Mintable(address(gooddollar)).mint(msg.sender, gdReturn);
        emit TokenPurchased(
            msg.sender,
            address(buyWith),
            tokenAmount,
            minReturn,
            gdReturn
        );
        return gdReturn;
    }

    /**
     * @dev sell G$ to sellTo and update the bonding curve params. sell occurs only if the
     * token return is above the given minimum. notice that there is a contribution
     * amount from the given G$ that remains in the reserve. it is possible to sell only to
     * cDAI and when the contract is set to active. MUST call to G$ `approve` prior this
     * selling action to allow this contract to accomplish the conversion.
     * @param gdAmount how much G$ tokens convert to `sellTo` tokens
     * @param minReturn the minimum allowed return in `sellTo` tokens
     * @return (tokenReturn) how much `sellTo` tokens were transferred
     */
    function sell(
        ERC20 sellTo,
        uint256 gdAmount,
        uint256 minReturn
    ) public requireActive onlyCDai(sellTo) returns (uint256) {
        ERC20Burnable(address(gooddollar)).burnFrom(msg.sender, gdAmount);
        uint256 contributionAmount = contribution.calculateContribution(
            marketMaker,
            this,
            msg.sender,
            sellTo,
            gdAmount
        );
        uint256 tokenReturn = marketMaker.sellWithContribution(
            sellTo,
            gdAmount,
            contributionAmount
        );
        require(tokenReturn >= minReturn, "Token return must be above the minReturn");
        require(sellTo.transfer(msg.sender, tokenReturn) == true, "Transfer failed");
        emit TokenSold(
            msg.sender,
            address(sellTo),
            gdAmount,
            contributionAmount,
            minReturn,
            tokenReturn
        );
        return tokenReturn;
    }

    /**
    @dev current price of G$ in `token` currently only cDAI is supported
    @return price of G$
     */
    function currentPrice(ERC20 token) public view returns (uint256) {
        return marketMaker.currentPrice(token);
    }

    //TODO: WIP
    /**
     * @dev anyone can call this to trigger calculations
     * reserve sends UBI to Avatar and returns interest to FundManager
     * @param transfered how much was transfered to the reserve for UBI in `interestToken`
     * @param interest out of total transfered how much is the interest (in interestToken) that needs to be paid back (some interest might be donated)
     * @return (gdInterest, gdUBI) how much G$ interest was minted and how much G$ UBI was minted
     */
    function mintInterestAndUBI(
        ERC20 interestToken,
        uint256 transfered,
        uint256 interest
    )
        public
        requireActive
        onlyCDai(interestToken)
        onlyFundManager
        returns (uint256, uint256)
    {
        require(canMint(), "Need to wait for the next interval");
        uint256 price = currentPrice(interestToken);
        uint256 gdInterestToMint = marketMaker.mintInterest(interestToken, transfered);
        uint256 precisionLoss = uint256(27).sub(uint256(gooddollar.decimals()));
        uint256 gdInterest = rdiv(interest, price).div(10**precisionLoss);
        uint256 gdExpansionToMint = marketMaker.mintExpansion(interestToken);
        uint256 gdUBI = gdInterestToMint.sub(gdInterest);
        gdUBI = gdUBI.add(gdExpansionToMint);
        uint256 toMint = gdUBI.add(gdInterest);
        if (toMint > 0) ERC20Mintable(address(gooddollar)).mint(fundManager, toMint);
        lastMinted = block.number.div(blockInterval);
        emit GDInterestAndExpansionMinted(
            msg.sender,
            address(fundManager),
            address(avatar),
            gdInterestToMint,
            gdExpansionToMint,
            gdInterest,
            gdUBI
        );
        return (gdInterest, gdUBI);
    }

    /**
     * @dev making the contract inactive after it has transferred the cDAI funds to `_avatar`
     * and has transferred the market maker ownership to `_avatar`. inactive
     * means that buy / sell / mintInterestAndUBI actions will no longer be active. only the
     * avatar can destroy the contract.
     */
    function end() public onlyAvatar {
        uint256 remainingReserve = cDai.balanceOf(address(this));
        if (remainingReserve > 0) {
            cDai.transfer(address(avatar), remainingReserve);
        }
        require(cDai.balanceOf(address(this)) == 0, "Funds transfer has failed");
        marketMaker.transferOwnership(address(avatar));
        gooddollar.renounceMinter();
        super.internalEnd(avatar);
    }

    function canMint() public view returns (bool) {
        return block.number.div(blockInterval) > lastMinted;
    }
}
