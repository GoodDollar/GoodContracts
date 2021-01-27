import { get, range, chunk, flatten, mergeWith, sortBy } from "lodash";
import fs from "fs";
import MerkleTree from "merkle-tree-solidity";
import { production as coreContracts } from "../../../releases/deployment.json";
import { production as stakingContracts } from "../../../stakingModel/releases/deployment.json";
import { production as upgradablesContracts } from "../../../upgradables/releases/deployment.json";
import fetch from "node-fetch";
import { string } from "hardhat/internal/core/params/argumentTypes";

type Balances = {
  [key: string]: {
    isNotContract: boolean;
    balance: number;
    claims: number;
    gdRepShare: number;
    claimRepShare: number;
  };
};

type Tree = {
  [key: string]: {
    hash: string;
    rep: number;
  };
};
const DefaultBalance = {
  balance: 0,
  claims: 0,
  gdRepShare: 0,
  claimRepShare: 0
};
const otherContracts = [
  "0x8d441C2Ff54C015A1BE22ad88e5D42EFBEC6C7EF", //fuseswap
  "0x0bf36731724f0baceb0748a9e71cd4883b69c533", //fuseswap usdc
  "0x17b09b22823f00bb9b8ee2d4632e332cadc29458", //old bridge
  "0xd5d11ee582c8931f336fbcd135e98cee4db8ccb0", //new bridge
  "0xa56A281cD8BA5C083Af121193B2AaCCaAAC9850a" //mainnet uniswap
];
const systemContracts = {};
flatten(
  [].concat(
    ...[otherContracts, coreContracts, stakingContracts, upgradablesContracts]
      .map(Object.values)
      .map(arr => arr.map(x => (typeof x === "object" ? Object.values(x) : x)))
  )
)
  .filter(x => typeof x === "string" && x.startsWith("0x"))
  .map(addr => (systemContracts[addr.toLowerCase()] = true));

const twoWeeks = 12 * 60 * 24 * 30;
const step = 500;

const isSystemContract = addr => systemContracts[addr.toLowerCase()] === true;

const updateBalance = (balance, update) => {
  return Object.assign({}, DefaultBalance, balance, update);
};

const quantile = (sorted, q) => {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);

  let sum = 0;
  for (let i = 0; i < base; i++) sum += sorted[i];

  return sum;
};

