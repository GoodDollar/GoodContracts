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
}

export const next_interval = async function() {
    let blocks = 5760;
    for (let i = 0; i < blocks; ++i)
      await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine", id: 123 }, () => {});
}

export const next_interval_promise = async function() {
    let blocks = 5760;
    let ps = [];
    for (let i = 0; i < blocks; ++i)
      ps.push(
        web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine", id: 123 }, () => {})
      );
    return Promise.all(ps);
}

export const next_interval_batch = async function() {
    let blocks = 5760;
    let batch = web3.BatchRequest();
    for (let i = 0; i < blocks; ++i)
      batch.add(web3.currentProvider.call({ jsonrpc: "2.0", method: "evm_mine", id: 123 }, () => {}));
    return batch.execute();
}