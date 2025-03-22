"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const http_1 = require("http");
const systeminformation_1 = __importDefault(require("systeminformation"));
const logger = __importStar(require("./logger"));
const STATS_FREQ = parseInt(process.env.WORKFLOW_TELEMETRY_STAT_FREQ || '') || 5000;
const SERVER_HOST = 'localhost';
// TODO
// It is better to find an available/free port automatically and use it.
// Then the post script (`post.ts`) needs to know the selected port.
const SERVER_PORT = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '') || 7777;
let expectedScheduleTime = 0;
let statCollectTime = 0;
///////////////////////////
// CPU Stats             //
///////////////////////////
const cpuStatsHistogram = [];
function collectCPUStats(statTime, timeInterval) {
    return systeminformation_1.default
        .currentLoad()
        .then((data) => {
        const cpuStats = {
            time: statTime,
            totalLoad: data.currentLoad,
            userLoad: data.currentLoadUser,
            systemLoad: data.currentLoadSystem
        };
        cpuStatsHistogram.push(cpuStats);
    })
        .catch((error) => {
        logger.error(error);
    });
}
///////////////////////////
// Memory Stats          //
///////////////////////////
const memoryStatsHistogram = [];
function collectMemoryStats(statTime, timeInterval) {
    return systeminformation_1.default
        .mem()
        .then((data) => {
        const memoryStats = {
            time: statTime,
            totalMemoryMb: data.total / 1024 / 1024,
            activeMemoryMb: data.active / 1024 / 1024,
            availableMemoryMb: data.available / 1024 / 1024
        };
        memoryStatsHistogram.push(memoryStats);
    })
        .catch((error) => {
        logger.error(error);
    });
}
///////////////////////////
// Network Stats         //
///////////////////////////
const networkStatsHistogram = [];
function collectNetworkStats(statTime, timeInterval) {
    return systeminformation_1.default
        .networkStats()
        .then((data) => {
        let totalRxSec = 0, totalTxSec = 0;
        for (let nsd of data) {
            totalRxSec += nsd.rx_sec;
            totalTxSec += nsd.tx_sec;
        }
        const networkStats = {
            time: statTime,
            rxMb: Math.floor((totalRxSec * (timeInterval / 1000)) / 1024 / 1024),
            txMb: Math.floor((totalTxSec * (timeInterval / 1000)) / 1024 / 1024)
        };
        networkStatsHistogram.push(networkStats);
    })
        .catch((error) => {
        logger.error(error);
    });
}
///////////////////////////
// Disk Stats            //
///////////////////////////
const diskStatsHistogram = [];
function collectDiskStats(statTime, timeInterval) {
    return systeminformation_1.default
        .fsStats()
        .then((data) => {
        let rxSec = data.rx_sec ? data.rx_sec : 0;
        let wxSec = data.wx_sec ? data.wx_sec : 0;
        const diskStats = {
            time: statTime,
            rxMb: Math.floor((rxSec * (timeInterval / 1000)) / 1024 / 1024),
            wxMb: Math.floor((wxSec * (timeInterval / 1000)) / 1024 / 1024)
        };
        diskStatsHistogram.push(diskStats);
    })
        .catch((error) => {
        logger.error(error);
    });
}
const diskSizeStatsHistogram = [];
function collectDiskSizeStats(statTime, timeInterval) {
    return systeminformation_1.default
        .fsSize()
        .then((data) => {
        let totalSize = 0, usedSize = 0;
        for (let fsd of data) {
            totalSize += fsd.size;
            usedSize += fsd.used;
        }
        const diskSizeStats = {
            time: statTime,
            availableSizeMb: Math.floor((totalSize - usedSize) / 1024 / 1024),
            usedSizeMb: Math.floor(usedSize / 1024 / 1024)
        };
        diskSizeStatsHistogram.push(diskSizeStats);
    })
        .catch((error) => {
        logger.error(error);
    });
}
///////////////////////////
function collectStats(triggeredFromScheduler = true) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const currentTime = Date.now();
            const timeInterval = statCollectTime
                ? currentTime - statCollectTime
                : 0;
            statCollectTime = currentTime;
            const promises = [];
            promises.push(collectCPUStats(statCollectTime, timeInterval));
            promises.push(collectMemoryStats(statCollectTime, timeInterval));
            promises.push(collectNetworkStats(statCollectTime, timeInterval));
            promises.push(collectDiskStats(statCollectTime, timeInterval));
            promises.push(collectDiskSizeStats(statCollectTime, timeInterval));
            return promises;
        }
        finally {
            if (triggeredFromScheduler) {
                expectedScheduleTime += STATS_FREQ;
                setTimeout(collectStats, expectedScheduleTime - Date.now());
            }
        }
    });
}
function startHttpServer() {
    const server = (0, http_1.createServer)((request, response) => __awaiter(this, void 0, void 0, function* () {
        try {
            switch (request.url) {
                case '/cpu': {
                    if (request.method === 'GET') {
                        response.end(JSON.stringify(cpuStatsHistogram));
                    }
                    else {
                        response.statusCode = 405;
                        response.end();
                    }
                    break;
                }
                case '/memory': {
                    if (request.method === 'GET') {
                        response.end(JSON.stringify(memoryStatsHistogram));
                    }
                    else {
                        response.statusCode = 405;
                        response.end();
                    }
                    break;
                }
                case '/network': {
                    if (request.method === 'GET') {
                        response.end(JSON.stringify(networkStatsHistogram));
                    }
                    else {
                        response.statusCode = 405;
                        response.end();
                    }
                    break;
                }
                case '/disk': {
                    if (request.method === 'GET') {
                        response.end(JSON.stringify(diskStatsHistogram));
                    }
                    else {
                        response.statusCode = 405;
                        response.end();
                    }
                    break;
                }
                case '/disk_size': {
                    if (request.method === 'GET') {
                        response.end(JSON.stringify(diskSizeStatsHistogram));
                    }
                    else {
                        response.statusCode = 405;
                        response.end();
                    }
                }
                case '/collect': {
                    if (request.method === 'POST') {
                        yield collectStats(false);
                        response.end();
                    }
                    else {
                        response.statusCode = 405;
                        response.end();
                    }
                    break;
                }
                default: {
                    response.statusCode = 404;
                    response.end();
                }
            }
        }
        catch (error) {
            logger.error(error);
            response.statusCode = 500;
            response.end(JSON.stringify({
                type: error.type,
                message: error.message
            }));
        }
    }));
    server.listen(SERVER_PORT, SERVER_HOST, () => {
        logger.info(`Stat server listening on port ${SERVER_PORT}`);
    });
}
// Init                  //
///////////////////////////
function init() {
    expectedScheduleTime = Date.now();
    logger.info('Starting stat collector ...');
    process.nextTick(collectStats);
    logger.info('Starting HTTP server ...');
    startHttpServer();
}
init();
///////////////////////////
