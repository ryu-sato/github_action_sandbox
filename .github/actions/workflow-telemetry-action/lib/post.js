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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const action_1 = require("@octokit/action");
const stepTracer = __importStar(require("./stepTracer"));
const statCollector = __importStar(require("./statCollector"));
const processTracer = __importStar(require("./processTracer"));
const logger = __importStar(require("./logger"));
const { pull_request } = github.context.payload;
const { workflow, job, repo, runId, sha } = github.context;
const PAGE_SIZE = 100;
const octokit = new action_1.Octokit();
function getCurrentJob() {
    return __awaiter(this, void 0, void 0, function* () {
        const _getCurrentJob = () => __awaiter(this, void 0, void 0, function* () {
            logger.info(JSON.stringify(github.context));
            for (let page = 0;; page++) {
                const result = yield octokit.rest.actions.listJobsForWorkflowRun({
                    owner: repo.owner,
                    repo: repo.repo,
                    run_id: runId,
                    per_page: PAGE_SIZE,
                    page
                });
                const jobs = result.data.jobs;
                logger.info(JSON.stringify(jobs));
                // If there are no jobs, stop here
                if (!jobs || !jobs.length) {
                    break;
                }
                const currentJobs = jobs.filter(it => it.status === 'in_progress' &&
                    it.runner_name === process.env.RUNNER_NAME);
                if (currentJobs && currentJobs.length) {
                    return currentJobs[0];
                }
                // Since returning job count is less than page size, this means that there are no other jobs.
                // So no need to make another request for the next page.
                if (jobs.length < PAGE_SIZE) {
                    break;
                }
            }
            return null;
        });
        try {
            for (let i = 0; i < 10; i++) {
                logger.info(`try: ${i}`);
                const currentJob = yield _getCurrentJob();
                if (currentJob && currentJob.id) {
                    return currentJob;
                }
                yield new Promise(r => setTimeout(r, 1000));
            }
        }
        catch (error) {
            logger.error(`Unable to get current workflow job info. ` +
                `Please sure that your workflow have "actions:read" permission!`);
        }
        return null;
    });
}
function reportAll(currentJob, content) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`Reporting all content ...`);
        logger.debug(`Workflow - Job: ${workflow} - ${job}`);
        const jobUrl = `https://github.com/${repo.owner}/${repo.repo}/runs/${currentJob.id}?check_suite_focus=true`;
        logger.debug(`Job url: ${jobUrl}`);
        const title = `## Workflow Telemetry - ${workflow} / ${currentJob.name}`;
        logger.debug(`Title: ${title}`);
        const commit = (pull_request && pull_request.head && pull_request.head.sha) || sha;
        logger.debug(`Commit: ${commit}`);
        const commitUrl = `https://github.com/${repo.owner}/${repo.repo}/commit/${commit}`;
        logger.debug(`Commit url: ${commitUrl}`);
        const info = `Workflow telemetry for commit [${commit}](${commitUrl})\n` +
            `You can access workflow job details [here](${jobUrl})`;
        const postContent = [title, info, content].join('\n');
        const jobSummary = core.getInput('job_summary');
        if ('true' === jobSummary) {
            core.summary.addRaw(postContent);
            yield core.summary.write();
        }
        const commentOnPR = core.getInput('comment_on_pr');
        if (pull_request && 'true' === commentOnPR) {
            if (logger.isDebugEnabled()) {
                logger.debug(`Found Pull Request: ${JSON.stringify(pull_request)}`);
            }
            yield octokit.rest.issues.createComment(Object.assign(Object.assign({}, github.context.repo), { issue_number: Number((_a = github.context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.number), body: postContent }));
        }
        else {
            logger.debug(`Couldn't find Pull Request`);
        }
        logger.info(`Reporting all content completed`);
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger.info(`Finishing ...`);
            const currentJob = yield getCurrentJob();
            if (!currentJob) {
                logger.error(`Couldn't find current job. So action will not report any data.`);
                return;
            }
            logger.debug(`Current job: ${JSON.stringify(currentJob)}`);
            // Finish step tracer
            yield stepTracer.finish(currentJob);
            // Finish stat collector
            yield statCollector.finish(currentJob);
            // Finish process tracer
            yield processTracer.finish(currentJob);
            // Report step tracer
            const stepTracerContent = yield stepTracer.report(currentJob);
            // Report stat collector
            const stepCollectorContent = yield statCollector.report(currentJob);
            // Report process tracer
            const procTracerContent = yield processTracer.report(currentJob);
            let allContent = '';
            if (stepTracerContent) {
                allContent = allContent.concat(stepTracerContent, '\n');
            }
            if (stepCollectorContent) {
                allContent = allContent.concat(stepCollectorContent, '\n');
            }
            if (procTracerContent) {
                allContent = allContent.concat(procTracerContent, '\n');
            }
            yield reportAll(currentJob, allContent);
            logger.info(`Finish completed`);
        }
        catch (error) {
            logger.error(error.message);
        }
    });
}
run();
