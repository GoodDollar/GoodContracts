#!/usr/bin/env bash

# Notes:
#  - Shchema: https://github.com/trufflesuite/truffle/tree/develop/packages/truffle-contract-schema
#  - bytecode vs deployedBytecode: https://ethereum.stackexchange.com/questions/32234/difference-between-bytecode-and-runtime-bytecode
# FILES=`find $1 -name '*.json' ! -name '*.dbg.json'`
find $1 -name "*.json" ! -name '*.*.json' |while read fname; do
  echo "$fname"
  #[ -z "${i%%*.min.json}" ] && continue # already minified
  f=${fname##*/}
  m=./build/contracts/${f%%.json}.min.json
  echo "Minimizing contract json artifact: $fname"
  echo "Original size: $(wc -c "$fname")"
  ./node_modules/node-jq/bin/jq -c 'del(.bytecode,.deployedBytecode,.ast,.legacyAST,.source,.deployedSourceMap,.userdoc,.sourcePath)' $fname > $m
  echo "Minimized size: $(wc -c "$m")"
done
