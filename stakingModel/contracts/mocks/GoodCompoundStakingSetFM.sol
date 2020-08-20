pragma solidity 0.5.4;

import "../GoodCompoundStaking.sol";


/**
 * @title A GoodCompoundStaking mock.
 * return different donation ratio on collect.
 */
contract GoodCompoundStakingSetFM is GoodCompoundStaking {
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

    function setFundManager(address fm)
        public
    {
        fundManager = fm;
    }
}