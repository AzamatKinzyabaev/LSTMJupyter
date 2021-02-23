"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitfinexController = void 0;
const superagent_1 = __importDefault(require("superagent"));
const ws_1 = __importDefault(require("ws"));
const index_1 = require("../index");
class BitfinexController {
    constructor() {
        this.mysqlService = new index_1.MySQLService();
        this.util = new index_1.UtilService();
    }
    ensableUrl(sourceCoin, targetCoin, start, end, limit = 250) {
        let url = 'https://api-pub.bitfinex.com/v2/tickers/hist?';
        url += 'symbols=t' + sourceCoin + targetCoin + '&';
        url += 'start=' + start.getTime() + '&';
        url += 'end=' + end.getTime() + '&';
        url += 'limit=' + limit;
        return url;
    }
    formatTicker(rawTicker) {
        const pairType = rawTicker[0].charAt(0);
        const noPairType = rawTicker[0].split(pairType)[1];
        let sourceCurrency;
        let targetCurrency;
        if (noPairType.indexOf(':') < 0) {
            // split in half 
            sourceCurrency = noPairType.split('').splice(0, 3).join('');
            targetCurrency = noPairType.split('').splice(-3).join('');
        }
        else {
            sourceCurrency = noPairType.split(':')[0];
            targetCurrency = noPairType.split(':')[1];
        }
        const ticker = {
            pairType, sourceCurrency, targetCurrency,
            highestBidPrice: rawTicker[1],
            lowestAskPrice: rawTicker[3],
            timestamp: new Date(rawTicker[12])
        };
        return ticker;
    }
    getTickersInRange(sourceCoin, targetCoin, start, end) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.util.wait(100);
            const res = yield superagent_1.default.get(this.ensableUrl(sourceCoin, targetCoin, start, end));
            const tickers = [];
            for (let i = 0; i < res.body.length; i++) {
                const ticker = this.formatTicker(res.body[i]);
                tickers.push(ticker);
                yield this.storeTicker(ticker);
            }
            return tickers;
        });
    }
    storeTicker(ticker) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = 'insert into tickers (' +
                'pairType,' +
                'sourceCurrency,' +
                'targetCurrency,' +
                'highestBidPrice,' +
                'lowestAskPrice,' +
                'timestamp' +
                ') values (' +
                '?,?,?,?,?,' +
                'FROM_UNIXTIME(? * 0.001)' +
                ') on duplicate key update id=id';
            const res = yield this.mysqlService.query(sql, [
                ticker.pairType,
                ticker.sourceCurrency,
                ticker.targetCurrency,
                ticker.highestBidPrice,
                ticker.lowestAskPrice,
                ticker.timestamp.getTime()
            ]);
            // console.log('stored ticker @' + ticker.timestamp)
        });
    }
    fillOlderTickers(sourceCoin, targetCoin) {
        return __awaiter(this, void 0, void 0, function* () {
            // get the oldest ts on db 
            const sql = 'select timestamp from tickers order by timestamp asc limit 1';
            const res = yield this.mysqlService.query(sql);
            const ts = res[0].timestamp;
            // intervals are 10 seconds 
            // max tickers per range are 250 
            // request that time as bg and that time minus 250 * 10 * 1000
            const end = ts.getTime();
            const start = new Date(end - (250 * 10 * 1000));
            console.log('fetching older rs from', ts);
            const bg = Date.now();
            const tickers = yield this.getTickersInRange(sourceCoin, targetCoin, new Date(start), new Date(end));
            console.log('Took', ((Date.now() - bg) / 1000), 's to import the batch');
            if (tickers.length > 0) {
                this.fillOlderTickers(sourceCoin, targetCoin);
            }
            else {
                console.log('no tickers found');
            }
            // assign that one as the limit and start iterating based upon it, until the program presumably dies
        });
    }
    fillNewerTickers(sourceCoin, targetCoin) {
        return __awaiter(this, void 0, void 0, function* () {
            // request that time as bg and that time minus 250 * 10 * 1000
            const ts = new Date();
            const start = ts.getTime();
            const end = new Date(start + (250 * 10 * 1000));
            console.log(end);
            console.log('fetching newer rs from', ts);
            const bg = Date.now();
            const tickers = yield this.getTickersInRange(sourceCoin, targetCoin, new Date(start), new Date(end));
            console.log('Took', ((Date.now() - bg) / 1000), 's to import the batch');
            if (tickers.length > 0) {
                yield this.util.wait();
                this.fillNewerTickers(sourceCoin, targetCoin);
            }
            else {
                console.log('no tickers found');
            }
            // assign that one as the limit and start iterating based upon it, until the program presumably dies
        });
    }
    startTickerListener(pair) {
        return __awaiter(this, void 0, void 0, function* () {
            const w = new ws_1.default('wss://api-pub.bitfinex.com/ws/2');
            // ping-pong listener, fuck this crap 
            let pingPongId = -1;
            let pongIds = {};
            let pingId = setInterval(() => {
                pingPongId = Date.now();
                w.send(JSON.stringify({
                    event: 'ping',
                    cid: pingPongId
                }));
                // set the pong to die in 5 seconds 
                pongIds[pingPongId] = setTimeout(() => {
                    console.log('no pong, lets die');
                    process.exit(1);
                }, 5 * 1000);
            }, 25 * 1000);
            console.log('pair:', pair);
            w.on('message', (json) => __awaiter(this, void 0, void 0, function* () {
                const msg = JSON.parse(json);
                if (msg.event) {
                    if (msg.event === 'pong') {
                        console.log('received pong');
                        clearTimeout(pongIds[msg.cid]);
                    }
                    return console.log('EVENT:', msg);
                }
                const ticker = {
                    CHAIN_ID: msg[0],
                    CHANNEL_ID: msg[1][0],
                    //FRR: msg[1][1],
                    BID: msg[1][0],
                    //BID_PERIOD: msg[1][3],
                    BID_SIZE: msg[1][1],
                    ASK: msg[1][2],
                    //ASK_PERIOD: msg[1][6],
                    ASK_SIZE: msg[1][3],
                    DAILY_CHANGE: msg[1][4],
                    DAILY_CHANGE_RELATIVE: msg[1][5],
                    LAST_PRICE: msg[1][6],
                    VOLUME: msg[1][7],
                    HIGH: msg[1][8],
                    LOW: msg[1][9],
                };
                const sql = 'insert into tickers (' +
                    'pair, ' +
                    'timestamp, ' +
                    'bid, ' +
                    'bid_size, ' +
                    'ask, ' +
                    'ask_size, ' +
                    'daily_change, ' +
                    'daily_change_relative, ' +
                    'last_price, ' +
                    'high, ' +
                    'low, ' +
                    'volume ' +
                    ') values (' +
                    '?, utc_timestamp(),' +
                    '?,?,?,?,?,' +
                    '?,?,?,?,?)';
                try {
                    const res = yield this.mysqlService.query(sql, [
                        pair,
                        ticker.BID,
                        ticker.BID_SIZE,
                        ticker.ASK,
                        ticker.ASK_SIZE,
                        ticker.DAILY_CHANGE,
                        ticker.DAILY_CHANGE_RELATIVE,
                        ticker.LAST_PRICE,
                        ticker.VOLUME,
                        ticker.HIGH,
                        ticker.LOW,
                    ]);
                    console.log('ticker inserted into db');
                }
                catch (e) {
                    console.error(e);
                }
                console.log('ws ticker:', ticker);
            }));
            let msg = JSON.stringify({
                event: 'subscribe',
                channel: 'ticker',
                symbol: pair
            });
            w.on('open', () => w.send(msg));
        });
    }
    getJupyterPairs() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = 'select distinct pair from tickers';
            const res = yield this.mysqlService.query(sql);
            const pairs = [];
            for (let i = 0; i < res.length; i++) {
                pairs.push(res[i].pair);
            }
            return pairs;
        });
    }
    getJupyterFormatedData(pair, start = new Date('1970-01-01'), end = new Date(), limit = 10000, offset = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = 'select * from tickers ' +
                'where pair=? ' +
                'and timestamp > FROM_UNIXTIME(?) ' +
                'and timestamp < FROM_UNIXTIME(?) ' +
                'order by id asc ' +
                'LIMIT ? ' +
                'OFFSET ? ';
            const rawTickers = yield this.mysqlService.query(sql, [
                pair, start.getTime() / 1000, end.getTime() / 1000, limit, offset
            ]);
            const tickers = [];
            for (let i = 0; i < rawTickers.length; i++) {
                const raw = rawTickers[i];
                tickers.push({
                    time: (new Date(raw.timestamp).getTime() / 1000),
                    high: raw.high,
                    low: raw.low,
                    open: raw.ask,
                    close: raw.bid,
                    volumeFrom: raw.volume,
                    volumeTo: raw.volume,
                    conversionType: 'direct',
                    conversionSymbol: ''
                });
            }
            return tickers;
        });
    }
}
exports.BitfinexController = BitfinexController;
