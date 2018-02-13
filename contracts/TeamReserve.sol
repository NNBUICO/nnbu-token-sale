pragma solidity 0.4.19;

import './NnbuToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';


/**
 * @title Team and Advisors Token Allocation contract
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract TeamReserve is Ownable {
    using SafeMath for uint256;

    uint256 public unlockedAt;
    uint256 public canSelfDestruct;

    NnbuToken public nnbu;

    /**
     * @dev constructor function that sets owner and token for the TeamReserve contract
     * @param _token Token contract address for NnbuToken
     */
    function TeamReserve(address _token) public {
        nnbu = NnbuToken(_token);
        unlockedAt = now.add(365 days);
        canSelfDestruct = now.add(465 days);
    }

    /**
     * @dev Allow company to unlock reserve tokens.
     */
    function unlock() external onlyOwner {
        require(now >= unlockedAt);

        uint256 tokensToSend = nnbu.balanceOf(this);

        // Will fail if allocation (and therefore toTransfer) is 0.
        require(nnbu.transfer(msg.sender, tokensToSend));
    }

    /**
     * @dev allow for selfdestruct possibility and sending funds to owner
     */
    function kill() public onlyOwner {
        require(now >= canSelfDestruct);
        uint256 balance = nnbu.balanceOf(this);

        if (balance > 0) {
            nnbu.transfer(owner, balance);
        }

        selfdestruct(owner);
    }
}
