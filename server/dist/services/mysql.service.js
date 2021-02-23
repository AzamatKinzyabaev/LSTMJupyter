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
exports.MySQLService = void 0;
const mysql_1 = __importDefault(require("mysql"));
const config_1 = __importDefault(require("config"));
const index_1 = require("../index");
class MySQLService {
    constructor(mysqlOptions = config_1.default.get('mysql'), explicitLogs = false) {
        // change later on to get the actual ip
        this.ip = '127.0.0.1';
        this.util = new index_1.UtilService();
        this.explicitLogs = explicitLogs;
        this._pool = mysql_1.default.createPool(mysqlOptions);
        // launch control query to verify the connection can be established
        //this.checkConnection()
    }
    isConnected() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sql = 'SELECT * FROM ' +
                    'information_schema.tables ' +
                    'where table_schema=?';
                const query = yield this.query(sql, config_1.default.get('mysql.database'));
                return true;
            }
            catch (e) {
                // skip reporting on the error
                return false;
            }
        });
    }
    checkConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sql = 'SELECT * FROM ' +
                    'information_schema.tables ' +
                    'where table_schema=?';
                const query = yield this.query(sql, config_1.default.get('mysql.database'));
            }
            catch (e) {
                this.util.logError(e);
            }
        });
    }
    query(sql, params = [], logReplacedQuery = false) {
        if (logReplacedQuery || this.explicitLogs) {
            const parts = sql.split('?');
            let ensambled = '';
            for (let i = 0; i < parts.length; i++) {
                if (!params[i])
                    continue;
                ensambled += parts[i] + '"' + params[i] + '"';
            }
            console.log(ensambled);
        }
        return new Promise((resolve, reject) => {
            this._pool.query(sql, params, (err, res) => {
                if (err)
                    reject(err);
                resolve(res);
            });
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this._pool.end((err) => {
                    if (err)
                        reject(err);
                    resolve();
                });
            });
        });
    }
}
exports.MySQLService = MySQLService;
