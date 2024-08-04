'use strict';

const broadcastID = new URLSearchParams(window.location.search).get('id');
const username = new URLSearchParams(window.location.search).get('name');
const roomURL = window.location.origin + '/home?id=' + broadcastID;

console.log('Broadcaster', {
    username: username,
    roomId: broadcastID,
    viewer: roomURL,
});

const body = document.querySelector('body');

const broadcastForm = document.getElementById('broadcastForm');
const broadcastFormHeader = document.getElementById('broadcastFormHeader');
const broadcastButtons = document.getElementById('broadcastButtons');
const myName = document.getElementById('myName');
const connectedPeers = document.getElementById('connectedPeers');
const sessionTime = document.getElementById('sessionTime');
const video = document.querySelector('video');
const videoOff = document.getElementById('videoOff');

const settingsBtn = document.getElementById('settingsBtn');
const settingsForm = document.getElementById('broadcasterSettingsForm');

const copyRoom = document.getElementById('copyRoom');
const shareRoom = document.getElementById('shareRoom');
const videoBtn = document.getElementById('videoBtn');
const screenShareStart = document.getElementById('screenShareStart');
const screenShareStop = document.getElementById('screenShareStop');
const recordingStart = document.getElementById('recordingStart');
const recordingStop = document.getElementById('recordingStop');
const recordingLabel = document.getElementById('recordingLabel');
const recordingTime = document.getElementById('recordingTime');

const messagesOpenForm = document.getElementById('messagesOpenForm');
const messagesCloseForm = document.getElementById('messagesCloseForm');
const messagesForm = document.getElementById('messagesForm');
const messagesFormHeader = document.getElementById('messagesFormHeader');
const messagesOpenViewersForm = document.getElementById('messagesOpenViewersForm');
const messagesSave = document.getElementById('messagesSave');
const messagesClean = document.getElementById('messagesClean');
const messagesArea = document.getElementById('messagesArea');

const viewersOpenForm = document.getElementById('viewersOpenForm');
const viewersCloseForm = document.getElementById('viewersCloseForm');
const viewersForm = document.getElementById('viewersForm');
const viewersFormHeader = document.getElementById('viewersFormHeader');
const viewersTable = document.getElementById('viewersTable');
const viewerOpenMessageForm = document.getElementById('viewerOpenMessageForm');
const viewersSave = document.getElementById('viewersSave');
const viewerSearch = document.getElementById('viewerSearch');
const viewersDisconnect = document.getElementById('viewersDisconnect');

const fullScreenOn = document.getElementById('fullScreenOn');
const fullScreenOff = document.getElementById('fullScreenOff');
const togglePIP = document.getElementById('togglePIP');
const goHome = document.getElementById('goHome');

const videoSelect = document.getElementById('videoSelect');
const videoQualitySelect = document.getElementById('videoQualitySelect');
const videoFpsSelect = document.getElementById('videoFpsSelect');
const audioSelect = document.getElementById('audioSelect');

const userAgent = navigator.userAgent.toLowerCase();
const isMobileDevice = isMobile();
const isTabletDevice = isTablet();
const isIPadDevice = isIpad();
const isDesktopDevice = isDesktop();

const isSpeechSynthesisSupported = 'speechSynthesis' in window;

// =====================================================
// Handle ToolTips
// =====================================================

const broadcastTooltips = [
    { element: copyRoom, text: 'Copy and share room URL', position: 'top' },
    { element: shareRoom, text: 'Share room URL', position: 'top' },
    { element: videoBtn, text: 'Toggle video', position: 'top' },
    { element: screenShareStart, text: 'Start screen sharing', position: 'top' },
    { element: screenShareStop, text: 'Stop screen sharing', position: 'top' },
    { element: recordingStart, text: 'Start recording', position: 'top' },
    { element: recordingStop, text: 'Stop recording', position: 'top' },
    { element: messagesOpenForm, text: 'Toggle messages', position: 'top' },
    { element: viewersOpenForm, text: 'Toggle viewers', position: 'top' },
    { element: togglePIP, text: 'Toggle picture in picture', position: 'top' },
    { element: fullScreenOn, text: 'Enable full screen', position: 'top' },
    { element: fullScreenOff, text: 'Disable full screen', position: 'top' },
    { element: settingsBtn, text: 'Toggle settings', position: 'top' },
    { element: goHome, text: 'Go to home page', position: 'top' },
    { element: messagesClean, text: 'Clean messages', position: 'top' },
    { element: messagesSave, text: 'Save messages', position: 'top' },
    { element: messagesOpenViewersForm, text: 'Toggle viewers', position: 'top' },
    { element: messagesCloseForm, text: 'Close', position: 'top' },
    { element: viewersDisconnect, text: 'Disconnect all viewers', position: 'top' },
    { element: viewersSave, text: 'Save viewers', position: 'top' },
    { element: viewerOpenMessageForm, text: 'Toggle messages', position: 'top' },
    { element: viewersCloseForm, text: 'Close', position: 'top' },
];

