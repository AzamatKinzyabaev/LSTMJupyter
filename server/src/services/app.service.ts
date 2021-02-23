import { ExpressService } from "../index";

export class AppService {
    constructor(){
        const expressService = new ExpressService()
    }
}

export const app = new AppService()
