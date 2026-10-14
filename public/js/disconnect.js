'use strict';

const theme = window.localStorage.getItem('mode') || 'dark';
const disconnectText = document.getElementById('disconnectText');

if (disconnectText) {
    disconnectText.innerText = viewerSettings.options.disconnect_txt;
}

const disconnectActions = document.getElementById('disconnectActions');

if (disconnectActions) {
    disconnectActions.hidden = !viewerSettings.options.disconnect_home_btn;
}

// Same default as the other pages: dark unless the user picked light
if (theme === 'dark') document.body.classList.add('dark');