body.onload = loadBroadcasterToolTip;

function loadBroadcasterToolTip() {
    broadcastTooltips.forEach(({ element, text, position }) => {
        setTippy(element, text, position);
    });
}

let broadcastStream = null;
let zoom = 1;
let isVideoMirrored = false;
let screenShareEnabled = false;
let messagesFormOpen = false;
let viewersFormOpen = false;
let settingsFormOpen = true;
let recording = null;
let recordingTimer = null;
let sessionTimer = null;
let allMessages = [];

myName.innerText = username;

// =====================================================
// Handle RTC Peer Connection
// =====================================================

const connectedViewers = {};
const peerConnections = {};
const dataChannels = {};

let dataChannel;

const socket = io.connect(window.location.origin);

socket.on('answer', (id, description) => {
    peerConnections[id].setRemoteDescription(description);
});

socket.on('viewer', (id, iceServers, username) => {
    const peerConnection = new RTCPeerConnection({ iceServers: iceServers });
    peerConnections[id] = peerConnection;

    handleDataChannels(id);

    connectedPeers.innerText = Object.keys(peerConnections).length;

    addViewer(id, username);

    // popupMessage('toast', 'New viewer', `${username} join`, 'top', 2000);

    playSound('viewer');

    peerConnection.onconnectionstatechange = (event) => {
        console.log('RTCPeerConnection', {
            socketId: id,
            connectionStatus: event.currentTarget.connectionState,
            signalingState: event.currentTarget.signalingState,
        });
    };

    const stream = video.srcObject;

    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', id, event.candidate);
        }
    };

    peerConnection
        .createOffer()
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => socket.emit('offer', id, peerConnection.localDescription))
        .catch((e) => console.error(e));
});

socket.on('candidate', (id, candidate) => {
    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate)).catch((e) => console.error(e));
});

socket.on('disconnectPeer', (id, username) => {
    peerConnections[id].close();
    delete peerConnections[id];
    delete dataChannels[id];
    delViewer(id, username);
    connectedPeers.innerText = Object.keys(peerConnections).length;
});

function thereIsPeerConnections() {
    return Object.keys(peerConnections).length === 0 ? false : true;
}

// =====================================================
// Handle RTC Data Channels
// =====================================================

function handleDataChannels(id) {
    dataChannels[id] = peerConnections[id].createDataChannel('mt_bro_dc');
    dataChannels[id].binaryType = 'arraybuffer'; // blob
    dataChannels[id].onopen = (event) => {
        console.log('DataChannels open', event);
        sendToViewersDataChannel('video', { visibility: videoOff.style.visibility });
    };
    dataChannels[id].onclose = (event) => {
        console.log('DataChannels close', event);
    };
    dataChannels[id].onerror = (event) => {
        console.log('DataChannel error', event);
    };
    peerConnections[id].ondatachannel = (event) => {
        event.channel.onmessage = (message) => {
            let data = {};
            try {
                data = JSON.parse(message.data);
                appendMessage(data.username, data.message);
                if (isSpeechSynthesisSupported && broadcastSettings.options.speech_msg) {
                    speechMessage(data.username, data.message);
                }
            } catch (err) {
                console.log('Datachannel error', err);
            }
        };
    };
}

function sendToViewersDataChannel(method, action = {}, peerId = '*') {
    for (let id in dataChannels) {
        if (id == socket.id) continue; // bypass myself

        if (peerId != '*') {
            sendTo(peerId); // send to specified viewer
            break;
        } else {
            sendTo(id); // send to all connected viewers
        }
    }
    function sendTo(id) {
        dataChannels[id].send(
            JSON.stringify({
                method: method,
                action: action,
            }),
        );
    }
}

// =====================================================
// Handle theme
// =====================================================

const getMode = window.localStorage.mode || 'dark';
if (getMode === 'dark') body.classList.toggle('dark');

