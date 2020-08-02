
const getFounders = async (web3, network) => {
    const accounts = await web3.eth.getAccounts();
    let founders = [accounts[0]];
    if(network.indexOf('production')>=0)
    {
        const keystore = JSON.parse(process.env.FOUNDERS_KEYSTORE)
        web3.eth.accounts.wallet.decrypt(keystore,process.env.FOUNDERS_PASSWORD)
        founders = keystore.map(_ => "0x"+_.address)
        web3.eth.defaultAccount = founders[0]
    }
    
    await Promise.all(founders.map(async f => {
        const b = await web3.eth.getBalance(f)
        console.log("founder balance:",{f,b})
        if(BigInt(b)<BigInt(web3.utils.toWei('0.004','ether')))
        {
            const toTop = (BigInt(web3.utils.toWei('0.009','ether')) - BigInt(b)).toString()
            const receipt = await web3.eth.sendTransaction({from:accounts[0],to:f,value:toTop})
            console.log("topped founder,",{f,receipt})
        }
    }))
    return founders

}
module.exports = getFounders
