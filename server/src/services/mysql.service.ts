import mysql from 'mysql'
import config from 'config'

import { UtilService } from '../index'

export class MySQLService {
  // change later on to get the actual ip
  ip = '127.0.0.1'

  util: UtilService = new UtilService()

  protected _pool: mysql.Pool
  explicitLogs: boolean

  constructor(
  	mysqlOptions:mysql.PoolConfig = config.get('mysql'),
  	explicitLogs = false
  ){

  	this.explicitLogs = explicitLogs

  	this._pool = mysql.createPool(mysqlOptions)

  	// launch control query to verify the connection can be established

  	//this.checkConnection()
  }

  public async isConnected():Promise<boolean>{
  	try {
  		const sql = 'SELECT * FROM ' +
      'information_schema.tables ' +
      'where table_schema=?'

  		const query = await this.query(sql, config.get('mysql.database'))

  		return true
  	} catch (e){
  		// skip reporting on the error
  		return false
  	}
  }

  public async checkConnection(){
  	try {
  		const sql = 'SELECT * FROM ' +
      'information_schema.tables ' +
      'where table_schema=?'

  		const query = await this.query(sql, config.get('mysql.database'))
  	} catch (e){
  		this.util.logError(e)
  	}
  }

  public query(
  	sql: string, 
  	params:Array<string | number> = [],
  	logReplacedQuery = false
  ) : Promise<any> {

  	if (logReplacedQuery ||this.explicitLogs){
  		const parts = sql.split('?')
  		let ensambled = ''

  		for (let i = 0; i < parts.length; i++){
  			if (!params[i]) continue
  			ensambled += parts[i] + '"' + params[i] + '"'
  		}

  		console.log(ensambled)

  	}
    

  	return new Promise((resolve:Function, reject:Function) => {
  		this._pool.query(sql, params, (err:any, res:any) => {
  			if (err) reject(err)
  			resolve(res)
  		})
  	})
  }

  public async close(){
  	return new Promise((resolve:Function, reject:Function) => {
  		this._pool.end((err) => {
  			if (err) reject (err)
  			resolve()
  		})
  	})
  }



}