export const airdrop = (ethers, ethplorer_key) => {
  console.log({ systemContracts });
  let gd = new ethers.Contract(
    "0x495d133B938596C9984d462F007B676bDc57eCEC",
    [
      "event Transfer(address indexed from, address indexed to, uint amount)",
      "function balanceOf(address) view returns(uint256)"
    ],
    ethers.provider
  );

  let gdMainnet = new ethers.Contract(
    "0x67C5870b4A41D4Ebef24d2456547A03F1f3e094B",
    [
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "function balanceOf(address) view returns(uint256)"
    ],
    new ethers.providers.InfuraProvider()
  );

  const ubi = new ethers.Contract(
    "0xAACbaaB8571cbECEB46ba85B5981efDB8928545e",
    ["event UBIClaimed(address indexed from, uint amount)"],
    ethers.provider
  );

  const getActiveAddresses = async (startBlock, endBlock, addresses: Balances = {}) => {
    const latestBlock = await gd.provider.getBlockNumber();
    // const blocks = range(startBlock, endBlock, step);
    const blocks = range(latestBlock - twoWeeks, latestBlock, step);
    const filter = gd.filters.Transfer();

    for (let blockChunk of chunk(blocks, 10)) {
      // Get the filter (the second null could be omitted)
      const ps = blockChunk.map(async bc => {
        // Query the filter (the latest could be omitted)
        const logs = await gd
          .queryFilter(filter, bc, Math.min(bc + step - 1, latestBlock))
          .catch(e => {
            console.log("block transfer logs failed retrying...", bc);
            return gd.queryFilter(filter, bc, Math.min(bc + step - 1, latestBlock));
          });

        console.log("found transfer logs in block:", { bc }, logs.length);
        // Print out all the values:
        const ps = logs.map(async log => {
          if (
            addresses[log.args.to] === undefined &&
            systemContracts[log.args.to] === undefined
          )
            addresses[log.args.to] = {
              claims: 0,
              balance: 0,
              gdRepShare: 0,
              claimRepShare: 0,
              isNotContract:
                (await gd.provider.getCode(log.args.to).catch(e => "0x")) === "0x"
            };
          if (
            addresses[log.args.from] === undefined &&
            systemContracts[log.args.from] === undefined
          )
            addresses[log.args.from] = {
              claims: 0,
              balance: 0,
              gdRepShare: 0,
              claimRepShare: 0,
              isNotContract:
                (await gd.provider.getCode(log.args.to).catch(e => "0x")) === "0x"
            };
        });
        await Promise.all(ps);
      });
      await Promise.all(ps);
    }

    return addresses;
  };

  const getBalances = async (addresses: Balances) => {
    const addrs = Object.keys(addresses);
    console.log("Getting balances for addresses:", addrs.length);
    let sofar = 0;
    for (let addrChunk of chunk(addrs, 100)) {
      const ps = addrChunk.map(addr =>
        gd
          .balanceOf(addr)
          .catch(e => gd.balanceOf(addr))
          .then(b => (addresses[addr].balance = b.toNumber()))
      );
      await Promise.all(ps);
      sofar += 100;
      console.log("got balances chunk", sofar);
    }
    return addresses;
  };

  const getBlockScoutHolders = async (addresses: Balances = {}) => {
    let params = "type=JSON";
    while (true) {
      let nextUrl = `https://explorer.fuse.io/tokens/${gd.address}/token-holders?${params}`;
      console.log("fetching:", nextUrl);
      const { items, next_page_path } = await fetch(nextUrl).then(_ => _.json());
      if (items && items.length) {
        const foundBalances = items.map(i => i.match(/(0x\w{20,})|([0-9\.,]+ G\$)/g));
        const ps = foundBalances
          .filter(b => isSystemContract(b[0]) === false)
          .map(async b => {
            const curBalance = get(addresses, `${b[0]}.balance`, 0);
            const isNotContract = get(
              addresses,
              `${b[0]}.isNotContract`,
              (await gd.provider.getCode(b[0]).catch(e => "0x")) === "0x"
            );
            const cleanBalance = parseFloat(b[3].replace(/[,G$\s]/g, "")) * 100;
            addresses[b[0]] = updateBalance(addresses[b[0]], {
              balance: curBalance + cleanBalance,
              isNotContract
            });
          });
        await Promise.all(ps);
      }
      console.log("fetched:", { nextUrl, next_page_path });
      if (next_page_path) {
        let [, path] = next_page_path.match(/\?(.*$)/);
        params = path + "&type=JSON";
      } else return addresses;
    }
  };

  const getEthPlorerHolders = async (addresses: Balances = {}) => {
    let params = "type=JSON";

    let nextUrl = `https://api.ethplorer.io/getTopTokenHolders/${gdMainnet.address}?limit=1000&apiKey=${ethplorer_key}`;

    const { holders } = await fetch(nextUrl).then(_ => _.json());
    console.log("getEthplorerHolders", { holders });
    const ps = holders
      .filter(b => isSystemContract(b.address) === false)
      .map(async b => {
        const newBalance = get(addresses, `${b.address}.balance`, 0) + b.balance;
        const isNotContract = get(
          addresses,
          `${b.address}.isNotContract`,
          (await gdMainnet.provider.getCode(b.address).catch(e => "0x")) === "0x"
        );
        addresses[b.address] = updateBalance(addresses[b.address], {
          balance: newBalance,
          isNotContract
        });
      });
    console.log("getEthplorerHolders....");
    await Promise.all(ps);
    return addresses;
  };

  const getClaimsPerAddress = async (balances: Balances = {}) => {
    const latestBlock = await ubi.provider.getBlockNumber();
    const blocks = range(6200000, latestBlock, step);
    const filter = ubi.filters.UBIClaimed();

    for (let blockChunk of chunk(blocks, 10)) {
      // Get the filter (the second null could be omitted)
      const ps = blockChunk.map(async bc => {
        // Query the filter (the latest could be omitted)
        const logs = await ubi
          .queryFilter(filter, bc, Math.min(bc + step - 1, latestBlock))
          .catch(e => {
            console.log("block ubiclaimed logs failed retrying...", bc);
            return ubi.queryFilter(filter, bc, Math.min(bc + step - 1, latestBlock));
          });
        console.log("found claim logs in block:", { bc }, logs.length);
        // Print out all the values:
        logs.map(log => {
          const claims = get(balances[log.args.from], "claims", 0) + 1;
          balances[log.args.from] = updateBalance(balances[log.args.from], { claims });
        });
      });
      await Promise.all(ps);
    }
    return balances;
  };

  const calcRelativeRep = (balances: Balances) => {
    const totalSupply = Object.values(balances).reduce(
      (cur, data) => cur + data.balance,
      0
    );
    const totalClaims = Object.values(balances).reduce(
      (cur, data) => cur + (data.claims || 0),
      0
    );

    for (let addr in balances) {
      balances[addr].gdRepShare =
        totalSupply > 0 ? balances[addr].balance / totalSupply : 0;
      balances[addr].claimRepShare =
        totalClaims > 0 ? balances[addr].claims / totalClaims : 0;
    }
    return { totalSupply, totalClaims, balances };
  };

  const collectAirdropData = async () => {
    await getClaimsPerAddress().then(r =>
      fs.writeFileSync("claimBalances.json", JSON.stringify(r))
    );
    // await getEthPlorerHolders().then(r =>
    //   fs.writeFileSync("ethBalances.json", JSON.stringify(r))
    // );
    // await getBlockScoutHolders().then(r =>
    //   fs.writeFileSync("fuseBalances.json", JSON.stringify(r))
    // );
  };

  const buildMerkleTree = () => {
    const files = ["claimBalances.json", "ethBalances.json", "fuseBalances.json"].map(f =>
      JSON.parse(fs.readFileSync(f).toString())
    );

    const merge = (obj1, obj2, key) => {
      obj1 = { ...DefaultBalance, ...obj1 };
      obj1.claims = get(obj1, "claims", 0) + get(obj2, "claims", 0);
      obj1.balance = get(obj1, "balance", 0) + get(obj2, "balance", 0);
      obj1.isNotContract = get(obj1, "isNotContract", get(obj2, "isNotContract"));
      return obj1;
    };

    const data: Balances = mergeWith(files[0], ...files.slice(1), merge);

    let { totalSupply, totalClaims, balances } = calcRelativeRep(data);

    const REP_ALLOCATION = 12000000;
    let toTree: Array<[string, number, boolean]> = Object.entries(balances).map(
      ([addr, data]) => {
        let rep = data.claimRepShare * REP_ALLOCATION + data.gdRepShare * REP_ALLOCATION;
        return [addr, Math.round(rep), data.isNotContract];
      }
    );

    toTree = sortBy(toTree, "1")
      .reverse()
      .filter(x => x[1] > 0);

    const topContracts = toTree.filter(_ => _[2] === false);
    const totalReputationAirdrop = toTree.reduce((c, a) => c + a[1], 0);
    const foundationReputation = REP_ALLOCATION;
    console.log({
      topContracts,
      totalReputationAirdrop,
      foundationReputation,
      numberOfAccounts: toTree.length,
      totalGDSupply: totalSupply,
      totalClaims
    });

    const sorted = toTree.map(_ => _[1]);
    console.log("Reputation Distribution\nFoundation: 33%");
    [0.001, 0.01, 0.1, 0.5].forEach(q =>
      console.log({
        precentile: q * 100 + "%",
        rep: quantile(sorted, q) / (REP_ALLOCATION * 3)
      })
    );

    const treeData = {};
    const elements = toTree.map(e => {
      const hash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [e[0], e[1]])
      );
      treeData[e[0]] = {
        rep: e[1],
        hash
      };
      return Buffer.from(hash.slice(2), "hex");
    });

    const merkleTree = new MerkleTree(elements, true);
    // get the merkle root
    // returns 32 byte buffer
    const merkleRoot = merkleTree.getRoot().toString("hex");
    // generate merkle proof
    // returns array of 32 byte buffers
    const proof = merkleTree.getProof(elements[50]).map(_ => _.toString("hex"));
    console.log({ merkleRoot, proof, sampleProofFor: toTree[50] });
    fs.writeFileSync("airdrop.json", JSON.stringify({ treeData, merkleRoot }));
  };

  const getProof = addr => {
    const { treeData, merkleRoot } = JSON.parse(
      fs.readFileSync("airdrop.json").toString()
    );

    const elements = Object.entries(treeData as Tree).map(e =>
      Buffer.from(e[1].hash.slice(2), "hex")
    );

    const merkleTree = new MerkleTree(elements, true);
    const proof = merkleTree
      .getProof(Buffer.from(treeData[addr].hash.slice(2), "hex"))
      .map(_ => "0x" + _.toString("hex"));
    console.log({ proof, [addr]: treeData[addr] });
  };

  return { buildMerkleTree, collectAirdropData, getProof };
};
