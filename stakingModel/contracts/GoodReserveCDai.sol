pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/SchemeGuard.sol";
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

/**
@title Reserve based on cDAI and dynamic reserve ratio market maker
*/
contract GoodReserveCDai is DSMath, SchemeGuard {
    using SafeMath for uint256;

    event UBIMinted(
        uint256 indexed day,
        uint256 cDaiValue,
        uint256 daiValue,
        uint256 gdInterest,
        uint256 gdUBI
    );

    ERC20 dai;

    cERC20 cDai;

    GoodDollar gooddollar;

    GoodMarketMaker public marketMaker;

    address public fundManager;

    address public avatar;

    uint256 public daysFromStart = 0;

    modifier onlyFundManager {
        require(
            msg.sender == fundManager,
            "Only FundManager can call this method"
        );
        _;
    }

    modifier onlyCDai(ERC20 token) {
        require(address(token) == address(cDai), "Only cDAI is supported");
        _;
    }

    constructor(
        address _dai,
        address _cDai,
        address _gooddollar,
        address _fundManager,
        address _avatar,
        address _marketMaker,
    ) public SchemeGuard(Avatar(_avatar)) {
        dai = ERC20(_dai);
        cDai = cERC20(_cDai);
        gooddollar = GoodDollar(_gooddollar);
        avatar = _avatar;
        fundManager = _fundManager;
        marketMaker = GoodMarketMaker(_marketMaker);
    }

    function setMarketMaker(address _marketMaker) public onlyAvatar {
        marketMaker = GoodMarketMaker(_marketMaker);
    }

    /**
    * @dev Buy G$ from the marketMaker
    * currently only cDAI is supported
    */
    function buy(ERC20 buyWith, uint256 tokenAmount, uint256 maxPrice)
        public
        payable
    {}

    /**
    * @dev Sell G$ to the marketMaker
    * currently only cDai is supported
    */
    function sell(ERC20 sellTo, uint256 gdAmount, uint256 minPrice) public {}

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
        onlyCDai(interestToken)
        onlyFundManager
        returns (uint256, uint256)
    {
        uint256 price = currentPrice(interestToken);
        uint256 gdToMint = marketMaker.calculateToMint(interestToken, transfered);
        uint256 precisionLoss = uint256(
            //TODO: fix dangerous sub
            ERC20Detailed(address(interestToken)).decimals() -
                gooddollar.decimals()
        );
        uint256 gdInterest = rdiv(interest, price).div(10**precisionLoss);
        uint256 gdUBI = gdToMint.sub(gdInterest);
        ERC20Mintable(address(gooddollar)).mint(fundManager, gdInterest);
        //TODO: how do we transfer to bridge, is the fundmanager in charge of that?
        ERC20Mintable(address(gooddollar)).mint(avatar, gdUBI);
        return (gdInterest, gdUBI);
    }

    //TODO: function to return all funds to avatar
    function destroy() onlyAvatar {

    }

}
