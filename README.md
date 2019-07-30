# [GoodDollar](https://gooddollar.org) - GoodContracts
![CircleCI](https://circleci.com/gh/etoroxlabs/GoodContracts/tree/master.svg?style=svg&circle-token=fd84c75a2cd12485f1baf71dd073f9b67d16bd0d)
[![Coverage Status](https://coveralls.io/repos/github/etoroxlabs/GoodContracts/badge.svg?branch=master&t=dVBxdT)](https://coveralls.io/github/etoroxlabs/GoodContracts?branch=master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Contributing
Everyone is welcome: Developers, designers, and entrepreneurs with a passion for decentralized technologies and a vision to build a new world that has equality, security, inclusivity, and innovation as its cornerstones.
Refer to [GoodDocs](https://docs.gooddollar.org/contributing) for further information.

# Try GoodDollar
## Usage
To test the library and setup the development environment, issue the following commands in a shell:
```shell
  npm install
  npm run test # compile and test
```
## Deploying GoodDollar

Open the truffle console, exporting your passphrase and [infura](https://infura.io) API key
```shell
   MNEMONIC=<YOUR_PASSPHRASE> INFURA_API=<YOUR_API_KEY> $(npm bin)/truffle console --network <NETWORK>
```
Once the console is open, compile the contracts and run the migration script

### Prerequisites
You need to have [`node`](https://nodejs.org/) installed.
This repository has only been tested on UNIX-derived systems.

## Getting started
See [separate document](docs/design_overview.md).

## Files
Path | Description
------------- | -------------
`contracts/` | All the solidity files making up the implementation
`contracts/token` | Contains the GoodDollar implementation
`contracts/token/ERC677` | ERC677 implementation
`contracts/identity` | Defines the identity implementation, i.e. adding claimers and blacklisting
`contracts/dao` | Contains the daocreator for creating DAOs
`contracts/dao/schemes` | Contains different schemes that can be deployed, registered and used within the DAO 
`contracts/mocks` | Contracts used specifically for testing purposes
`test/`  | Contains testing code
`scripts/` | Specific scripts for testing and coverage

## Community
Below you can find a comprehensive list of useful links.
* Check out our [community](https://community.gooddollar.org/) website
* Check out our [Blog](https://medium.com/gooddollar)
* Join the Gooddollar Alpha by signing up [here](https://community.gooddollar.org/alpha/) and validating your identity
* Contribute to the code on our [GitHub](https://github.com/gooddollar)
* Join our community forum [here](https://forum.gooddollar.org/)
* Become an ambassador [here](https://community.gooddollar.org/ambassadors/)
* Request a sponsorship [here](https://community.gooddollar.org/sponsorships/)
* Follow us on [Twitter](https://twitter.com/TheGoodDollar)
* Join our [Telegram](http://t.me/GoodDollarX) group
* Like and subscribe on [Facebook](https://www.facebook.com/TheGoodDollar)
* Check out our [YouTube](https://www.youtube.com/channel/UC_8oVeHIUo9U8gAc2BwaviA/videos) video channel
* Subscribe to our [Medium](https://medium.com/@gooddollar) blog
* View our [terms and conditions](https://community.gooddollar.org/terms/)