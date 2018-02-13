const NnbuCrowdsale = artifacts.require('./NnbuCrowdsale.sol');
const TeamReserve = artifacts.require('./TeamReserve.sol');
const NnbuToken = artifacts.require('./NnbuToken.sol');
const Whitelist = artifacts.require('./Whitelist.sol');

const { should, ensuresException, getBlockNow } = require('./helpers/utils');
const expect = require('chai').expect;
const timer = require('./helpers/timer');

const BigNumber = web3.BigNumber;

contract('NnbuCrowdsale', ([owner, wallet, buyer, buyer2, user1, user2]) => {
    const rate = new BigNumber(50);
    const newRate = new BigNumber(60);
    const dayInSecs = 86400;
    const value = new BigNumber(1);

    const expectedTeamReserve = new BigNumber(7500000e18);
    const totalTokensForCrowdsale = new BigNumber(52500000e18);
    const totalTokenSupply = new BigNumber(60000000e18);

    let startTime, endTime;
    let crowdsale, token;
    let teamReservesContract, whitelist;

    const newCrowdsale = rate => {
        startTime = getBlockNow() + 20; // crowdsale starts in 20 seconds
        endTime = startTime + dayInSecs * 60; // 60 days

        return Whitelist.new().then(whitelistRegistry => {
            whitelist = whitelistRegistry;

            return NnbuCrowdsale.new(
                startTime,
                endTime,
                whitelist.address,
                rate,
                wallet
            );
        });
    };

    beforeEach('initialize contract', async () => {
        crowdsale = await newCrowdsale(rate);
        token = NnbuToken.at(await crowdsale.token());
        teamReservesContract = await TeamReserve.new(token.address);
    });

    it('has a normal crowdsale rate', async () => {
        const crowdsaleRate = await crowdsale.rate();
        crowdsaleRate.toNumber().should.equal(rate.toNumber());
    });

    it('has a whitelist contract', async () => {
        const whitelistContract = await crowdsale.whitelist();
        whitelistContract.should.equal(whitelist.address);
    });

    it('has a wallet', async () => {
        const walletAddress = await crowdsale.wallet();
        walletAddress.should.equal(wallet);
    });

    it('starts with token paused', async () => {
        const paused = await token.paused();
        paused.should.be.true;
    });

    describe('changing rate', () => {
        it('does NOT allows anyone to change rate other than the owner', async () => {
            try {
                await crowdsale.setRate(newRate, { from: buyer });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const rate = await crowdsale.rate();
            rate.should.be.bignumber.equal(rate);
        });

        it('cannot set a rate that is zero', async () => {
            const zeroRate = new BigNumber(0);

            try {
                await crowdsale.setRate(zeroRate, { from: owner });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const rate = await crowdsale.rate();
            rate.should.be.bignumber.equal(rate);
        });

        it('allows owner to change rate', async () => {
            const { logs } = await crowdsale.setRate(newRate, {
                from: owner
            });

            const event = logs.find(e => e.event === 'TokenRateChanged');
            should.exist(event);

            const rate = await crowdsale.rate();
            rate.should.be.bignumber.equal(newRate);
        });
    });

    describe('#mintTokenForPreCrowdsale', function() {
        it('must NOT be called by a non owner', async () => {
            try {
                await crowdsale.mintTokenForPreCrowdsale(buyer, 10e18, {
                    from: buyer
                });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(0);
        });

        it('should NOT mint tokens when pre crowdsale cap is reached', async () => {
            const preCrowdsaleCap = await crowdsale.PRE_CROWDSALE_CAP();

            try {
                await crowdsale.mintTokenForPreCrowdsale(
                    buyer,
                    preCrowdsaleCap.toNumber() + 10e18
                );
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(0);
        });

        it('should NOT mint tokens for private investors after crowdsale starts', async () => {
            await timer(50);
            try {
                await crowdsale.mintTokenForPreCrowdsale(buyer, value);
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(0);
        });

        it('mints tokens to private investors before the crowdsale starts', async () => {
            const { logs } = await crowdsale.mintTokenForPreCrowdsale(
                buyer,
                value
            );

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(value);

            const event = logs.find(
                e => e.event === 'PrivateInvestorTokenPurchase'
            );
            should.exist(event);
        });
    });

    describe('whitelist', () => {
        it('only allows owner to add to the whitelist', async () => {
            await timer(dayInSecs);

            try {
                await whitelist.addToWhitelist([buyer, buyer2], {
                    from: buyer
                });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            let isBuyerWhitelisted = await whitelist.isWhitelisted.call(buyer);
            isBuyerWhitelisted.should.be.false;

            await whitelist.addToWhitelist([buyer, buyer2], {
                from: owner
            });

            isBuyerWhitelisted = await whitelist.isWhitelisted.call(buyer);
            isBuyerWhitelisted.should.be.true;
        });

        it('only allows owner to remove from the whitelist', async () => {
            await timer(dayInSecs);
            await whitelist.addToWhitelist([buyer, buyer2], {
                from: owner
            });

            try {
                await whitelist.removeFromWhitelist([buyer], {
                    from: buyer2
                });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            let isBuyerWhitelisted = await whitelist.isWhitelisted.call(buyer2);
            isBuyerWhitelisted.should.be.true;

            await whitelist.removeFromWhitelist([buyer], { from: owner });

            isBuyerWhitelisted = await whitelist.isWhitelisted.call(buyer);
            isBuyerWhitelisted.should.be.false;
        });

        it('shows whitelist addresses', async () => {
            await timer(dayInSecs);
            await whitelist.addToWhitelist([buyer, buyer2], {
                from: owner
            });

            const isBuyerWhitelisted = await whitelist.isWhitelisted.call(
                buyer
            );
            const isBuyer2Whitelisted = await whitelist.isWhitelisted.call(
                buyer2
            );

            isBuyerWhitelisted.should.be.true;
            isBuyer2Whitelisted.should.be.true;
        });

        it('has WhitelistUpdated event', async () => {
            await timer(dayInSecs);
            const { logs } = await whitelist.addToWhitelist([buyer, buyer2], {
                from: owner
            });

            const event = logs.find(e => e.event === 'WhitelistUpdated');
            expect(event).to.exist;
        });
    });

    describe('token purchases', () => {
        beforeEach('initialize contract', async () => {
            await whitelist.addToWhitelist([buyer, buyer2]);
        });

        it('allows ONLY whitelisted addresses to purchase tokens', async () => {
            await timer(dayInSecs);

            try {
                await crowdsale.buyTokens(user1, { from: user1 });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const advisorBalance = await token.balanceOf(user1);
            advisorBalance.should.be.bignumber.equal(0);

            // purchase occurrence
            await crowdsale.buyTokens(buyer, { value, from: buyer });

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(50);
        });

        it('allows ONLY addresses that call buyTokens to purchase tokens', async () => {
            await timer(dayInSecs);

            try {
                await crowdsale.buyTokens(buyer, { from: owner });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const advisorBalance = await token.balanceOf(user1);
            advisorBalance.should.be.bignumber.equal(0);

            // purchase occurrence
            await crowdsale.buyTokens(buyer, { value, from: buyer });

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(50);
        });

        it('does NOT buy tokens if crowdsale is paused', async () => {
            await timer(dayInSecs);
            await crowdsale.pause();
            let buyerBalance;

            try {
                await crowdsale.buyTokens(buyer, { value, from: buyer });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(0);

            await crowdsale.unpause();
            await crowdsale.buyTokens(buyer, { value, from: buyer });

            buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(50);
        });

        it('only mints tokens up to crowdsale cap and when more eth is sent last user purchase info is saved in contract', async () => {
            crowdsale = await newCrowdsale(totalTokensForCrowdsale);
            token = NnbuToken.at(await crowdsale.token());

            await whitelist.addToWhitelist([buyer, buyer2]);

            await timer(dayInSecs);

            await crowdsale.buyTokens(buyer, { from: buyer, value: 2 });

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(totalTokensForCrowdsale);

            const remainderPurchaser = await crowdsale.remainderPurchaser();
            remainderPurchaser.should.equal(buyer);

            const remainder = await crowdsale.remainderAmount();
            remainder.toNumber().should.be.equal(1);

            try {
                await crowdsale.buyTokens(buyer, { value, from: buyer });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }
        });
    });

    describe('crowdsale finalization', function() {
        beforeEach(async function() {
            crowdsale = await newCrowdsale(totalTokensForCrowdsale);
            token = NnbuToken.at(await crowdsale.token());

            await whitelist.addToWhitelist([buyer]);
            await timer(dayInSecs * 42);

            await crowdsale.buyTokens(buyer, { value, from: buyer });

            await timer(dayInSecs * 20);

            await crowdsale.setTeamWalletAddress(teamReservesContract.address);

            await crowdsale.finalize();
        });

        it('assigns tokens correctly to teamReservesContract', async function() {
            const balanceCompany = await token.balanceOf(
                teamReservesContract.address
            );
            // companyTokens + leftOver tokens
            balanceCompany
                .toNumber()
                .should.be.bignumber.equal(expectedTeamReserve);
        });

        it('token is unpaused after crowdsale ends', async function() {
            let paused = await token.paused();
            paused.should.be.false;
        });

        it('finishes minting when crowdsale is finalized', async function() {
            crowdsale = await newCrowdsale(newRate);
            token = NnbuToken.at(await crowdsale.token());

            await whitelist.addToWhitelist([buyer, buyer2]);

            await timer(dayInSecs * 42);
            let finishMinting = await token.mintingFinished();
            finishMinting.should.be.false;

            await crowdsale.buyTokens(buyer, { value, from: buyer });

            await timer(dayInSecs * 20);
            await crowdsale.setTeamWalletAddress(teamReservesContract.address);
            await crowdsale.finalize();

            finishMinting = await token.mintingFinished();
            finishMinting.should.be.true;
        });
    });

    describe('teamReserves', function() {
        beforeEach(async function() {
            crowdsale = await newCrowdsale(totalTokensForCrowdsale);
            token = NnbuToken.at(await crowdsale.token());
            teamReservesContract = await TeamReserve.new(
                await crowdsale.token()
            );

            await timer(50);

            await whitelist.addToWhitelist([buyer]);
            await crowdsale.buyTokens(buyer, { value, from: buyer });

            timer(dayInSecs * 70);
            await crowdsale.setTeamWalletAddress(teamReservesContract.address);
            await crowdsale.finalize();
        });

        it('assigns tokens correctly to TeamReserve contract', async function() {
            const balance = await token.balanceOf(
                await teamReservesContract.address
            );
            balance.should.be.bignumber.equal(expectedTeamReserve);
        });

        it('does NOT unlock advisors allocation before the unlock period is up', async function() {
            try {
                await teamReservesContract.unlock();
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const balance = await token.balanceOf(teamReservesContract.address);
            balance.should.be.bignumber.equal(expectedTeamReserve);
        });

        it('unlocks advisors allocation after the unlock period is up', async function() {
            await timer(dayInSecs * 370);

            await teamReservesContract.unlock();

            const balance = await token.balanceOf(teamReservesContract.address);
            balance.should.be.bignumber.equal(0);
        });

        it('does NOT kill contract before 465 days is up', async function() {
            try {
                await teamReservesContract.kill();
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const balance = await token.balanceOf(
                await teamReservesContract.address
            );
            balance.should.be.bignumber.equal(expectedTeamReserve);
        });

        it('is able to kill contract after one year', async () => {
            await timer(dayInSecs * 470); // 470 days after

            await teamReservesContract.kill();

            const balance = await token.balanceOf(
                await teamReservesContract.address
            );
            balance.should.be.bignumber.equal(0);

            const balanceOwner = await token.balanceOf(owner);
            balanceOwner.should.be.bignumber.equal(expectedTeamReserve);
        });
    });
});