// =====================================================
// Handle element display
// =====================================================

elementDisplay(fullScreenOff, false);
elementDisplay(messagesForm, false);
elementDisplay(viewersForm, false);
elementDisplay(recordingLabel, false);
elementDisplay(recordingStop, false);
elementDisplay(screenShareStop, false);
elementDisplay(settingsForm, broadcastSettings.options.settings, broadcastSettings.options.settings ? 'grid' : 'none');
elementDisplay(copyRoom, broadcastSettings.buttons.copyRoom);
elementDisplay(shareRoom, broadcastSettings.buttons.shareRoom);
elementDisplay(videoBtn, broadcastSettings.buttons.video);
elementDisplay(screenShareStart, broadcastSettings.buttons.screenShareStart);
elementDisplay(recordingStart, broadcastSettings.buttons.recordingStart);
elementDisplay(messagesOpenForm, broadcastSettings.buttons.messagesOpenForm);
elementDisplay(viewersOpenForm, broadcastSettings.buttons.viewersOpenForm);
elementDisplay(fullScreenOn, broadcastSettings.buttons.fullScreenOn && isFullScreenSupported());
elementDisplay(togglePIP, broadcastSettings.buttons.pictureInPicture && isPIPSupported());
elementDisplay(settingsBtn, broadcastSettings.options.settings);
elementDisplay(goHome, broadcastSettings.buttons.close);

if (broadcastSettings.options.start_full_screen) {
    broadcastForm.classList.remove(...broadcastForm.classList);
    broadcastForm.classList.add('full-screen');
    elementDisplay(broadcastFormHeader, false);
    elementDisplay(broadcastButtons, false);
    elementDisplay(settingsForm, false);
}

// =====================================================
// Handle session timer
// =====================================================

startSessionTime();

function startSessionTime() {
    let sessionElapsedTime = 0;
    sessionTimer = setInterval(function printTime() {
        sessionElapsedTime++;
        sessionTime.innerText = secondsToHms(sessionElapsedTime);
    }, 1000);
}

function stopSessionTime() {
    clearInterval(sessionTimer);
}

// =====================================================
// Handle Devices
// =====================================================

if (!isMobileDevice) {
    //makeDraggable(broadcastForm, broadcastFormHeader);
    //makeDraggable(messagesForm, messagesFormHeader);
    //makeDraggable(viewersForm, viewersFormHeader);
} else {
    document.documentElement.style.setProperty('--form-width', '85vw');
    document.documentElement.style.setProperty('--form-height', '90vh');
}

// =====================================================
// Handle settings
// =====================================================

settingsBtn.addEventListener('click', toggleSettings);

function toggleSettings() {
    const display = settingsFormOpen ? false : true;
    const mode = settingsFormOpen ? 'none' : 'grid';
    elementDisplay(settingsForm, display, mode);
    settingsFormOpen = !settingsFormOpen;
}

// =====================================================
// Handle video
// =====================================================

video.addEventListener('click', toggleFullScreen);
video.addEventListener('wheel', handleZoom);

function toggleFullScreen() {
    isFullScreen() ? goOutFullscreen() : goInFullscreen(video);
}

function handleZoom(e) {
    e.preventDefault();
    if (!video.srcObject || !broadcastSettings.options.zoom_video) return;
    const delta = e.wheelDelta ? e.wheelDelta : -e.deltaY;
    delta > 0 ? (zoom *= 1.2) : (zoom /= 1.2);
    if (zoom < 1) zoom = 1;
    video.style.scale = zoom;
}

// =====================================================
// Handle copy room url
// =====================================================

copyRoom.addEventListener('click', copyRoomURL);

// =====================================================
// Handle share room
// =====================================================

navigator.share
    ? shareRoom.addEventListener('click', shareRoomNavigator)
    : shareRoom.addEventListener('click', shareRoomQR);

// =====================================================
// Handle video stream
// =====================================================

videoBtn.addEventListener('click', toggleVideo);

function toggleVideo() {
    const color = getMode === 'dark' ? 'white' : 'black';
    videoBtn.style.color = videoBtn.style.color == 'red' ? color : 'red';
    videoOff.style.visibility = videoBtn.style.color == 'red' ? 'visible' : 'hidden';
    window.stream.getVideoTracks()[0].enabled = !window.stream.getVideoTracks()[0].enabled;
    sendToViewersDataChannel('video', { visibility: videoOff.style.visibility });
}

