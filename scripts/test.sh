#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the ganache instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
    kill -9 $ganache_pid
  fi
}

if [ "$SOLIDITY_COVERAGE" = true ]; then
  ganache_port=8555
  gas_limit=0xfffffffffff
else
  ganache_port=8545
  gas_limit=8000000
fi

ganache_running() {
  nc -z localhost "$ganache_port"
}

start_ganache() {

  if [ "$SOLIDITY_COVERAGE" = true ]; then
    node_modules/.bin/testrpc-sc --gasLimit "$gas_limit" --port "$ganache_port" --quiet &
  else
    node_modules/.bin/ganache-cli --gasLimit "$gas_limit" --port "$ganache_port" --quiet &
  fi

  ganache_pid=$!
}

if ganache_running; then
  echo "Using existing ganache instance"
else
  echo "Starting our own ganache instance"
  start_ganache
fi

if [ "$SOLC_NIGHTLY" = true ]; then
  echo "Downloading solc nightly"
  wget -q https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/bin/soljson-nightly.js -O /tmp/soljson.js && find . -name soljson.js -exec cp /tmp/soljson.js {} \;
fi

truffle version

if [ "$SOLIDITY_COVERAGE" = true ]; then
  node_modules/.bin/solidity-coverage -q

  if [ "$CONTINUOUS_INTEGRATION" = true ]; then
    cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js
  fi
else
  node_modules/.bin/truffle test "$@"
fi