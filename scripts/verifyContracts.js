const fse = require("fs-extra");
const util = require("util");
const _ = require("lodash");
const exec = util.promisify(require("child_process").exec);
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const dictionary = {
  MarketMaker: "GoodMarketMaker",
  FundManager: "GoodFundManager",
  Reserve: "GoodReserveCDai",
  DAIStaking: "SimpleDaiStaking"
};
const verify = async () => {
  const [network] = process.argv.slice(2);
  const file = await fse.readFile("releases/deployment.json", "utf8");
  const previousDeployment = JSON.parse(file);
  console.log("verifying for network", network, previousDeployment[network]);
  const contracts = previousDeployment[network];
  for (k in contracts) {
    const contractName = _.get(dictionary, k, k);
    if (k.indexOf("Bridge") >= 0) continue;
    const address = contracts[k];
    if (address === NULL_ADDRESS) continue;
    const contract = contractName + "@" + address;
    console.log("verifying:", { contract, network });
    const res = await exec(
      `npx truffle run verify ${contract} --network ${network}`
    ).catch(e => e);
    console.log({ res });
  }
};
verify();