// =====================================================
// Handle share screen
// =====================================================

if (
    !isMobileDevice &&
    (navigator.getDisplayMedia || (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia))
) {
    screenShareStart.addEventListener('click', toggleScreen);
    screenShareStop.addEventListener('click', toggleScreen);
} else {
    elementDisplay(screenShareStart, false);
}

function toggleScreen() {
    if (recording && recording.isStreamRecording()) {
        return popupMessage('toast', 'Recording', 'Recording cam in execution', 'top');
    }
    screenShareEnabled = !screenShareEnabled;
    elementDisplay(screenShareStop, screenShareEnabled);
    elementDisplay(screenShareStart, !screenShareEnabled);
    getStream();
}

// =====================================================
// Handle recording
// =====================================================

recordingStart.addEventListener('click', toggleRecording);
recordingStop.addEventListener('click', toggleRecording);

function toggleRecording() {
    recording && recording.isStreamRecording() ? stopRecording() : startRecording();
}

function startRecording() {
    if (!video.srcObject) {
        return popupMessage('toast', 'Video', "There isn't a video stream to recording", 'top');
    } else {
        recording = new Recording(
            video.srcObject,
            recordingLabel,
            recordingTime,
            recordingStop,
            recordingStart,
            videoSelect,
            audioSelect,
        );
        recording.start();
    }
}

function stopRecording() {
    recording.stop();
}

function saveRecording() {
    if (recording && recording.isStreamRecording()) stopRecording();
}

function startRecordingTimer() {
    let recElapsedTime = 0;
    recordingTimer = setInterval(function printTime() {
        if (recording.isStreamRecording()) {
            recElapsedTime++;
            recordingTime.innerText = secondsToHms(recElapsedTime);
        }
    }, 1000);
}
function stopRecordingTimer() {
    clearInterval(recordingTimer);
}

// =====================================================
// Handle messages form
// =====================================================

messagesOpenForm.addEventListener('click', toggleMessagesForm);
messagesCloseForm.addEventListener('click', toggleMessagesForm);
messagesSave.addEventListener('click', saveMessages);
messagesOpenViewersForm.addEventListener('click', toggleViewersForm);
messagesClean.addEventListener('click', cleanMessages);

function toggleMessagesForm() {
    if (!messagesFormOpen && !messagesArea.hasChildNodes()) {
        return popupMessage('toast', 'Messages', "There isn't messages to read", 'top');
    }
    messagesFormOpen = !messagesFormOpen;
    elementDisplay(messagesForm, messagesFormOpen);
    elementDisplay(broadcastForm, !messagesFormOpen, 'grid');
    if (viewersFormOpen) {
        viewersFormOpen = !viewersFormOpen;
        elementDisplay(viewersForm, !messagesFormOpen);
    }
    if (messagesOpenForm.classList.contains('pulse-bg')) {
        messagesOpenForm.classList.toggle('pulse-bg');
    }
}

function saveMessages() {
    if (allMessages.length != 0) {
        return saveAllMessages(allMessages);
    }
    popupMessage('toast', 'Messages', "There isn't messages to save", 'top');
}

function cleanMessages() {
    if (allMessages.length != 0) {
        return Swal.fire({
            position: 'top',
            title: 'Clean up',
            text: 'Do you want to clean up all the messages?',
            showDenyButton: true,
            confirmButtonText: `Yes`,
            denyButtonText: `No`,
            showClass: { popup: 'animate__animated animate__fadeInDown' },
            hideClass: { popup: 'animate__animated animate__fadeOutUp' },
        }).then((result) => {
            if (result.isConfirmed) {
                let message = messagesArea.firstChild;
                while (message) {
                    messagesArea.removeChild(message);
                    message = messagesArea.firstChild;
                }
                allMessages = [];
            }
        });
    }
    popupMessage('toast', 'Messages', "There isn't messages to delete", 'top');
}

function appendMessage(username, message) {
    playSound('message');
    const timeNow = getTime();
    const messageDiv = document.createElement('div');
    const messageTitle = document.createElement('span');
    const messageText = document.createElement('p');
    messageTitle.innerText = `${timeNow} - ${username}`;
    messageText.innerText = message;
    messageDiv.appendChild(messageTitle);
    messageDiv.appendChild(messageText);
    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop += 500;
    const messageData = {
        time: timeNow,
        from: username,
        message: message,
    };
    allMessages.push(messageData);
    console.log('Message', messageData);
    //
    if (!messagesFormOpen) {
        popupMessage('toast', 'New message', `New message from\n${username}`, 'top');
        if (!messagesOpenForm.classList.contains('pulse-bg')) {
            messagesOpenForm.classList.toggle('pulse-bg');
        }
        if (broadcastSettings.options.show_chat_on_msg) {
            toggleMessagesForm();
        }
    }
}

