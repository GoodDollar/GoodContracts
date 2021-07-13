//update a contract's web3 to work with accounts read from keystore in production
import { ethers } from "hardhat";
export const getFounders = async network => {
  const accounts = await ethers.getSigners();
  let founders = accounts.slice(0, 3);
  if (network.indexOf("production") >= 0) {
    const keystore = JSON.parse(process.env.FOUNDERS_KEYSTORE);
    founders = keystore.map(key => {
      return ethers.Wallet.fromEncryptedJsonSync(
        JSON.stringify(key),
        process.env.FOUNDERS_PASSWORD
      ).connect(ethers.provider);
    });
  }

  await Promise.all(
    founders.map(async f => {
      const b = await ethers.provider.getBalance(f.address);
      console.log("founder balance:", { f: f.address, b });
      if (BigInt(b) < BigInt(ethers.utils.parseEther("0.004"))) {
        const toTop = ethers.utils.parseEther("0.009");
        const receipt = await founders[0].sendTransaction({
          to: f.address,
          value: toTop
        });
        await receipt.wait();
        console.log("topped founder,", { f, receipt });
      }
    })
  );
  return founders;
};
