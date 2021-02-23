const app = require('../dist/index')
const BitfinexController = app.BitfinexController

const bfCtrl = new BitfinexController()

//bfCtrl.fillNewerTickers('ETH', 'USD')
//bfCtrl.fillOlderTickers('ETH', 'USD')
/*
bfCtrl.getTickersInRange(
    'ETH', 'USD',
    new Date('2020-01-02'),
    new Date('2020-01-01'),
).then(console.log).catch(console.error)
*/

bfCtrl.startTickerListener('tETHUSD')