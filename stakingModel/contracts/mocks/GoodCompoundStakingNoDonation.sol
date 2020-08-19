pragma solidity 0.5.4;

import "../GoodCompoundStaking.sol";


/**
 * @title A GoodCompoundStaking mock.
 * return 0 donation ratio on collect.
 */
contract GoodCompoundStakingNoDonation is GoodCompoundStaking {
    constructor(
        address _token,
        address _iToken,
        address _fundManager,
        uint256 _blockInterval,
        Avatar _avatar,
        Identity _identity
    )
        public
        GoodCompoundStaking(_token, _iToken, _fundManager, _blockInterval, _avatar, _identity)
    {}

    function collectUBIInterest(address recipient)
        public
        onlyFundManager
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        (uint256 iTokenGains, uint256 tokenGains, uint256 precisionLossToken, ) = super
            .collectUBIInterest(recipient);
        return (iTokenGains, tokenGains, precisionLossToken, 1e18);
    }
}