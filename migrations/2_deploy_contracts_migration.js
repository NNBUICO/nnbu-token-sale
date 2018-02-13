const NnbuToken = artifacts.require('./NnbuToken.sol');

module.exports = function(deployer) {
    deployer.deploy(NnbuToken);
};
