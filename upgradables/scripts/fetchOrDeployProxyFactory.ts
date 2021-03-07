/***
 * Use openzeppelin ProxyFactory to deploy the proxy contracts with create2
 * so we can make sure proxies have same address across chains
 */

import { fetchOrDeploy, getVersion } from "@openzeppelin/upgrades-core";
import ProxyFactoryABI from "@openzeppelin/upgrades/build/contracts/ProxyFactory.json";
import { ethers } from "hardhat";

export const fetchOrDeployProxyFactory = async () => {
  const proxyFactory = await ethers.getContractFactory(
    ProxyFactoryABI.abi,
    ProxyFactoryABI.bytecode
  );
  const factoryAddress = await fetchOrDeploy(
    getVersion(ProxyFactoryABI.bytecode, ProxyFactoryABI.bytecode),
    ethers.provider,
    async () => {
      const res = await proxyFactory.deploy();
      const deployment = {
        address: res.address,
        txHash: res.deployTransaction.hash,
        layout: null
      };
      return deployment;
    }
  );
  const proxyFactoryInst = proxyFactory.attach(factoryAddress);
  return deployWrapper(proxyFactoryInst);
};

const deployWrapper = factory => {
  return {
    factory,
    deploy: async (impl, adminAddress, data) => {
      const deployTransaction = await factory["deploy(uint256,address,address,bytes)"](
        0,
        impl,
        adminAddress,
        data
      );
      const res = await deployTransaction.wait();
      const address = res.events.find(e => e.event == "ProxyCreated").args.proxy;
      console.log("Proxy created by factory at:", address);
      return { address, deployTransaction };
    }
  };
};
