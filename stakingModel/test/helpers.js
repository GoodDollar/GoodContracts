export const increase_days = async function(days = 1) {
  const id = await Date.now();
  const duration = days * 86400;
  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [duration],
      id: id + 1
    },
    () => {}
  );
  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_mine",
      id: id + 1
    },
    () => {}
  );
};

const delay = async timeout => {
  return new Promise((res, rej) => {
    setTimeout(res, timeout);
  });
};
export const next_interval_reg = async function(interval) {
  let blocks = interval;
  for (let i = 0; i < blocks; ++i)
    await web3.currentProvider.send(
      { jsonrpc: "2.0", method: "evm_mine", id: 12345 + i },
      () => {}
    );
};

export const next_interval = async function(interval = 5760) {
  let blocks = interval;
  let ps = [];
  for (let i = 0; i < blocks; ++i) {
    ps.push(
      web3.currentProvider.send(
        { jsonrpc: "2.0", method: "evm_mine", id: 1337 },
        () => {}
      )
    );
    if (i % 100 === 0) {
      console.log("evm_mine", i);
      await delay(500);
    }
  }
  return Promise.all(ps);
};

export const next_interval_batch = async function(interval) {
  let blocks = interval;
  let batch = web3.BatchRequest();
  for (let i = 0; i < blocks; ++i)
    batch.add(
      web3.currentProvider.call({ jsonrpc: "2.0", method: "evm_mine", id: 123 }, () => {})
    );
  return batch.execute();
};
