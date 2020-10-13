## Upgradable Contracts

This package is for new contracts that will be developed using Openzeppelin upgradable contracts system.

### Install

```
npm ci //npm i
```

### Deploy dev env

- create .env with:
  - MNEMONIC - deployment mnemonic
  - ADMIN_MNEMONIC - adminwallet contract permissioned addresses
  - INFURA_API/ALCHEMY_API optional if you want to deploy to testnets

```
export MNEMONIC= //export it here so ganache can use it
npm run ganache & //start ganache in develop mode
npm start // will install core + staking + upgradable contracts packages
```

### Upgrading process

see `migrations/2_donations.js` and `scripts/upgradableDeployer.js`

### Testnet (Ropsten)

- ProxyAdmin: '0x0f3858ba5826cd44dd26Db35f2D8E8E019d03996',
- DonationsStaking: '0x9a2Ab14F0f0621E4584457A97FDd7C1159f0cD15'