function speechMessage(username, msg) {
    const speech = new SpeechSynthesisUtterance();
    speech.text = 'New message from:' + username + '. The message is:' + msg;
    speech.rate = 0.9;
    window.speechSynthesis.speak(speech);
}

// =====================================================
// Handle viewers form
// =====================================================

viewersOpenForm.addEventListener('click', toggleViewersForm);
viewersCloseForm.addEventListener('click', toggleViewersForm);
viewersSave.addEventListener('click', saveViewers);
viewerSearch.addEventListener('keyup', searchViewer);
viewerOpenMessageForm.addEventListener('click', toggleMessagesForm);

viewersDisconnect.addEventListener('click', disconnectALLViewers);

function toggleViewersForm() {
    if (!viewersFormOpen && !thereIsPeerConnections()) {
        return popupMessage('toast', 'Viewers', "There isn't connected viewers", 'top');
    }
    viewersFormOpen = !viewersFormOpen;
    elementDisplay(viewersForm, viewersFormOpen);
    elementDisplay(broadcastForm, !viewersFormOpen, 'grid');
    if (messagesFormOpen) {
        messagesFormOpen = !messagesFormOpen;
        elementDisplay(messagesForm, !viewersFormOpen);
    }
}

function saveViewers() {
    if (thereIsPeerConnections()) {
        return saveAllViewers(connectedViewers);
    }
    popupMessage('toast', 'Viewers', "There isn't connected viewers", 'top');
}

function searchViewer() {
    let filter, tr, td, i, username;
    filter = viewerSearch.value.toUpperCase();
    tr = viewersTable.getElementsByTagName('tr');
    for (i = 0; i < tr.length; i++) {
        td = tr[i].getElementsByTagName('td')[0];
        if (td) {
            username = td.textContent || td.innerText;
            if (username.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = '';
            } else {
                tr[i].style.display = 'none';
            }
        }
    }
}

function addViewer(id, username) {
    connectedViewers[id] = username;
    console.log('ConnectedViewers', {
        connected: username,
        connectedViewers: connectedViewers,
    });
    const trDel = document.getElementById(id);
    if (trDel) viewersTable.removeChild(trDel);
    const tr = document.createElement('tr');
    const tdUsername = document.createElement('td');
    const tdDisconnect = document.createElement('td');
    const button = document.createElement('button');
    const p = document.createElement('p');
    tr.id = id;
    p.innerText = username;
    button.id = `${id}___${username}`;
    button.innerText = 'Disconnect';
    tdUsername.appendChild(p);
    tdDisconnect.appendChild(button);
    tr.appendChild(tdUsername);
    tr.appendChild(tdDisconnect);
    viewersTable.appendChild(tr);
    handleDisconnectPeer(button.id);
}

function handleDisconnectPeer(uuid) {
    const buttonDisconnect = document.getElementById(uuid);
    buttonDisconnect.addEventListener('click', () => {
        const words = uuid.split('___');
        const peerId = words[0];
        const peerName = words[1];
        Swal.fire({
            allowOutsideClick: false,
            allowEscapeKey: false,
            showDenyButton: true,
            position: 'top',
            title: 'Disconnect',
            text: `Do you want to disconnect ${peerName} ?`,
            confirmButtonText: `Yes`,
            denyButtonText: `No`,
            showClass: { popup: 'animate__animated animate__fadeInDown' },
            hideClass: { popup: 'animate__animated animate__fadeOutUp' },
        }).then((result) => {
            if (result.isConfirmed) {
                sendToViewersDataChannel('disconnect', {}, peerId);
            }
        });
    });
}

function delViewer(id, username) {
    delete connectedViewers[id];
    console.log('ConnectedViewers', {
        disconnected: username,
        connectedViewers: connectedViewers,
    });
    const tr = document.getElementById(id);
    viewersTable.removeChild(tr);
    if (!thereIsPeerConnections() && viewersFormOpen) toggleViewersForm();
}

