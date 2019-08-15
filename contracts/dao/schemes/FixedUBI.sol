pragma solidity 0.5.4;

import "./UBI.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FixedUBI is AbstractUBI {
    using SafeMath for uint256;

    uint256 fixedClaim;

    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _amountToMint,
        uint _periodStart,
        uint _periodEnd,
        uint256 _fixedClaim
    )
        public
        AbstractUBI(_avatar, _identity, _amountToMint, _periodStart, _periodEnd)
    {
        fixedClaim = _fixedClaim;
    }

    function distributionFormula(uint256 /*amount*/, address /*user*/) internal returns(uint256) {
        return fixedClaim;
    }

    function start() public returns (bool) {
        require(
            (avatar.nativeToken().balanceOf(address(avatar)).add(amountToMint)) >=
            (identity.getClaimerCount().mul(distributionFormula(0, address(0)))),
            "Reserve not large enough"
            );

        super.start();

        claimDistribution = distributionFormula(0, address(0));
        return true;
    }
}
