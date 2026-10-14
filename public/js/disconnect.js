'use strict';

const theme = window.localStorage.getItem('mode') || 'dark';
const disconnectText = document.getElementById('disconnectText');

if (disconnectText) {
    disconnectText.innerText = viewerSettings.options.disconnect_txt;
}

// Same default as the other pages: dark unless the user picked light
if (theme === 'dark') document.body.classList.add('dark');
