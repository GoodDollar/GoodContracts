pragma solidity 0.5.4;

import "./ERC677/ERC677.sol";
import "./ERC677/ERC677Receiver.sol";
import "@daostack/arc/contracts/controller/DAOToken.sol";

contract ERC677Token is ERC677, DAOToken {

    constructor(
        string memory name,
        string memory symbol,
        uint256 cap
    )
        public
        DAOToken(name, symbol, cap)
    {
    }

    /**
    * @dev transfer token to a contract address with additional data if the recipient is a contact.
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    * @param _data The extra data to be passed to the receiving contract.
    */
    function transferAndCall(address _to, uint256 _value, bytes memory _data)
        public
        returns (bool)
    {
        require(super.transfer(_to, _value), "Transfer failed");
        emit Transfer(msg.sender, _to, _value, _data);
      
        if (isContract(_to)) {
            require(contractFallback(_to, _value, _data), "Contract fallback failed");
        }
        return true;
    }

    function contractFallback(address _to, uint256 _value, bytes memory _data)
        private
        returns (bool)
    {
        ERC677Receiver receiver = ERC677Receiver(_to);
        receiver.onTokenTransfer(msg.sender, _value, _data);
        return true;
    }

    function isContract(address _addr)
        view
        private
        returns (bool)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }
}