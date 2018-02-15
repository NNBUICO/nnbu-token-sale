pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./TeamReserve.sol";
import "./NnbuToken.sol";
import "./Whitelist.sol";


/**
 * @title Nnbu Crowdsale contract - crowdsale contract for the Nnbu tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract NnbuCrowdsale is FinalizableCrowdsale, Pausable {
    uint256 constant public PRE_CROWDSALE_CAP =     15000000e18; //  15 M
    uint256 constant public PUBLIC_CROWDSALE_CAP =  37500000e18; // 37.5 M
    uint256 constant public TOTAL_TOKENS_FOR_CROWDSALE = PRE_CROWDSALE_CAP + PUBLIC_CROWDSALE_CAP;
    uint256 constant public TOTAL_TOKENS_SUPPLY =   60000000e18; // 60 M
    uint256 constant public COMPANY_SHARE =         7500000e18; // 7.5 M

    address public teamReserve;
    uint256 public presaleEnds;

    // remainderPurchaser and remainderTokens info saved in the contract
    // used for reference for contract owner to send refund if any to last purchaser after end of crowdsale
    address public remainderPurchaser;
    uint256 public remainderAmount;

    // external contracts
    Whitelist public whitelist;

    event MintedTokensFor(address indexed investor, uint256 tokensPurchased);
    event TokenRateChanged(uint256 previousRate, uint256 newRate);

    /**
     * @dev Contract constructor function
     * @param _startTime The timestamp of the beginning of the crowdsale
     * @param _endTime Timestamp when the crowdsale will finish
     * @param _whitelist contract containing the whitelisted addresses
     * @param _rate The token rate per ETH
     * @param _wallet Multisig wallet that will hold the crowdsale funds.
     */
    function NnbuCrowdsale
        (
            uint256 _startTime,
            uint256 _presaleEnds,
            uint256 _endTime,
            address _whitelist,
            uint256 _rate,
            address _wallet
        )
        public
        FinalizableCrowdsale()
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {

        require(_whitelist != address(0));
        whitelist = Whitelist(_whitelist);
        presaleEnds = _presaleEnds;

        NnbuToken(token).pause();
    }

    modifier whitelisted(address beneficiary) {
        require(whitelist.isWhitelisted(beneficiary));
        _;
    }

    /**
     * @dev change crowdsale rate
     * @param newRate Figure that corresponds to the new rate per token
     */
    function setRate(uint256 newRate) external onlyOwner {
        require(newRate != 0);

        TokenRateChanged(rate, newRate);
        rate = newRate;
    }

    /**
     * @dev Mint tokens investors that sent fiat for token purchases
     * @param beneficiaryAddress Address of beneficiary
     * @param amountOfTokens Number of tokens to be created
     */
    function mintTokensFor(address beneficiaryAddress, uint256 amountOfTokens)
        public
        onlyOwner
    {
        require(beneficiaryAddress != address(0) && hasEnded());
        require(token.totalSupply().add(amountOfTokens) <= TOTAL_TOKENS_SUPPLY);

        token.mint(beneficiaryAddress, amountOfTokens);
        MintedTokensFor(beneficiaryAddress, amountOfTokens);
    }

    /**
     * @dev Set the address which should receive the vested team tokens share on finalization
     * @param _teamReserve address of team and advisor allocation contract
     */
    function setTeamWalletAddress(address _teamReserve) public onlyOwner {
        require(_teamReserve != address(0x0));
        teamReserve = _teamReserve;
    }

    /**
     * @dev payable function that allow token purchases
     * @param beneficiary Address of the purchaser
     */
    function buyTokens(address beneficiary)
        public
        whenNotPaused
        whitelisted(beneficiary)
        payable
    {
        require(beneficiary != address(0));
        require(msg.sender == beneficiary);
        require(validPurchase() && token.totalSupply() < TOTAL_TOKENS_FOR_CROWDSALE);

        uint256 weiAmount = msg.value;

        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(rate);

        // private and public presale have similar bonus structures
        // hence lumping then together
        if (now <= presaleEnds) {
            uint256 presaleBonus = 60;
            uint256 numOfBonusTokens = tokens.mul(presaleBonus).div(100);
            tokens = tokens.add(numOfBonusTokens);
            require(token.totalSupply().add(tokens) <= PRE_CROWDSALE_CAP);
        }

        //remainder logic
        if (token.totalSupply().add(tokens) > TOTAL_TOKENS_FOR_CROWDSALE) {
            tokens = TOTAL_TOKENS_FOR_CROWDSALE.sub(token.totalSupply());
            weiAmount = tokens.div(rate);

            // save info so as to refund purchaser after crowdsale's end
            remainderPurchaser = msg.sender;
            remainderAmount = msg.value.sub(weiAmount);
        }

        // update state
        weiRaised = weiRaised.add(weiAmount);

        token.mint(beneficiary, tokens);
        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        forwardFunds();
    }

    // overriding Crowdsale#hasEnded to add cap logic
    // @return true if crowdsale event has ended
    function hasEnded() public view returns (bool) {
        if (token.totalSupply() == TOTAL_TOKENS_FOR_CROWDSALE) {
            return true;
        }

        return super.hasEnded();
    }

    /**
     * @dev Creates Nnbu token contract. This is called on the constructor function of the Crowdsale contract
     */
    function createTokenContract() internal returns (MintableToken) {
        return new NnbuToken();
    }

    /**
     * @dev finalizes crowdsale
     */
    function finalization() internal {
        // This must have been set manually prior to finalize().
        require(teamReserve != address(0x0));

        // final minting
        token.mint(teamReserve, COMPANY_SHARE);

        if (TOTAL_TOKENS_SUPPLY > token.totalSupply()) {
            uint256 remainingTokens = TOTAL_TOKENS_SUPPLY.sub(token.totalSupply());

            token.mint(teamReserve, remainingTokens);
        }

        token.finishMinting();
        NnbuToken(token).unpause();
        super.finalization();
    }
}
