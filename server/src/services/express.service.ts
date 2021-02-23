import express from 'express'
import config from 'config'
import bodyParser from 'body-parser'

import {
	MySQLService,
    BitfinexController,
    
    UtilService,
    
    PairType
} from '../index'

export class ExpressService {
    _app: express.Express | undefined
    _server: any
    ready = false
    port = -1

    util: UtilService = new UtilService()

    explicitLogs: boolean

    constructor(
    	explicitLogs = false
    ){
        this.explicitLogs = explicitLogs
        
        const bitfinex = new BitfinexController()

    	this._app = express()

    	this._app.use(bodyParser.json())

    	this._app.use((req:express.Request, res:any, next:Function) => {
    		res.header('Access-Control-Allow-Origin', '*')
    		res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    		res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    		res.header('Access-Control-Allow-Credentials', true)
    		// console.log("fuck you cors!")
    		next()
    	})


    	this.port = config.get('http.port')


		this._app.get('/', (req:express.Request, res:express.Response) => {
			res.send({
				online: true,
			})
        })

        this._app.get('/jupyter', async (req:express.Request, res:express.Response) => {
            const pairs:any = await bitfinex.getJupyterPairs()
            res.send({
                status: 'online',
                pairs
            })
        })
        
        this._app.get('/jupyter/:tradingPair', async (req:express.Request, res:express.Response) => {
            const tradingPair:any = req.params.tradingPair

            let start:any = req.query.start || new Date('1970-01-01').getTime()
            let end:any = req.query.end || new Date().getTime()
            let limit:any = req.query.limit || 10000
            let offset:any = req.query.offset || 0

            start = new Date(start)
            end = new Date(end)

            limit = parseInt(limit) 
            offset = parseInt(offset) 

            const tickers = await bitfinex.getJupyterFormatedData(
                tradingPair,
                start,
                end,
                limit,
                offset
            )

            res.send({
                Response: 'Success',
                Type: 100,
                Aggregated: false,
                TimeTo: new Date(end),
                TimeFrom: new Date(start),
                FirstValueInArray: true,
                ConversionType: {
                    type: 'direct',
                    conversionSymbol: ''
                },
                params : {
                    start, end, limit, offset
                },
                Data: tickers
			})
        })


    	this._server = this._app.listen(this.port, () => {
    		this.util.log(`HTTP Interface listening on port ${this.port}`)

    		this.ready = true

    	})

    }

    close(){
    	this._server.close()
    	this.ready = false
    	this.port = -1
    	this._app = undefined
    	this._server = undefined
    }




    

}