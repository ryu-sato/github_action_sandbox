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
Object.defineProperty(exports, "__esModule", { value: true });
exports.report = exports.finish = exports.start = void 0;
const logger = __importStar(require("./logger"));
function generateTraceChartForSteps(job) {
    let chartContent = '';
    /**
       gantt
         title Build
         dateFormat x
         axisFormat %H:%M:%S
         Set up job : milestone, 1658073446000, 1658073450000
         Collect Workflow Telemetry : 1658073450000, 1658073450000
         Run actions/checkout@v2 : 1658073451000, 1658073453000
         Set up JDK 8 : 1658073453000, 1658073458000
         Build with Maven : 1658073459000, 1658073654000
         Run invalid command : crit, 1658073655000, 1658073654000
         Archive test results : done, 1658073655000, 1658073654000
         Post Set up JDK 8 : 1658073655000, 1658073654000
         Post Run actions/checkout@v2 : 1658073655000, 1658073655000
    */
    chartContent = chartContent.concat('gantt', '\n');
    chartContent = chartContent.concat('\t', `title ${job.name}`, '\n');
    chartContent = chartContent.concat('\t', `dateFormat x`, '\n');
    chartContent = chartContent.concat('\t', `axisFormat %H:%M:%S`, '\n');
    for (const step of job.steps || []) {
        if (!step.started_at || !step.completed_at) {
            continue;
        }
        chartContent = chartContent.concat('\t', `${step.name.replace(/:/g, '-')} : `);
        if (step.name === 'Set up job' && step.number === 1) {
            chartContent = chartContent.concat('milestone, ');
        }
        if (step.conclusion === 'failure') {
            // to show red
            chartContent = chartContent.concat('crit, ');
        }
        else if (step.conclusion === 'skipped') {
            // to show grey
            chartContent = chartContent.concat('done, ');
        }
        const startTime = new Date(step.started_at).getTime();
        const finishTime = new Date(step.completed_at).getTime();
        chartContent = chartContent.concat(`${Math.min(startTime, finishTime)}, ${finishTime}`, '\n');
    }
    const postContentItems = [
        '',
        '### Step Trace',
        '',
        '```mermaid' + '\n' + chartContent + '\n' + '```'
    ];
    return postContentItems.join('\n');
}
///////////////////////////
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`Starting step tracer ...`);
        try {
            logger.info(`Started step tracer`);
            return true;
        }
        catch (error) {
            logger.error('Unable to start step tracer');
            logger.error(error);
            return false;
        }
    });
}
exports.start = start;
function finish(currentJob) {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`Finishing step tracer ...`);
        try {
            logger.info(`Finished step tracer`);
            return true;
        }
        catch (error) {
            logger.error('Unable to finish step tracer');
            logger.error(error);
            return false;
        }
    });
}
exports.finish = finish;
function report(currentJob) {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`Reporting step tracer result ...`);
        if (!currentJob) {
            return null;
        }
        try {
            const postContent = generateTraceChartForSteps(currentJob);
            logger.info(`Reported step tracer result`);
            return postContent;
        }
        catch (error) {
            logger.error('Unable to report step tracer result');
            logger.error(error);
            return null;
        }
    });
}
exports.report = report;
