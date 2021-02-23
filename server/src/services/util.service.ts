export class UtilService {
    constructor(){}

    log(...args:Array<string | number | boolean>){
        console.log(...args)
    }

    logError(...args:Array<string | number | boolean>){
        console.error(...args)
    }

    async wait(ms:number = 500){
        return new Promise((resolve:any, reject:any) => {
            console.log(`waiting ${ms} ms`)
            setTimeout(() => {
                resolve()
            }, ms)
        })
    }
}