function disconnectALLViewers(confirmation = true) {
    if (!thereIsPeerConnections()) return;
    if (!confirmation) {
        return sendToViewersDataChannel('disconnect');
    }
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        showDenyButton: true,
        position: 'top',
        title: 'Disconnect all viewers',
        text: 'Do you want to disconnect all viewers?',
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            sendToViewersDataChannel('disconnect');
        }
    });
}

// =====================================================
// Handle picture in picture
// =====================================================

togglePIP.addEventListener('click', handleVideoPIP);

function handleVideoPIP() {
    if (!video.srcObject) {
        popupMessage('toast', 'Picture-in-Picture', 'There is no video for PIP', 'top');
    } else {
        togglePictureInPicture(video);
    }
}

// =====================================================
// Handle full screen mode
// =====================================================

fullScreenOn.addEventListener('click', toggleFullScreenDoc);
fullScreenOff.addEventListener('click', toggleFullScreenDoc);

function toggleFullScreenDoc() {
    const isDocFullScreen = isFullScreen();
    isDocFullScreen ? goOutFullscreen() : goInFullscreen(document.documentElement);
    elementDisplay(fullScreenOn, isDocFullScreen);
    elementDisplay(fullScreenOff, !isDocFullScreen);
}

// =====================================================
// Handle leave room
// =====================================================

goHome.addEventListener('click', goToHomePage);

function goToHomePage() {
    stopSessionTime();
    disconnectALLViewers(false);
    openURL('/');
}

// =====================================================
// Handle media stream
// =====================================================

videoQualitySelect.onchange = applyVideoConstraints;
videoFpsSelect.onchange = applyVideoConstraints;

function applyVideoConstraints() {
    const videoConstraints = getVideoConstraints();
    window.stream
        .getVideoTracks()[0]
        .applyConstraints(videoConstraints)
        .then(() => {
            logStreamSettingsInfo();
            localStorage.videoQualitySelectedIndex = videoQualitySelect.selectedIndex;
            localStorage.videoFpsSelectedIndex = videoFpsSelect.selectedIndex;
        })
        .catch((error) => {
            videoQualitySelect.selectedIndex = localStorage.videoQualitySelectedIndex;
            videoFpsSelect.selectedIndex = localStorage.videoFpsSelectedIndex;
            console.error('setVideoQuality', error);
            popupMessage(
                'warning',
                'Video quality/fps',
                "Your device doesn't support the selected video quality and fps, please select the another one.",
            );
        });
}

function getVideoConstraints() {
    const videoQuality = videoQualitySelect.value;
    const videoFrameRate = videoFpsSelect.value == 'default' ? 30 : parseInt(videoFpsSelect.value, 10);
    let videoConstraints = { frameRate: { ideal: videoFrameRate } };
    switch (videoQuality) {
        case 'default':
            videoConstraints = {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: videoFrameRate },
            };
            break;
        case 'qvga':
            videoConstraints = {
                width: { exact: 320 },
                height: { exact: 240 },
                frameRate: videoFrameRate,
            };
            break;
        case 'vga':
            videoConstraints = {
                width: { exact: 640 },
                height: { exact: 480 },
                frameRate: videoFrameRate,
            };
            break;
        case 'hd':
            videoConstraints = {
                width: { exact: 1280 },
                height: { exact: 720 },
                frameRate: videoFrameRate,
            };
        case 'fhd':
            videoConstraints = {
                width: { exact: 1920 },
                height: { exact: 1080 },
                frameRate: videoFrameRate,
            };
            break;
        case '2k':
            videoConstraints = {
                width: { exact: 2560 },
                height: { exact: 1440 },
                frameRate: videoFrameRate,
            };
            break;
        case '4k':
            videoConstraints = {
                width: { exact: 3840 },
                height: { exact: 2160 },
                frameRate: videoFrameRate,
            };
            break;
        case '6k':
            videoConstraints = {
                width: { exact: 6144 },
                height: { exact: 3456 },
                frameRate: videoFrameRate,
            };
            break;
        case '8k':
            videoConstraints = {
                width: { exact: 7680 },
                height: { exact: 4320 },
                frameRate: videoFrameRate,
            };
            break;
        default:
            break;
    }
    return videoConstraints;
}

// =====================================================
// Handle camera, microphone, screen
// =====================================================

audioSelect.onchange = getStream;
videoSelect.onchange = getStream;

getStream().then(getDevices).then(gotDevices);

