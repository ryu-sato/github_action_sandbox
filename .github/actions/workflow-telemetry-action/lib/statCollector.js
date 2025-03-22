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
exports.report = exports.finish = exports.start = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const core = __importStar(require("@actions/core"));
const logger = __importStar(require("./logger"));
const STAT_SERVER_PORT = 7777;
const BLACK = '#000000';
const WHITE = '#FFFFFF';
function triggerStatCollect() {
    return __awaiter(this, void 0, void 0, function* () {
        logger.debug('Triggering stat collect ...');
        const response = yield axios_1.default.post(`http://localhost:${STAT_SERVER_PORT}/collect`);
        if (logger.isDebugEnabled()) {
            logger.debug(`Triggered stat collect: ${JSON.stringify(response.data)}`);
        }
    });
}
function reportWorkflowMetrics() {
    return __awaiter(this, void 0, void 0, function* () {
        const theme = core.getInput('theme', { required: false });
        let axisColor = BLACK;
        switch (theme) {
            case 'light':
                axisColor = BLACK;
                break;
            case 'dark':
                axisColor = WHITE;
                break;
            default:
                core.warning(`Invalid theme: ${theme}`);
        }
        const { userLoadX, systemLoadX } = yield getCPUStats();
        const { activeMemoryX, availableMemoryX } = yield getMemoryStats();
        const { networkReadX, networkWriteX } = yield getNetworkStats();
        const { diskReadX, diskWriteX } = yield getDiskStats();
        const { diskAvailableX, diskUsedX } = yield getDiskSizeStats();
        const cpuLoad = userLoadX && userLoadX.length && systemLoadX && systemLoadX.length
            ? yield getStackedAreaGraph({
                label: 'CPU Load (%)',
                axisColor,
                areas: [
                    {
                        label: 'User Load',
                        color: '#e41a1c99',
                        points: userLoadX
                    },
                    {
                        label: 'System Load',
                        color: '#ff7f0099',
                        points: systemLoadX
                    }
                ]
            })
            : null;
        const memoryUsage = activeMemoryX &&
            activeMemoryX.length &&
            availableMemoryX &&
            availableMemoryX.length
            ? yield getStackedAreaGraph({
                label: 'Memory Usage (MB)',
                axisColor,
                areas: [
                    {
                        label: 'Used',
                        color: '#377eb899',
                        points: activeMemoryX
                    },
                    {
                        label: 'Free',
                        color: '#4daf4a99',
                        points: availableMemoryX
                    }
                ]
            })
            : null;
        const networkIORead = networkReadX && networkReadX.length
            ? yield getLineGraph({
                label: 'Network I/O Read (MB)',
                axisColor,
                line: {
                    label: 'Read',
                    color: '#be4d25',
                    points: networkReadX
                }
            })
            : null;
        const networkIOWrite = networkWriteX && networkWriteX.length
            ? yield getLineGraph({
                label: 'Network I/O Write (MB)',
                axisColor,
                line: {
                    label: 'Write',
                    color: '#6c25be',
                    points: networkWriteX
                }
            })
            : null;
        const diskIORead = diskReadX && diskReadX.length
            ? yield getLineGraph({
                label: 'Disk I/O Read (MB)',
                axisColor,
                line: {
                    label: 'Read',
                    color: '#be4d25',
                    points: diskReadX
                }
            })
            : null;
        const diskIOWrite = diskWriteX && diskWriteX.length
            ? yield getLineGraph({
                label: 'Disk I/O Write (MB)',
                axisColor,
                line: {
                    label: 'Write',
                    color: '#6c25be',
                    points: diskWriteX
                }
            })
            : null;
        const diskSizeUsage = diskUsedX && diskUsedX.length && diskAvailableX && diskAvailableX.length
            ? yield getStackedAreaGraph({
                label: 'Disk Usage (MB)',
                axisColor,
                areas: [
                    {
                        label: 'Used',
                        color: '#377eb899',
                        points: diskUsedX
                    },
                    {
                        label: 'Free',
                        color: '#4daf4a99',
                        points: diskAvailableX
                    }
                ]
            })
            : null;
        const postContentItems = [];
        if (cpuLoad) {
            postContentItems.push('### CPU Metrics', `![${cpuLoad.id}](${cpuLoad.url})`, '');
        }
        if (memoryUsage) {
            postContentItems.push('### Memory Metrics', `![${memoryUsage.id}](${memoryUsage.url})`, '');
        }
        if ((networkIORead && networkIOWrite) || (diskIORead && diskIOWrite)) {
            postContentItems.push('### IO Metrics', '|               | Read      | Write     |', '|---            |---        |---        |');
        }
        if (networkIORead && networkIOWrite) {
            postContentItems.push(`| Network I/O   | ![${networkIORead.id}](${networkIORead.url})        | ![${networkIOWrite.id}](${networkIOWrite.url})        |`);
        }
        if (diskIORead && diskIOWrite) {
            postContentItems.push(`| Disk I/O      | ![${diskIORead.id}](${diskIORead.url})              | ![${diskIOWrite.id}](${diskIOWrite.url})              |`);
        }
        if (diskSizeUsage) {
            postContentItems.push('### Disk Size Metrics', `![${diskSizeUsage.id}](${diskSizeUsage.url})`, '');
        }
        return postContentItems.join('\n');
    });
}
function getCPUStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const userLoadX = [];
        const systemLoadX = [];
        logger.debug('Getting CPU stats ...');
        const response = yield axios_1.default.get(`http://localhost:${STAT_SERVER_PORT}/cpu`);
        if (logger.isDebugEnabled()) {
            logger.debug(`Got CPU stats: ${JSON.stringify(response.data)}`);
        }
        response.data.forEach((element) => {
            userLoadX.push({
                x: element.time,
                y: element.userLoad && element.userLoad > 0 ? element.userLoad : 0
            });
            systemLoadX.push({
                x: element.time,
                y: element.systemLoad && element.systemLoad > 0 ? element.systemLoad : 0
            });
        });
        return { userLoadX, systemLoadX };
    });
}
function getMemoryStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const activeMemoryX = [];
        const availableMemoryX = [];
        logger.debug('Getting memory stats ...');
        const response = yield axios_1.default.get(`http://localhost:${STAT_SERVER_PORT}/memory`);
        if (logger.isDebugEnabled()) {
            logger.debug(`Got memory stats: ${JSON.stringify(response.data)}`);
        }
        response.data.forEach((element) => {
            activeMemoryX.push({
                x: element.time,
                y: element.activeMemoryMb && element.activeMemoryMb > 0
                    ? element.activeMemoryMb
                    : 0
            });
            availableMemoryX.push({
                x: element.time,
                y: element.availableMemoryMb && element.availableMemoryMb > 0
                    ? element.availableMemoryMb
                    : 0
            });
        });
        return { activeMemoryX, availableMemoryX };
    });
}
function getNetworkStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const networkReadX = [];
        const networkWriteX = [];
        logger.debug('Getting network stats ...');
        const response = yield axios_1.default.get(`http://localhost:${STAT_SERVER_PORT}/network`);
        if (logger.isDebugEnabled()) {
            logger.debug(`Got network stats: ${JSON.stringify(response.data)}`);
        }
        response.data.forEach((element) => {
            networkReadX.push({
                x: element.time,
                y: element.rxMb && element.rxMb > 0 ? element.rxMb : 0
            });
            networkWriteX.push({
                x: element.time,
                y: element.txMb && element.txMb > 0 ? element.txMb : 0
            });
        });
        return { networkReadX, networkWriteX };
    });
}
function getDiskStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const diskReadX = [];
        const diskWriteX = [];
        logger.debug('Getting disk stats ...');
        const response = yield axios_1.default.get(`http://localhost:${STAT_SERVER_PORT}/disk`);
        if (logger.isDebugEnabled()) {
            logger.debug(`Got disk stats: ${JSON.stringify(response.data)}`);
        }
        response.data.forEach((element) => {
            diskReadX.push({
                x: element.time,
                y: element.rxMb && element.rxMb > 0 ? element.rxMb : 0
            });
            diskWriteX.push({
                x: element.time,
                y: element.wxMb && element.wxMb > 0 ? element.wxMb : 0
            });
        });
        return { diskReadX, diskWriteX };
    });
}
function getDiskSizeStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const diskAvailableX = [];
        const diskUsedX = [];
        logger.debug('Getting disk size stats ...');
        const response = yield axios_1.default.get(`http://localhost:${STAT_SERVER_PORT}/disk_size`);
        if (logger.isDebugEnabled()) {
            logger.debug(`Got disk size stats: ${JSON.stringify(response.data)}`);
        }
        response.data.forEach((element) => {
            diskAvailableX.push({
                x: element.time,
                y: element.availableSizeMb && element.availableSizeMb > 0
                    ? element.availableSizeMb
                    : 0
            });
            diskUsedX.push({
                x: element.time,
                y: element.usedSizeMb && element.usedSizeMb > 0 ? element.usedSizeMb : 0
            });
        });
        return { diskAvailableX, diskUsedX };
    });
}
function getLineGraph(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = {
            options: {
                width: 1000,
                height: 500,
                xAxis: {
                    label: 'Time'
                },
                yAxis: {
                    label: options.label
                },
                timeTicks: {
                    unit: 'auto'
                }
            },
            lines: [options.line]
        };
        let response = null;
        try {
            response = yield axios_1.default.put('https://api.globadge.com/v1/chartgen/line/time', payload);
        }
        catch (error) {
            logger.error(error);
            logger.error(`getLineGraph ${JSON.stringify(payload)}`);
        }
        return response === null || response === void 0 ? void 0 : response.data;
    });
}
function getStackedAreaGraph(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = {
            options: {
                width: 1000,
                height: 500,
                xAxis: {
                    label: 'Time'
                },
                yAxis: {
                    label: options.label
                },
                timeTicks: {
                    unit: 'auto'
                }
            },
            areas: options.areas
        };
        let response = null;
        try {
            response = yield axios_1.default.put('https://api.globadge.com/v1/chartgen/stacked-area/time', payload);
        }
        catch (error) {
            logger.error(error);
            logger.error(`getStackedAreaGraph ${JSON.stringify(payload)}`);
        }
        return response === null || response === void 0 ? void 0 : response.data;
    });
}
///////////////////////////
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`Starting stat collector ...`);
        try {
            let metricFrequency = 0;
            const metricFrequencyInput = core.getInput('metric_frequency');
            if (metricFrequencyInput) {
                const metricFrequencyVal = parseInt(metricFrequencyInput);
                if (Number.isInteger(metricFrequencyVal)) {
                    metricFrequency = metricFrequencyVal * 1000;
                }
            }
            const child = (0, child_process_1.spawn)(process.argv[0], [path_1.default.join(__dirname, '../scw/index.js')], {
                detached: true,
                stdio: 'ignore',
                env: Object.assign(Object.assign({}, process.env), { WORKFLOW_TELEMETRY_STAT_FREQ: metricFrequency
                        ? `${metricFrequency}`
                        : undefined })
            });
            child.unref();
            logger.info(`Started stat collector`);
            return true;
        }
        catch (error) {
            logger.error('Unable to start stat collector');
            logger.error(error);
            return false;
        }
    });
}
exports.start = start;
function finish(currentJob) {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`Finishing stat collector ...`);
        try {
            // Trigger stat collect, so we will have remaining stats since the latest schedule
            yield triggerStatCollect();
            logger.info(`Finished stat collector`);
            return true;
        }
        catch (error) {
            logger.error('Unable to finish stat collector');
            logger.error(error);
            return false;
        }
    });
}
exports.finish = finish;
function report(currentJob) {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`Reporting stat collector result ...`);
        try {
            const postContent = yield reportWorkflowMetrics();
            logger.info(`Reported stat collector result`);
            return postContent;
        }
        catch (error) {
            logger.error('Unable to report stat collector result');
            logger.error(error);
            return null;
        }
    });
}
exports.report = report;
