pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";


/**
 * @title Nnbu Token contract - ERC20 compatible token contract.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract NnbuToken is PausableToken, MintableToken {
    string public name = "The Baby Token";
    string public symbol = "BABY";
    uint8 public decimals = 18;
}
