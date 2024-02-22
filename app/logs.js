'use strict';

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
        const currentTime = new Date().toLocaleString('en-US', this.tzOptions);
        const milliseconds = String(new Date().getMilliseconds()).padStart(3, '0');
        return `${currentTime}:${milliseconds}`;
    }
};
