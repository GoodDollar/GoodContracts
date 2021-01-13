import { ethers } from "hardhat";
import { range, chunk } from "lodash";
import fs from "fs";

type Balances = {
  [key: string]: {
    isNotContract: boolean;
    balance: number;
    claims: number;
    gdRepShare: number;
    claimRepShare: number;
  };
};

const gd = new ethers.Contract(
  "0x495d133B938596C9984d462F007B676bDc57eCEC",
  [
    "event Transfer(address indexed from, address indexed to, uint amount)",
    "function balanceOf(address) view returns(uint256)"
  ],
  ethers.provider
);

const ubi = new ethers.Contract(
  "0xAACbaaB8571cbECEB46ba85B5981efDB8928545e",
  ["event UBIClaimed(address indexed from, uint amount)"],
  ethers.provider
);

const getActiveAddresses = async () => {
  const addresses = {};

  const latestBlock = await ethers.provider.getBlockNumber();
  const step = 1000;
  const blocks = range(6246000, 6500000, step);
  const filter = gd.filters.Transfer();

  for (let blockChunk of chunk(blocks, 10)) {
    // Get the filter (the second null could be omitted)
    const ps = blockChunk.map(async bc => {
      // Query the filter (the latest could be omitted)
      const logs = await gd.queryFilter(filter, bc, bc + step - 1).catch(e => {
        console.log("block transfer logs failed retrying...", bc);
        return gd.queryFilter(filter, bc, bc + step - 1);
      });
      console.log("found logs in block:", { bc }, logs.length);
      // Print out all the values:
      const ps = logs.map(async log => {
        if (addresses[log.args.to] === undefined)
          addresses[log.args.to] = (await ethers.provider.getCode(log.args.to)) === "0x";
        if (addresses[log.args.from] === undefined)
          addresses[log.args.from] =
            (await ethers.provider.getCode(log.args.from)) === "0x";
      });
      await Promise.all(ps);
    });
    await Promise.all(ps);
  }
  return addresses;
};

const getBalances = async addresses => {
  const addrs = Object.entries(addresses);
  const balances = {};
  console.log("Getting balances for addresses:", addrs.length);
  for (let addrChunk of chunk(addrs, 50)) {
    const ps = addrChunk.map(([addr, isNotContract]) =>
      gd
        .balanceOf(addr)
        .then(b => (balances[addr] = { isNotContract, balance: b.toNumber() }))
    );
    await Promise.all(ps);
  }
  return balances;
};

const getClaimsPerAddress = async (balances: Balances) => {
  const latestBlock = await ethers.provider.getBlockNumber();
  const step = 1000;
  const blocks = range(6246000, 6500000, step);
  const filter = ubi.filters.UBIClaimed();

  for (let blockChunk of chunk(blocks, 10)) {
    // Get the filter (the second null could be omitted)
    const ps = blockChunk.map(async bc => {
      // Query the filter (the latest could be omitted)
      const logs = await ubi.queryFilter(filter, bc, bc + step - 1).catch(e => {
        console.log("block ubiclaimed logs failed retrying...", bc);
        return ubi.queryFilter(filter, bc, bc + step - 1);
      });
      console.log("found logs in block:", { bc }, logs.length);
      // Print out all the values:
      logs.map(log => {
        balances[log.args.from].claims != undefined
          ? (balances[log.args.from].claims += 1)
          : (balances[log.args.from].claims = 0);
      });
    });
    await Promise.all(ps);
  }
  return balances;
};

const calcRelativeRep = async (balances: Balances) => {
  const totalSupply = Object.values(balances).reduce(
    (cur, data) => cur + data.balance,
    0
  );
  const totalClaims = Object.values(balances).reduce(
    (cur, data) => cur + (data.claims || 0),
    0
  );

  for (let addr in balances) {
    balances[addr].gdRepShare = balances[addr].balance / totalSupply;
    balances[addr].claimRepShare = balances[addr].claims / totalClaims;
  }
  return { totalSupply, totalClaims, balances };
};

getActiveAddresses()
  .then(r => {
    console.log("found addresses", Object.keys(r).length);
    fs.writeFileSync("addrs.json", JSON.stringify(r, null, 2));
    return r;
  })
  .then(getBalances)
  .then(r => {
    console.log("blances", Object.keys(r).length);
    fs.writeFileSync("balances.json", JSON.stringify(r));
    return r;
  })
  .then(getClaimsPerAddress)
  .then(calcRelativeRep)
  .then(r => fs.writeFileSync("balances.json", JSON.stringify(r)))
  .catch(console.log);
