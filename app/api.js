'use strict';

const { v4: uuidV4 } = require('uuid');

module.exports = class ServerApi {
    constructor(host = null, authorization = null, apiKeySecret = null) {
        this._host = host;
        this._authorization = authorization;
        this._api_key_secret = apiKeySecret;
        this._protocol = this.getProtocol();
    }

    isAuthorized() {
        if (this._authorization != this._api_key_secret) return false;
        return true;
    }

    getJoinURL(data) {
        const url = this._protocol + this._host;
        const { room } = data;
        return {
            broadcast: url + '/broadcast?id=' + room + '&name=' + this.getRandomStr(99999),
            viewer: url + '/viewer?id=' + room + '&name=' + 'viewer-' + this.getRandomStr(99999),
            viewerHome: url + '/home?id=' + room,
        };
    }

    getProtocol() {
        return 'http' + (this._host.includes('localhost') ? '' : 's') + '://';
    }

    getRandomStr(max) {
        return Math.floor(Math.random() * max).toString();
    }
};
