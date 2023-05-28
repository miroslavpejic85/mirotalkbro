'use strict';

const broadcastID = new URLSearchParams(window.location.search).get('id');

const body = document.querySelector('body');
const userName = document.getElementById('userName');
const broadcasterIdLabel = document.getElementById('broadcasterIdLabel');
const broadcasterId = document.getElementById('broadcasterId');
const broadcasterIdRandom = document.getElementById('broadcasterIdRandom');
const broadcasterLabel = document.getElementById('broadcasterLabel');
const broadcaster = document.getElementById('broadcaster');
const viewer = document.getElementById('viewer');
const mode = document.getElementById('mode');
const support = document.getElementById('support');

broadcasterIdRandom.addEventListener('click', setRandomId);
broadcaster.addEventListener('click', startBroadcaster);
viewer.addEventListener('click', startViewer);
support.addEventListener('click', getSupport);

userName.value = window.localStorage.name || `User-${getRandomInt(99999)}`;
broadcasterId.value = broadcastID || window.localStorage.room || getUUID4();

console.log('Home', window.location);

if (broadcastID) {
    elementDisplay(broadcasterIdLabel, false);
    elementDisplay(broadcasterIdRandom, false);
    elementDisplay(broadcasterId, false);
    elementDisplay(broadcasterLabel, false);
    elementDisplay(broadcaster, false);
}

const getMode = window.localStorage.mode || 'dark';
mode.checked = false;
if (getMode && getMode === 'dark') {
    body.classList.toggle('dark');
    mode.checked = true;
}
mode.onchange = setTheme;

function setTheme() {
    body.classList.toggle('dark');
    window.localStorage.mode = body.classList.contains('dark') ? 'dark' : 'light';
    playSound('switch');
}

function setRandomId() {
    broadcasterId.value = getUUID4();
}

function startBroadcaster() {
    if (isFieldsOk()) window.location.href = `/broadcast?id=${broadcasterId.value}&name=${userName.value}`;
}

function startViewer() {
    if (isFieldsOk()) window.location.href = `/viewer?id=${broadcasterId.value}&name=${userName.value}`;
}

function isFieldsOk() {
    if (userName.value == '') {
        popupMessage('warning', 'Username', 'Username field empty!');
        return false;
    }
    if (broadcasterId.value == '') {
        popupMessage('warning', 'Room Id', 'Room ID field empty!');
        return false;
    }
    window.localStorage.name = userName.value;
    window.localStorage.room = broadcasterId.value;
    return true;
}

function getSupport() {
    openURL('https://github.com/sponsors/miroslavpejic85', true);
}