function getStream() {
    videoQualitySelect.selectedIndex = localStorage.videoQualitySelectedIndex
        ? localStorage.videoQualitySelectedIndex
        : 0;
    videoFpsSelect.selectedIndex = localStorage.videoFpsSelectedIndex ? localStorage.videoFpsSelectedIndex : 0;
    videoBtn.style.color = getMode === 'dark' ? 'white' : 'black';

    const audioSource = audioSelect.value;
    const videoSource = videoSelect.value;

    const screenConstraints = { audio: true, video: true };
    const cameraConstraints = {
        audio: { deviceId: audioSource ? { exact: audioSource } : undefined },
        video: { deviceId: videoSource ? { exact: videoSource } : undefined },
    };
    const constraints = screenShareEnabled ? screenConstraints : cameraConstraints;

    stopWindowStream();
    stopBroadcastStream();

    if (screenShareEnabled) {
        video.classList.remove('mirror');
        isVideoMirrored = false;
        return navigator.mediaDevices
            .getDisplayMedia(constraints)
            .then(gotScreenStream)
            .then(applyVideoConstraints)
            .catch(handleError);
    }

    if (isDesktopDevice && !isVideoMirrored) {
        video.className = 'mirror';
        isVideoMirrored = true;
    }

    return navigator.mediaDevices
        .getUserMedia(constraints)
        .then(gotStream)
        .then(applyVideoConstraints)
        .catch(handleError);
}

function gotStream(stream) {
    window.stream = stream;
    broadcastStream = stream;
    if (!screenShareEnabled) {
        audioSelect.selectedIndex = [...audioSelect.options].findIndex(
            (option) => option.text === stream.getAudioTracks()[0].label,
        );
        videoSelect.selectedIndex = [...videoSelect.options].findIndex(
            (option) => option.text === stream.getVideoTracks()[0].label,
        );
    }
    attachStream(stream);
    socket.emit('broadcaster', broadcastID);
}

function gotScreenStream(stream) {
    const tracksToInclude = [];
    const videoTrack = hasVideoTrack(stream) ? stream.getVideoTracks()[0] : null;
    const audioTabTrack = hasAudioTrack(stream) ? stream.getAudioTracks()[0] : null;
    const audioTrack = hasAudioTrack(broadcastStream) ? broadcastStream.getAudioTracks()[0] : null;
    if (videoTrack) tracksToInclude.push(videoTrack);
    if (audioTabTrack) tracksToInclude.push(audioTabTrack);
    if (audioTrack) tracksToInclude.push(audioTrack);
    const newStream = new MediaStream(tracksToInclude);
    window.stream = newStream;
    broadcastStream = newStream;
    attachStream(newStream);
    socket.emit('broadcaster', broadcastID);
}

function attachStream(stream) {
    video.srcObject = stream;
    video.playsInline = true;
    video.autoplay = true;
    video.muted = true;
    video.volume = 0;
    video.controls = false;
}

function stopBroadcastStream() {
    if (broadcastStream) {
        broadcastStream.getTracks().forEach((track) => {
            track.stop();
        });
    }
}

function stopWindowStream() {
    if (window.stream) {
        window.stream.getTracks().forEach((track) => {
            track.stop();
        });
    }
}

function handleError(error) {
    console.error('Error', error);
    if (screenShareEnabled) {
        toggleScreen();
    } else {
        popupMessage('warning', 'Ops', error);
    }
}

function getDevices() {
    return navigator.mediaDevices.enumerateDevices();
}

function gotDevices(deviceInfos) {
    window.deviceInfos = deviceInfos;
    for (const deviceInfo of deviceInfos) {
        if (deviceInfo.deviceId !== 'default') {
            const option = document.createElement('option');
            option.value = deviceInfo.deviceId;
            if (deviceInfo.kind === 'audioinput') {
                option.text = deviceInfo.label || `Microphone ${audioSelect.length + 1}`;
                audioSelect.appendChild(option);
            } else if (deviceInfo.kind === 'videoinput') {
                option.text = deviceInfo.label || `Camera ${videoSelect.length + 1}`;
                videoSelect.appendChild(option);
            }
        }
    }
}

// =====================================================
// Handle window exit
// =====================================================

window.onbeforeunload = () => {
    socket.close();
    if (thereIsPeerConnections()) {
        for (let id in peerConnections) {
            peerConnections[id].close();
        }
        peerConnections = {};
        dataChannels = {};
    }
    stopSessionTime();
    saveRecording();
    return undefined;
};
