## GoodDollar Staking Model

### Install

```
npm i
cd stakingModel; npm i
```

### test

```
npm run ganache:test
npm run test
```

skip .e2e.js tests (that require migrations)
`npm run test --networkd tdd`

### test without migrations

When you are working on a single contract and you deploy contract instances inside the test, it's faster without needing to go through the whole migrations every time

`npx truffle test --network tdd <file>`

### deploy dev env

make sure you set the following mnemonics in env

```
MNEMONIC
ADMIN_MNEMONIC
```

then

```
npm run ganache //(1 sec block time)
or
npm run ganache:test //(0 sec block time)

npm run start:withmain
```
