# ABQ Capital Data Server

## Install
Clone this repo, then `cd` into the right folder and install via NPM:

```bash
$ git clone https://github.com/AzamatKinzyabaev/LSTMJupyter
$ cd LSTMJupyter/server
$ npm install
```

## Running the Bitfinex/Jupyter API
You must connect your repository to a MySQL database configured for the project, then run:
```bash
$ npm start
```

## Running the data listeners
You can create a listener that will store Bitfinex ticker's into your configured MySQL instance. To do so, create a new file under `scripts` following the convention found in `start-bitfinex-btc-usd-listener.js`:

```javascript
const app = require('../dist/index')
const BitfinexController = app.BitfinexController
const bfCtrl = new BitfinexController()

bfCtrl.startTickerListener('tBTCUSD')
```

If you want to run in forever mode (the listener will kill itself and refresh the instance upon problems to ensure continued data collection) do it via `pm2`:
```bash
$ sudo npm install -g pm2
$ tsc && pm2 start dist/index.js
```
