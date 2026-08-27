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
    scrambleReveal(broadcasterId, getUUID4(), broadcasterIdRandom);
}

userNameRandom.addEventListener('click', setRandomName);

function setRandomName() {
    scrambleReveal(userName, getRandomName(), userNameRandom);
}

// =====================================================
// Scramble text effect on generated values
// =====================================================

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SCRAMBLE_TICK_MS = 30;
const SCRAMBLE_MAX_TICKS = 14; // keeps the effect under ~450ms whatever the value length
const scrambleFrames = new WeakMap();
const scramblePending = new WeakMap();

function scrambleReveal(input, finalValue, button) {
    finishScramble(input);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        input.value = finalValue;
        return;
    }

    const chars = [...finalValue];
    // spread the reveal over a fixed number of ticks so long UUIDs are not slower than short names
    const revealAt = chars.map((_, i) => Math.round(((i + 1) / chars.length) * (SCRAMBLE_MAX_TICKS - 2)));

    scramblePending.set(input, { finalValue, button });
    input.classList.remove('is-generated');
    input.classList.add('is-scrambling');
    if (button) button.classList.add('is-spinning');

    let tick = 0;
    let last = performance.now();

    const step = (now) => {
        if (now - last >= SCRAMBLE_TICK_MS) {
            last = now;
            input.value = chars
                .map((char, i) => {
                    if (tick >= revealAt[i] || char === ' ' || char === '-') return char;
                    return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                })
                .join('');
            tick++;
        }
        if (tick > SCRAMBLE_MAX_TICKS) return finishScramble(input);
        scrambleFrames.set(input, requestAnimationFrame(step));
    };

    scrambleFrames.set(input, requestAnimationFrame(step));
}

// commits the real value immediately, so the field is never left holding scrambled text
function finishScramble(input) {
    const frame = scrambleFrames.get(input);
    if (frame) cancelAnimationFrame(frame);
    scrambleFrames.delete(input);

    const pending = scramblePending.get(input);
    if (!pending) return;
    scramblePending.delete(input);

    input.value = pending.finalValue;
    input.classList.remove('is-scrambling');
    input.classList.add('is-generated');
    if (pending.button) pending.button.classList.remove('is-spinning');
    setTimeout(() => input.classList.remove('is-generated'), 450);
}

[userName, broadcasterId].forEach((input) => {
    ['focus', 'keydown', 'paste'].forEach((event) => input.addEventListener(event, () => finishScramble(input)));
});

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
if (getMode === 'dark') body.classList.add('dark');
updateThemeButton();
mode.addEventListener('click', setTheme);

function setTheme() {
    body.classList.toggle('dark');
    window.localStorage.mode = body.classList.contains('dark') ? 'dark' : 'light';
    updateThemeButton();
    playSound('switch');
}

function updateThemeButton() {
    const isDark = body.classList.contains('dark');
    const label = `Switch to ${isDark ? 'light' : 'dark'} appearance`;
    mode.setAttribute('aria-label', label);
    mode.title = label;
    mode.querySelector('i').className = `fas fa-${isDark ? 'sun' : 'moon'}`;
}

// =====================================================
// Handle fields
// =====================================================

function isFieldsOk() {
    finishScramble(userName);
    finishScramble(broadcasterId);
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
