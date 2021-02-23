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
exports.ExpressService = void 0;
const express_1 = __importDefault(require("express"));
const config_1 = __importDefault(require("config"));
const body_parser_1 = __importDefault(require("body-parser"));
const index_1 = require("../index");
class ExpressService {
    constructor(explicitLogs = false) {
        this.ready = false;
        this.port = -1;
        this.util = new index_1.UtilService();
        this.explicitLogs = explicitLogs;
        const bitfinex = new index_1.BitfinexController();
        this._app = express_1.default();
        this._app.use(body_parser_1.default.json());
        this._app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.header('Access-Control-Allow-Credentials', true);
            // console.log("fuck you cors!")
            next();
        });
        this.port = config_1.default.get('http.port');
        this._app.get('/', (req, res) => {
            res.send({
                online: true,
            });
        });
        this._app.get('/jupyter', (req, res) => __awaiter(this, void 0, void 0, function* () {
            const pairs = yield bitfinex.getJupyterPairs();
            res.send({
                status: 'online',
                pairs
            });
        }));
        this._app.get('/jupyter/:tradingPair', (req, res) => __awaiter(this, void 0, void 0, function* () {
            const tradingPair = req.params.tradingPair;
            let start = req.query.start || new Date('1970-01-01').getTime();
            let end = req.query.end || new Date().getTime();
            let limit = req.query.limit || 10000;
            let offset = req.query.offset || 0;
            start = new Date(start);
            end = new Date(end);
            limit = parseInt(limit);
            offset = parseInt(offset);
            const tickers = yield bitfinex.getJupyterFormatedData(tradingPair, start, end, limit, offset);
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
                params: {
                    start, end, limit, offset
                },
                Data: tickers
            });
        }));
        this._server = this._app.listen(this.port, () => {
            this.util.log(`HTTP Interface listening on port ${this.port}`);
            this.ready = true;
        });
    }
    close() {
        this._server.close();
        this.ready = false;
        this.port = -1;
        this._app = undefined;
        this._server = undefined;
    }
}
exports.ExpressService = ExpressService;
