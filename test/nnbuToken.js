const { should } = require('./helpers/utils');
const NnbuToken = artifacts.require('./NnbuToken.sol');

contract('NnbuToken', () => {
    let token;

    beforeEach(async () => {
        token = await NnbuToken.deployed();
    });

    it('has a name', async () => {
        const name = await token.name();
        name.should.be.equal('The Baby Token');
    });

    it('possesses a symbol', async () => {
        const symbol = await token.symbol();
        symbol.should.be.equal('BABY');
    });

    it('contains 18 decimals', async () => {
        const decimals = await token.decimals();
        decimals.should.be.bignumber.equal(18);
    });
});
