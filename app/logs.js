'use strict';

const debugOn = process.env.DEBUG == 'true';

module.exports = class Logs {
    constructor(appName = 'mirotalkbro') {
        this.appName = appName;
        this.debugOn = debugOn;
    }

    debug(msg, op = '') {
        if (this.debugOn === false) return;
        console.debug('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, op);
    }

    log(msg, op = '') {
        console.log('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, op);
    }

    info(msg, op = '') {
        console.info('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, op);
    }

    warn(msg, op = '') {
        console.warn('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, op);
    }

    error(msg, op = '') {
        console.error('[' + this.getDateTime() + '] [' + this.appName + '] ' + msg, op);
    }

    getDateTime() {
        const options = {
            timeZone: process.env.TZ || 'UTC',
        };
        return new Date().toLocaleString('en-US', options);
    }
};
