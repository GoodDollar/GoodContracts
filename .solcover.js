module.exports = {
  norpc: true,
  testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
  compileCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle compile --network coverage',
  skipFiles: ['dao/schemes/GoodUBI.sol', 'dao/schemes/GoodUBI/BancorFormula.sol', 'dao/schemes/GoodUBI/ExpArray.sol', 'dao/schemes/GoodUBI/Math.sol']
}
