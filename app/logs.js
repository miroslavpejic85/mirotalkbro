'use strict';

const util = require('util');

const options = {
    depth: null,
    colors: true,
};

const LOGS_JSON = process.env.LOGS_JSON ? process.env.LOGS_JSON === 'true' : false;
const LOGS_JSON_PRETTY = process.env.LOGS_JSON_PRETTY ? process.env.LOGS_JSON_PRETTY === 'true' : false;
const debugOn = process.env.DEBUG == 'true';

module.exports = class Logs {
    constructor(appName = 'mirotalkbro') {
        this.appName = appName;
        this.debugOn = debugOn;
        this.tzOptions = {
            timeZone: process.env.TZ || 'UTC',
            hour12: false,
        };
    }

    jsonLog(level, appName, msg, op, extra = {}) {
        const logObj = {
            timestamp: new Date().toISOString(),
            level,
            app: appName,
            message: msg,
            ...extra,
        };
        if (op && typeof op === 'object' && Object.keys(op).length > 0) {
            logObj.data = op;
        }
        LOGS_JSON_PRETTY ? console.log(JSON.stringify(logObj, null, 2)) : console.log(JSON.stringify(logObj));
    }

    debug(msg, op = '') {
        if (this.debugOn === false) return;
        if (LOGS_JSON) {
            this.jsonLog('debug', this.appName, msg, op);
        } else {
            console.debug('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, util.inspect(op, options));
        }
    }

    log(msg, op = '') {
        if (LOGS_JSON) {
            this.jsonLog('log', this.appName, msg, op);
        } else {
            console.log('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, util.inspect(op, options));
        }
    }

    info(msg, op = '') {
        if (LOGS_JSON) {
            this.jsonLog('info', this.appName, msg, op);
        } else {
            console.info('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, util.inspect(op, options));
        }
    }

    warn(msg, op = '') {
        if (LOGS_JSON) {
            this.jsonLog('warn', this.appName, msg, op);
        } else {
            console.warn('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, util.inspect(op, options));
        }
    }

    error(msg, op = '') {
        if (LOGS_JSON) {
            this.jsonLog('error', this.appName, msg, op);
        } else {
            console.error('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, util.inspect(op, options));
        }
    }

    getDateTime() {
        const currentTime = new Date().toLocaleString('en-US', this.tzOptions);
        const milliseconds = String(new Date().getMilliseconds()).padStart(3, '0');
        return `${currentTime}:${milliseconds}`;
    }
};
