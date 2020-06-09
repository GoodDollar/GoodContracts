pragma solidity 0.5.4;

import "./ERC677/ERC677.sol";
import "./ERC677/ERC677Receiver.sol";
import "@daostack/arc/contracts/controller/DAOToken.sol";

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";


/* @title ERC677Token contract.
 */
contract ERC677Token is ERC677, DAOToken, ERC20Pausable {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _cap
    ) public DAOToken(_name, _symbol, _cap) {}

    /**
     * @dev transfer token to a contract address with additional data if the recipient is a contact.
     * @param _to The address to transfer to.
     * @param _value The amount to be transferred.
     * @param _data The extra data to be passed to the receiving contract.
     * @return true if transfer is successful
     */
    function _transferAndCall(
        address _to,
        uint256 _value,
        bytes memory _data
    ) internal whenNotPaused returns (bool) {
        bool res = super.transfer(_to, _value);
        emit Transfer(msg.sender, _to, _value, _data);

        if (isContract(_to)) {
            require(contractFallback(_to, _value, _data), "Contract fallback failed");
        }
        return res;
    }

    /* @dev Contract fallback function. Is called if transferAndCall is called
     * to a contract
     */
    function contractFallback(
        address _to,
        uint256 _value,
        bytes memory _data
    ) private returns (bool) {
        ERC677Receiver receiver = ERC677Receiver(_to);
        require(
            receiver.onTokenTransfer(msg.sender, _value, _data),
            "Contract Fallback failed"
        );
        return true;
    }

    /* @dev Function to check if given address is a contract
     * @param _addr Address to check
     * @return true if given address is a contract
     */

    function isContract(address _addr) internal view returns (bool) {
        uint256 length;
        assembly {
            length := extcodesize(_addr)
        }
        return length > 0;
    }
}
