const app = require('../dist/index')
const BitfinexController = app.BitfinexController
const bfCtrl = new BitfinexController()
bfCtrl.startTickerListener('tBTCUSD')