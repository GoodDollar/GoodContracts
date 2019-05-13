pragma solidity 0.5.2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract ERC20 is Ownable {
    using SafeMath for uint256;

    mapping (address => uint256) private balances;
    mapping (address => mapping (address => uint256)) private allowed;
    uint256 private totalSupply;

    string private name_;
    string private symbol_;
    uint8 private decimals_;

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 value
    );

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    )
        public
    {
        name_ = name;
        symbol_ = symbol;
        decimals_ = decimals;
    }

    function _name() internal view returns (string memory) {
        return name_;
    }

    function _symbol() internal view returns (string memory) {
        return symbol_;
    }

    function _decimals() internal view returns (uint8) {
        return decimals_;
    }

    function _totalSupply() internal view returns (uint256) {
        return totalSupply;
    }

    function _balanceOf(address owner) internal view returns (uint256) {
        return balances[owner];
    }

    function _allowance(address owner, address spender)
        internal
        view
        returns (uint256)
    {
        return allowed[owner][spender];
    } 

    function setTotalSupply(uint256 value)
        public
        onlyOwner
    {
        totalSupply = value;
    }

    function increaseBalance(address owner, uint256 addedValue) 
        internal
        onlyOwner
    {
        balances[owner] = balances[owner].add(addedValue);
    }

    function decreaseBalance(address owner, uint256 subtractedValue)
        internal
        onlyOwner
    {
        balances[owner] = balances[owner].sub(subtractedValue);
    }

    function setAllowed(address owner,
                        address spender,
                        uint256 value)
        internal
        onlyOwner
    {
        allowed[owner][spender] = value;
    }

    function getAllowed(address owner,
                        address spender)
        public
        view
        returns (uint256)
    {
        return allowed[owner][spender];
    }

    function increaseAllowed(
        address owner,
        address spender,
        uint256 addedValue
    )
        public
        onlyOwner
    {
        allowed[owner][spender] = allowed[owner][spender].add(addedValue);
    }

    function decreaseAllowed(
        address owner,
        address spender,
        uint256 subtractedValue
    )
        public
        onlyOwner
    {
        allowed[owner][spender] = allowed[owner][spender].sub(subtractedValue);
    }

    function _transfer(address originSender, address to, uint256 value)
        internal
        returns (bool)
    {
        require(to != address(0));

        decreaseBalance(originSender, value);
        increaseBalance(originSender, value);

        emit Transfer(originSender, to, value);

        return true;
    }

    function _approve(address originSender, address spender, uint256 value)
        internal
        returns (bool)
    {
        require(spender != address(0));

        setAllowed(originSender, spender, value);
        emit Approval(originSender, spender, value);

        return true;
    }

    function _transferFrom(
        address originSender,
        address from,
        address to,
        uint256 value
    )
        internal
        returns (bool)
    {
        decreaseAllowed(from, originSender, value);

        _transfer(from, to, value);

        emit Approval(
            from,
            originSender,
            getAllowed(from, originSender)
        );

        return true;
    }

    function _increaseAllowance(
        address originSender,
        address spender,
        uint256 addedValue
    )
        internal
        returns (bool)
    {
        require(spender != address(0));

        increaseAllowed(originSender, spender, addedValue);

        emit Approval(
            originSender, spender,
            getAllowed(originSender, spender)
        );

        return true;
    }

    function _decreaseAllowance(
        address originSender,
        address spender,
        uint256 subtractedValue
    )
        internal
        returns (bool)
    {
        require(spender != address(0));

        decreaseAllowed(originSender, spender, subtractedValue);

        emit Approval(
            originSender, spender, getAllowed(originSender, spender)
        );

        return true;
    }

    function _mint(address account, uint256 value) internal returns (bool)
    {
        require(account != address(0));

        setTotalSupply(_totalSupply().add(value));
        increaseBalance(account, value);

        emit Transfer(address(0), account, value);

        return true;
    }

    function _burn(address originSender, uint256 value) internal returns (bool)
    {
        require(originSender != address(0));
        require(value <= _balanceOf(originSender));

        setTotalSupply(_totalSupply().sub(value));
        decreaseBalance(originSender, value);

        emit Transfer(originSender, address(0), value);

        return true;
    }
    
    function _burnFrom(address originSender, address account, uint256 value)
        internal
        returns (bool)
    {
        require(value <= getAllowed(account, originSender));

        decreaseAllowed(account, originSender, value);
        _burn(account, value);

        emit Approval(account, originSender, getAllowed(account, originSender));

        return true;
    }
}