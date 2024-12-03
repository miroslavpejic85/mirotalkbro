'use strict';

const theme = window.localStorage.getItem('mode');
const disconnectText = document.getElementById('disconnectText');

if (disconnectText) {
    disconnectText.innerText = viewerSettings.options.disconnect_txt;
}

if (theme && theme !== 'dark') {
    toggleDarkMode();
}

function toggleDarkMode() {
    document.body.classList.toggle('light-mode');
}
