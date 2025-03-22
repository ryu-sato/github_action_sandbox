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
const core = __importStar(require("@actions/core"));
const systeminformation_1 = __importDefault(require("systeminformation"));
const sprintf_js_1 = require("sprintf-js");
const procTraceParser_1 = require("./procTraceParser");
const logger = __importStar(require("./logger"));
const PROC_TRACER_PID_KEY = 'PROC_TRACER_PID';
const PROC_TRACER_OUTPUT_FILE_NAME = 'proc-trace.out';
const PROC_TRACER_BINARY_NAME_UBUNTU_20 = 'proc_tracer_ubuntu-20';
const PROC_TRACER_BINARY_NAME_UBUNTU_22 = 'proc_tracer_ubuntu-22';
const DEFAULT_PROC_TRACE_CHART_MAX_COUNT = 100;
const GHA_FILE_NAME_PREFIX = '/home/runner/work/_actions/';
let finished = false;
function getProcessTracerBinaryName() {
    return __awaiter(this, void 0, void 0, function* () {
        const osInfo = yield systeminformation_1.default.osInfo();
        if (osInfo) {
            // Check whether we are running on Ubuntu
            if (osInfo.distro === 'Ubuntu') {
                const majorVersion = parseInt(osInfo.release.split('.')[0]);
                if (majorVersion === 20) {
                    logger.info(`Using ${PROC_TRACER_BINARY_NAME_UBUNTU_20}`);
                    return PROC_TRACER_BINARY_NAME_UBUNTU_20;
                }
                if (majorVersion === 22) {
                    logger.info(`Using ${PROC_TRACER_BINARY_NAME_UBUNTU_22}`);
                    return PROC_TRACER_BINARY_NAME_UBUNTU_22;
                }
            }
        }
        logger.info(`Process tracing disabled because of unsupported OS: ${JSON.stringify(osInfo)}`);
        return null;
    });
}
function getExtraProcessInfo(command) {
    // Check whether this is node process with args
    if (command.name === 'node' && command.args.length > 1) {
        const arg1 = command.args[1];
        // Check whether this is Node.js GHA process
        if (arg1.startsWith(GHA_FILE_NAME_PREFIX)) {
            const actionFile = arg1.substring(GHA_FILE_NAME_PREFIX.length);
            const idx1 = actionFile.indexOf('/');
            const idx2 = actionFile.indexOf('/', idx1 + 1);
            if (idx1 >= 0 && idx2 > idx1) {
                // If we could find a valid GHA name, use it as extra info
                return actionFile.substring(idx1 + 1, idx2);
            }
        }
    }
    return null;
}
///////////////////////////
function start() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`Starting process tracer ...`);
        try {
            const procTracerBinaryName = yield getProcessTracerBinaryName();
            if (procTracerBinaryName) {
                const procTraceOutFilePath = path_1.default.join(__dirname, '../proc-tracer', PROC_TRACER_OUTPUT_FILE_NAME);
                const child = (0, child_process_1.spawn)('sudo', [
                    path_1.default.join(__dirname, `../proc-tracer/${procTracerBinaryName}`),
                    '-f',
                    'json',
                    '-o',
                    procTraceOutFilePath
                ], {
                    detached: true,
                    stdio: 'ignore',
                    env: Object.assign({}, process.env)
                });
                child.unref();
                core.saveState(PROC_TRACER_PID_KEY, (_a = child.pid) === null || _a === void 0 ? void 0 : _a.toString());
                logger.info(`Started process tracer`);
                return true;
            }
            else {
                return false;
            }
        }
        catch (error) {
            logger.error('Unable to start process tracer');
            logger.error(error);
            return false;
        }
    });
}
exports.start = start;
function finish(currentJob) {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`Finishing process tracer ...`);
        const procTracePID = core.getState(PROC_TRACER_PID_KEY);
        if (!procTracePID) {
            logger.info(`Skipped finishing process tracer since process tracer didn't started`);
            return false;
        }
        try {
            logger.debug(`Interrupting process tracer with pid ${procTracePID} to stop gracefully ...`);
            (0, child_process_1.exec)(`sudo kill -s INT ${procTracePID}`);
            finished = true;
            logger.info(`Finished process tracer`);
            return true;
        }
        catch (error) {
            logger.error('Unable to finish process tracer');
            logger.error(error);
            return false;
        }
    });
}
exports.finish = finish;
function report(currentJob) {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`Reporting process tracer result ...`);
        if (!finished) {
            logger.info(`Skipped reporting process tracer since process tracer didn't finished`);
            return null;
        }
        try {
            const procTraceOutFilePath = path_1.default.join(__dirname, '../proc-tracer', PROC_TRACER_OUTPUT_FILE_NAME);
            logger.info(`Getting process tracer result from file ${procTraceOutFilePath} ...`);
            let procTraceMinDuration = -1;
            const procTraceMinDurationInput = core.getInput('proc_trace_min_duration');
            if (procTraceMinDurationInput) {
                const minProcDurationVal = parseInt(procTraceMinDurationInput);
                if (Number.isInteger(minProcDurationVal)) {
                    procTraceMinDuration = minProcDurationVal;
                }
            }
            const procTraceSysEnable = core.getInput('proc_trace_sys_enable') === 'true';
            const procTraceChartShow = core.getInput('proc_trace_chart_show') === 'true';
            const procTraceChartMaxCountInput = parseInt(core.getInput('proc_trace_chart_max_count'));
            const procTraceChartMaxCount = Number.isInteger(procTraceChartMaxCountInput)
                ? procTraceChartMaxCountInput
                : DEFAULT_PROC_TRACE_CHART_MAX_COUNT;
            const procTraceTableShow = core.getInput('proc_trace_table_show') === 'true';
            const completedCommands = yield (0, procTraceParser_1.parse)(procTraceOutFilePath, {
                minDuration: procTraceMinDuration,
                traceSystemProcesses: procTraceSysEnable
            });
            ///////////////////////////////////////////////////////////////////////////
            let chartContent = '';
            if (procTraceChartShow) {
                chartContent = chartContent.concat('gantt', '\n');
                chartContent = chartContent.concat('\t', `title ${currentJob.name}`, '\n');
                chartContent = chartContent.concat('\t', `dateFormat x`, '\n');
                chartContent = chartContent.concat('\t', `axisFormat %H:%M:%S`, '\n');
                const filteredCommands = [...completedCommands]
                    .sort((a, b) => {
                    return -(a.duration - b.duration);
                })
                    .slice(0, procTraceChartMaxCount)
                    .sort((a, b) => {
                    let result = a.startTime - b.startTime;
                    if (result === 0 && a.order && b.order) {
                        result = a.order - b.order;
                    }
                    return result;
                });
                for (const command of filteredCommands) {
                    const extraProcessInfo = getExtraProcessInfo(command);
                    const escapedName = command.name.replace(/:/g, '#colon;');
                    if (extraProcessInfo) {
                        chartContent = chartContent.concat('\t', `${escapedName} (${extraProcessInfo}) : `);
                    }
                    else {
                        chartContent = chartContent.concat('\t', `${escapedName} : `);
                    }
                    if (command.exitCode !== 0) {
                        // to show red
                        chartContent = chartContent.concat('crit, ');
                    }
                    const startTime = command.startTime;
                    const finishTime = command.startTime + command.duration;
                    chartContent = chartContent.concat(`${Math.min(startTime, finishTime)}, ${finishTime}`, '\n');
                }
            }
            ///////////////////////////////////////////////////////////////////////////
            let tableContent = '';
            if (procTraceTableShow) {
                const commandInfos = [];
                commandInfos.push((0, sprintf_js_1.sprintf)('%-12s %-16s %7s %7s %7s %15s %15s %10s %-20s', 'TIME', 'NAME', 'UID', 'PID', 'PPID', 'START TIME', 'DURATION (ms)', 'EXIT CODE', 'FILE NAME + ARGS'));
                for (const command of completedCommands) {
                    commandInfos.push((0, sprintf_js_1.sprintf)('%-12s %-16s %7d %7d %7d %15d %15d %10d %s %s', command.ts, command.name, command.uid, command.pid, command.ppid, command.startTime, command.duration, command.exitCode, command.fileName, command.args.join(' ')));
                }
                tableContent = commandInfos.join('\n');
            }
            ///////////////////////////////////////////////////////////////////////////
            const postContentItems = ['', '### Process Trace'];
            if (procTraceChartShow) {
                postContentItems.push('', `#### Top ${procTraceChartMaxCount} processes with highest duration`, '', '```mermaid' + '\n' + chartContent + '\n' + '```');
            }
            if (procTraceTableShow) {
                postContentItems.push('', `#### All processes with detail`, '', '```' + '\n' + tableContent + '\n' + '```');
            }
            const postContent = postContentItems.join('\n');
            logger.info(`Reported process tracer result`);
            return postContent;
        }
        catch (error) {
            logger.error('Unable to report process tracer result');
            logger.error(error);
            return null;
        }
    });
}
exports.report = report;
