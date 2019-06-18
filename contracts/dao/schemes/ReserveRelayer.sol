pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "./ActivePeriod.sol";
import "./SchemeGuard.sol";

/* @title Scheme contract responsible relaying fees on forign network to home network.
 * Currently, it is not possible to relay the fees directly to the ubi contract
 * on the home network, as the Token bridge only allows transfers from one address 
 * to the same address on the other network, meaning that contracts with different 
 * addresses are unable to relay funds to each other.
 */
contract ReserveRelayer is ActivePeriod, SchemeGuard {

    address public receiver;

    /* @dev Constructor. Checks if periodEnd variable is after periodStart.
     * @param _periodStart period from when the contract is able to start
     * @param _periodEnd period from when the contract is able to end
     */
    constructor(
        Avatar _avatar,
        address _receiver,
        uint _periodStart,
        uint _periodEnd
    )
        public
        ActivePeriod(_periodStart, _periodEnd)
        SchemeGuard(_avatar)
    {
        require(_receiver != address(0), "receiver cannot be null address");
        receiver = _receiver;
    }

    /* @dev Start function. Transfers the entire reserve from the avatar to
     * the receiver given in the constructor, then ends the scheme regardless
     * of end period
     */
    function start() onlyRegistered public returns(bool) {
        require(super.start());

        /* Transfer the fee reserve to this contract */
        DAOToken token = avatar.nativeToken();
        uint256 reserve = token.balanceOf(address(avatar));

        controller.genericCall(
            address(token),
            abi.encodeWithSignature("transfer(address,uint256)", receiver, reserve),
            avatar,
            0);

        return super.internalEnd();
    }
}
