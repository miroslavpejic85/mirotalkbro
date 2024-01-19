'use strict';

console.log('Home', window.location);

const broadcastID = new URLSearchParams(window.location.search).get('id');

const body = document.querySelector('body');

const supportDiv = document.getElementById('supportDiv');
const support = document.getElementById('support');

const userName = document.getElementById('userName');
const broadcasterIdLabel = document.getElementById('broadcasterIdLabel');
const broadcasterId = document.getElementById('broadcasterId');
const broadcasterIdRandom = document.getElementById('broadcasterIdRandom');
const broadcasterLabel = document.getElementById('broadcasterLabel');
const broadcaster = document.getElementById('broadcaster');
const viewer = document.getElementById('viewer');
const mode = document.getElementById('mode');

// =====================================================
// handle element display
// =====================================================

if (broadcastID) {
    elementDisplay(broadcasterIdLabel, false);
    elementDisplay(broadcasterIdRandom, false);
    elementDisplay(broadcasterId, false);
    elementDisplay(broadcasterLabel, false);
    elementDisplay(broadcaster, false);
}

// =====================================================
// Support the project - Thank you!
// =====================================================

support.addEventListener('click', getSupport);

function getSupport() {
    openURL('https://codecanyon.net/user/miroslavpejic85', true);
}

// =====================================================
// Handle username
// =====================================================

userName.value = window.localStorage.name || `User-${getRandomInt(99999)}`;

// =====================================================
// Handle broadcaster aka room id
// =====================================================

broadcasterId.value = broadcastID || window.localStorage.room || getUUID4();

broadcasterIdRandom.addEventListener('click', setRandomId);

function setRandomId() {
    broadcasterId.value = getUUID4();
}

// =====================================================
// Join as Broadcast
// =====================================================

broadcaster.addEventListener('click', startBroadcaster);

function startBroadcaster() {
    if (isFieldsOk()) window.location.href = `/broadcast?id=${broadcasterId.value}&name=${userName.value}`;
}

// =====================================================
// Join as Viewer
// =====================================================

viewer.addEventListener('click', startViewer);

function startViewer() {
    if (isFieldsOk()) window.location.href = `/viewer?id=${broadcasterId.value}&name=${userName.value}`;
}

// =====================================================
// Handle theme
// =====================================================

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

// =====================================================
// Handle fields
// =====================================================

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

// =====================================================
// Hide Elements
// =====================================================

!html.support && elementDisplay(supportDiv, false);
//...
