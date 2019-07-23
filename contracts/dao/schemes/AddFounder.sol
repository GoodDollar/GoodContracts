pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "./SchemeGuard.sol";
import "./ActivePeriod.sol";

/* @title scheme for adding founders to organization
 */
contract AddFounder is ActivePeriod, SchemeGuard {

    event FounderAdded(address indexed account);

    address public founder;
    uint public founderTokenAmount;
    uint public founderReputationAmount;

    constructor(
        Avatar _avatar,
        address _founder,
        uint _founderTokenAmount,
        uint _founderReputationAmount,
        uint _periodStart,
        uint _periodEnd
    )
        public
        ActivePeriod(_periodStart, _periodEnd)
        SchemeGuard(_avatar)
    {
        require(_founder != address(0), "Founder cannot be zero address");
        require(_founderTokenAmount > 0 || _founderReputationAmount > 0, "Cannot grant founder nothing");

        founder = _founder;
        founderTokenAmount = _founderTokenAmount;
        founderReputationAmount = _founderReputationAmount;
    }

    function start() public onlyRegistered returns (bool) {
        require(super.start());

        if (founderTokenAmount > 0) {
            controller.mintTokens(founderTokenAmount, founder, address(avatar));
        }

        if (founderReputationAmount > 0) {
            controller.mintReputation(founderReputationAmount, founder, address(avatar));
        }
        
        emit FounderAdded(founder);
        return super.internalEnd();
    }
 }