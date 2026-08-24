'use strict';

console.log('Home', window.location);

const broadcastID = new URLSearchParams(window.location.search).get('id');

let adminOnlyBroadcast = false;

(async () => {
    try {
        const res = await fetch('/api/v1/config');
        const cfg = await res.json();
        adminOnlyBroadcast = !!cfg.adminOnlyBroadcast;
    } catch (e) {
        console.error('Failed to load server config', e);
    }
})();

const body = document.querySelector('body');

const appName = document.getElementById('appName');
const copyright = document.getElementById('copyright');
const aboutDiv = document.getElementById('aboutDiv');
const about = document.getElementById('about');

const userName = document.getElementById('userName');
const userNameRandom = document.getElementById('userNameRandom');
const broadcasterIdLabel = document.getElementById('broadcasterIdLabel');
const broadcasterId = document.getElementById('broadcasterId');
const broadcasterIdWrapper = document.getElementById('broadcasterIdWrapper');
const broadcasterIdRandom = document.getElementById('broadcasterIdRandom');
const broadcasterLabel = document.getElementById('broadcasterLabel');
const broadcaster = document.getElementById('broadcaster');
const viewerLabel = document.getElementById('viewerLabel');
const viewer = document.getElementById('viewer');
const mode = document.getElementById('mode');

appName.textContent = homePage.appName;
copyright.textContent = `© ${new Date().getFullYear()} ${homePage.appName}`;

// =====================================================
// handle element display
// =====================================================

if (broadcastID) {
    document.getElementById('setupTitle').textContent = 'Join this broadcast';
    elementDisplay(broadcasterIdLabel, false);
    elementDisplay(broadcasterIdWrapper, false);
    elementDisplay(broadcasterLabel, false);
    elementDisplay(broadcaster, false);
}

// =====================================================
// About
// =====================================================

about.addEventListener('click', openAbout);

function openAbout() {
    openURL(homePage.about.url, true);
}

// =====================================================
// Handle username
// =====================================================

async function getUserName() {
    try {
        const { data: profile } = await axios.get('/profile', { timeout: 5000 });
        if (profile && profile.name) {
            console.log('AXIOS GET OIDC Profile retrieved successfully', profile);
            window.localStorage.name = profile.name;
        }
    } catch (error) {
        console.error('AXIOS OIDC Error fetching profile', error.message || error);
    }
    const name = window.localStorage.name || getRandomName();
    return name;
}

(async () => {
    userName.value = await getUserName();
})();

// =====================================================
// Handle broadcaster aka room id
// =====================================================

broadcasterId.value = broadcastID || window.localStorage.room || getUUID4();

broadcasterIdRandom.addEventListener('click', setRandomId);

function setRandomId() {
    broadcasterId.value = getUUID4();
}

userNameRandom.addEventListener('click', setRandomName);

function setRandomName() {
    userName.value = getRandomName();
}

// =====================================================
// Join as Broadcast
// =====================================================

broadcaster.addEventListener('click', startBroadcaster);

async function startBroadcaster() {
    if (!isFieldsOk()) return;
    if (adminOnlyBroadcast) {
        const { value: token, isConfirmed } = await Swal.fire({
            title: 'Admin token required',
            icon: 'warning',
            iconHtml: '<i class="fas fa-shield-halved"></i>',
            input: 'password',
            inputPlaceholder: 'Enter admin token',
            inputAttributes: { autocomplete: 'current-password' },
            showCancelButton: true,
            confirmButtonText: 'Join',
            showClass: { popup: 'animate__animated animate__fadeInDown' },
            hideClass: { popup: 'animate__animated animate__fadeOutUp' },
        });
        if (!isConfirmed || !token) return;
        window.location.href = `/broadcast?id=${broadcasterId.value}&name=${userName.value}&token=${encodeURIComponent(token)}`;
    } else {
        window.location.href = `/broadcast?id=${broadcasterId.value}&name=${userName.value}`;
    }
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

!homePage.showCopyright && elementDisplay(copyright, false);
!homePage.about.show && elementDisplay(aboutDiv, false);

if (!homePage.buttons.broadcast) {
    elementDisplay(broadcasterLabel, false);
    elementDisplay(broadcaster, false);
}
if (!homePage.buttons.viewer) {
    elementDisplay(viewerLabel, false);
    elementDisplay(viewer, false);
}
//...
