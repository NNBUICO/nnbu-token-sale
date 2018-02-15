const NnbuToken = artifacts.require('./NnbuToken.sol');
const NnbuCrowdsale = artifacts.require('./NnbuCrowdsale.sol');
const Whitelist = artifacts.require('./Whitelist.sol');

const BigNumber = web3.BigNumber;
const dayInSecs = 86400;

const startTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 20; // twenty secs in the future
const presaleEnds = startTime + dayInSecs * 20; // 20 days
const endTime = startTime + dayInSecs * 60; // 60 days
const rate = new BigNumber(10);

module.exports = function(deployer, network, [_, wallet]) {
    return deployer
        .then(() => {
            return deployer.deploy(NnbuToken);
        })
        .then(() => {
            return deployer.deploy(Whitelist);
        })
        .then(() => {
            return deployer.deploy(
                NnbuCrowdsale,
                startTime,
                presaleEnds,
                endTime,
                Whitelist.address,
                rate,
                wallet
            );
        });
};
