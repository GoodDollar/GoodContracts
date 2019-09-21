export const MAX_UINT_256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
export const NULL_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const SOME_HASH = '0x1000000000000000000000000000000000000000000000000000000000000000';
export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const SOME_ADDRESS = '0x1000000000000000000000000000000000000000';

export const increaseTime = async function(duration) {
  const id = await Date.now();

  web3.providers.HttpProvider.prototype.sendAsync = web3.providers.HttpProvider.prototype.send;

  return new Promise((resolve, reject) => {
    (web3 as any).currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id: id,
    }, err1 => {
      if (err1) return reject(err1);

      (web3 as any).currentProvider.sendAsync({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id + 1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res);
      });
    });
  });
};

export const toGD = stringAmount => (parseInt(stringAmount) * 100).toString()

export type ThenArg<T> = T extends Promise <infer U> ? U :
  T extends (...args: any[]) => Promise<infer U> ? U :
  T;

export async function assertVMException<T>(error: Promise<T>, message) {
  try {
    await error;
    assert(false, 'Expected error but it succeeded');
  } catch (error) {
    let condition = (
      error.message.search(message) > -1
    );
    assert.isTrue(condition, 'Expected specefic VM Exception, got this instead: \n ' + error.message);
  };
};

export async function assertVMRevert<T>(error: Promise<T>) {
  try {
    await error;
    assert(false, 'Expected error but it succeeded');
  } catch (error) {
    let condition = (
      error.message.search('VM Exception while processing transaction: revert') > -1
    );
    assert.isTrue(condition, 'Expected revert VM Exception, got this instead: \n ' + error.message);
  }
};