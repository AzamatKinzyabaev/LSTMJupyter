import superagent from 'superagent'
import ws from 'ws'

import {
    MySQLService,
    UtilService
} from '../index'


export class BitfinexController {
    mysqlService:MySQLService = new MySQLService()
    util: UtilService = new UtilService()

    constructor(){

    }

    private ensableUrl(
        sourceCoin:string,
        targetCoin:string,
        start:Date,
        end:Date,
        limit:number=250
    ){
        let url = 'https://api-pub.bitfinex.com/v2/tickers/hist?'
        url += 'symbols=t' + sourceCoin + targetCoin + '&'
        url += 'start=' + start.getTime() + '&'
        url += 'end=' + end.getTime() + '&'
        url += 'limit=' + limit

        return url
    }

    private formatTicker(rawTicker:any){
        const pairType = rawTicker[0].charAt(0)
        const noPairType = rawTicker[0].split(pairType)[1]

        
        let sourceCurrency
        let targetCurrency

        if (noPairType.indexOf(':') < 0) {
            // split in half 
            sourceCurrency = noPairType.split('').splice(0, 3).join('')
            targetCurrency = noPairType.split('').splice(-3).join('')
        } else {
            sourceCurrency = noPairType.split(':')[0]
            targetCurrency = noPairType.split(':')[1]
        }
        const ticker = {
            pairType, sourceCurrency, targetCurrency,
            highestBidPrice: rawTicker[1],
            lowestAskPrice: rawTicker[3],
            timestamp: new Date(rawTicker[12])
        }

        return ticker
    }

    public async getTickersInRange(
        sourceCoin: string,
        targetCoin: string,
        start:Date,
        end:Date
    ){
        await this.util.wait(100)
        const res:any = await superagent.get(this.ensableUrl(sourceCoin, targetCoin, start, end))
        const tickers = []
        for (let i = 0; i < res.body.length; i++){
            const ticker:any = this.formatTicker(res.body[i])
            tickers.push(ticker)
            await this.storeTicker(ticker)
        }

        return tickers
    }

    private async storeTicker(ticker:any){
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
        ') on duplicate key update id=id'

        const res = await this.mysqlService.query(sql, [
            ticker.pairType,
            ticker.sourceCurrency,
            ticker.targetCurrency,
            ticker.highestBidPrice,
            ticker.lowestAskPrice,
            ticker.timestamp.getTime()
        ])

        // console.log('stored ticker @' + ticker.timestamp)
    }

    public async fillOlderTickers(
        sourceCoin: string,
        targetCoin: string
    ){
        // get the oldest ts on db 
        const sql = 'select timestamp from tickers order by timestamp asc limit 1'
        const res:any = await this.mysqlService.query(sql)
        const ts = res[0].timestamp 

        // intervals are 10 seconds 

        // max tickers per range are 250 

        // request that time as bg and that time minus 250 * 10 * 1000
        const end = ts.getTime()
        const start = new Date(end - (250 * 10 * 1000))


        console.log('fetching older rs from', ts)
        const bg = Date.now()
        const tickers = await this.getTickersInRange(
            sourceCoin, 
            targetCoin, 
            new Date(start), 
            new Date(end)
        )

        console.log('Took', ((Date.now() - bg) / 1000), 's to import the batch')
        
        if (tickers.length > 0){
            this.fillOlderTickers(sourceCoin, targetCoin)
        } else {
            console.log('no tickers found')
        }
        // assign that one as the limit and start iterating based upon it, until the program presumably dies
    }

    public async fillNewerTickers(
        sourceCoin: string,
        targetCoin: string
    ){
        
        // request that time as bg and that time minus 250 * 10 * 1000
        const ts = new Date()
        const start = ts.getTime()
        const end = new Date(start + (250 * 10 * 1000))

        console.log(end)
        console.log('fetching newer rs from', ts)
        const bg = Date.now()
        const tickers = await this.getTickersInRange(
            sourceCoin, 
            targetCoin, 
            new Date(start), 
            new Date(end)
        )

        console.log('Took', ((Date.now() - bg) / 1000), 's to import the batch')
        
        if (tickers.length > 0){
            await this.util.wait()
            this.fillNewerTickers(sourceCoin, targetCoin)
        } else {
            console.log('no tickers found')
        }
        // assign that one as the limit and start iterating based upon it, until the program presumably dies
    }


    public async startTickerListener(pair:PairType){
        const w = new ws('wss://api-pub.bitfinex.com/ws/2')

        // ping-pong listener, fuck this crap 
        let pingPongId = -1
        let pongIds:any = {}

        let pingId = setInterval(() => {
            pingPongId = Date.now()
            w.send(JSON.stringify({
                event: 'ping', 
                cid: pingPongId
             }))

             // set the pong to die in 5 seconds 
             pongIds[pingPongId] = setTimeout(() => {
                console.log('no pong, lets die')
                process.exit(1)
             }, 5 * 1000)
        }, 25 * 1000)

        console.log('pair:', pair)
        w.on('message', async (json:string) => {
            const msg = JSON.parse(json)
            if (msg.event){
                if (msg.event === 'pong'){
                    console.log('received pong')

                    clearTimeout(pongIds[msg.cid])
                }
                return console.log('EVENT:', msg)
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
                //FRR_AMOUNT_AVAILABLE: msg[1][14]
            }

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
            '?,?,?,?,?)' 

            try {
                const res = await this.mysqlService.query(sql, [
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
                ])

                console.log('ticker inserted into db')
            } catch (e){
                console.error(e)
            }
            console.log('ws ticker:', ticker)

        })
        
        let msg = JSON.stringify({ 
          event: 'subscribe', 
          channel: 'ticker', 
          symbol: pair
        })
        
        w.on('open', () => w.send(msg))
    }

