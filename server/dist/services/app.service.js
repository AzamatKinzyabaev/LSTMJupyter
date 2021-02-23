"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.AppService = void 0;
const index_1 = require("../index");
class AppService {
    constructor() {
        const expressService = new index_1.ExpressService();
    }
}
exports.AppService = AppService;
exports.app = new AppService();
