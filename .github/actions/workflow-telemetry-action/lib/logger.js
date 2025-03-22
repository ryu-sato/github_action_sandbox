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
Object.defineProperty(exports, "__esModule", { value: true });
exports.error = exports.info = exports.debug = exports.isDebugEnabled = void 0;
const core = __importStar(require("@actions/core"));
const LOG_HEADER = '[Workflow Telemetry]';
function isDebugEnabled() {
    return core.isDebug();
}
exports.isDebugEnabled = isDebugEnabled;
function debug(msg) {
    core.debug(LOG_HEADER + ' ' + msg);
}
exports.debug = debug;
function info(msg) {
    core.info(LOG_HEADER + ' ' + msg);
}
exports.info = info;
function error(msg) {
    if (msg instanceof String || typeof msg === 'string') {
        core.error(LOG_HEADER + ' ' + msg);
    }
    else {
        core.error(LOG_HEADER + ' ' + msg.name);
        core.error(msg);
    }
}
exports.error = error;