    public async getJupyterPairs(){
        const sql = 'select distinct pair from tickers'
        const res:any = await this.mysqlService.query(sql)
        const pairs = []
        for (let i = 0; i < res.length; i++){
            pairs.push(res[i].pair)
        }

        return pairs
    }

    public async getJupyterFormatedData(
        pair:PairType,
        start:Date = new Date('1970-01-01'),
        end:Date = new Date(),
        limit:number = 10000,
        offset:number = 0
    ){
        const sql = 'select * from tickers ' +
        'where pair=? ' +
        'and timestamp > FROM_UNIXTIME(?) ' +
        'and timestamp < FROM_UNIXTIME(?) ' +
        'order by id asc '+
        'LIMIT ? ' +
        'OFFSET ? '

        const rawTickers:any = await this.mysqlService.query(sql, [
            pair, start.getTime() / 1000, end.getTime() / 1000, limit, offset
        ])

        const tickers = []
        for (let i = 0; i < rawTickers.length; i++){
            const raw = rawTickers[i]
            tickers.push({
                time: (new Date(raw.timestamp).getTime() / 1000),
                high: raw.high,
                low:raw.low,
                open:raw.ask,
                close:raw.bid,
                volumeFrom: raw.volume,
                volumeTo: raw.volume,
                conversionType: 'direct',
                conversionSymbol: ''
            })
        }
        return tickers
    }

}

export type PairType = "tAAVE:USD" |
"tADAUSD" |
"tALGUSD" |
"tAMPUSD" |
"tANTUSD" |
"tASTUSD" |
"tATOUSD" |
"tAVAX:USD" |
"tAVTUSD" |
"tB21X:USD" |
"tBALUSD" |
"tBAND:USD" |
"tBATUSD" |
"tBCHABC:USD" |
"tBCHN:USD" |
"tBFTUSD" |
"tBNTUSD" |
"tBOXUSD" |
"tBSVUSD" |
"tBTCUSD" |
"tBTGUSD" |
"tBTSE:USD" |
"tBTTUSD" |
"tCHZUSD" |
"tCLOUSD" |
"tCNDUSD" |
"tCOMP:USD" |
"tCTKUSD" |
"tCTXUSD" |
"tDAIUSD" |
"tDAPP:USD" |
"tDATUSD" |
"tDGBUSD" |
"tDGXUSD" |
"tDOGUSD" |
"tDOTUSD" |
"tDRNUSD" |
"tDSHUSD" |
"tDTAUSD" |
"tDTXUSD" |
"tDUSK:USD" |
"tEDOUSD" |
"tEGLD:USD" |
"tENJUSD" |
"tEOSDT:USD" |
"tEOSUSD" |
"tESSUSD" |
"tETCUSD" |
"tETH2X:USD" |
"tETHUSD" |
"tETPUSD" |
"tEUSUSD" |
"tEUTUSD" |
"tEXRD:USD" |
"tFETUSD" |
"tFILUSD" |
"tFTTUSD" |
"tFUNUSD" |
"tGENUSD" |
"tGNOUSD" |
"tGNTUSD" |
"tGOTUSD" |
"tGTXUSD" |
"tHEZUSD" |
"tHOTUSD" |
"tIOSUSD" |
"tIOTUSD" |
"tIQXUSD" |
"tJSTUSD" |
"tKANUSD" |
"tKNCUSD" |
"tKSMUSD" |
"tLEOUSD" |
"tLINK:USD" |
"tLRCUSD" |
"tLTCUSD" |
"tLYMUSD" |
"tMANUSD" |
"tMGOUSD" |
"tMKRUSD" |
"tMLNUSD" |
"tMNAUSD" |
"tMTNUSD" |
"tNCAUSD" |
"tNECUSD" |
"tNEOUSD" |
"tNUTUSD" |
"tODEUSD" |
"tOKBUSD" |
"tOMGUSD" |
"tOMNUSD" |
"tONLUSD" |
"tORSUSD" |
"tPASUSD" |
"tPAXUSD" |
"tPLUUSD" |
"tPNKUSD" |
"tPOAUSD" |
"tQSHUSD" |
"tQTMUSD" |
"tRBTUSD" |
"tRCNUSD" |
"tREPUSD" |
"tREQUSD" |
"tRIFUSD" |
"tRINGX:USD" |
"tRRBUSD" |
"tRRTUSD" |
"tSANUSD" |
"tSNGUSD" |
"tSNTUSD" |
"tSNXUSD" |
"tSOLUSD" |
"tSTJUSD" |
"tSUNUSD" |
"tSUSHI:USD" |
"tSWMUSD" |
"tTESTBTC:TESTUSD" |
"tTKNUSD" |
"tTRIUSD" |
"tTRXUSD" |
"tTSDUSD" |
"tUDCUSD" |
"tUNIUSD" |
"tUOPUSD" |
"tUOSUSD" |
"tUSKUSD" |
"tUSTUSD" |
"tUTKUSD" |
"tVEEUSD" |
"tVETUSD" |
"tVSYUSD" |
"tWAXUSD" |
"tWBTUSD" |
"tWPRUSD" |
"tWTCUSD" |
"tXAUT:USD" |
"tXCHUSD" |
"tXDCUSD" |
"tXLMUSD" |
"tXMRUSD" |
"tXRAUSD" |
"tXRPUSD" |
"tXSNUSD" |
"tXTZUSD" |
"tXVGUSD" |
"tYFIUSD" |
"tYGGUSD" |
"tYYWUSD" |
"tZBTUSD" |
"tZCNUSD" |
"tZECUSD" |
"tZILUSD" 