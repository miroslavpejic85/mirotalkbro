'use strict';

const broadcastID = new URLSearchParams(window.location.search).get('id');
const username = new URLSearchParams(window.location.search).get('name');

console.log('Viewer', {
    username: username,
    roomId: broadcastID,
});

const body = document.querySelector('body');

const viewerForm = document.getElementById('viewerForm');
const viewerFormHeader = document.getElementById('viewerFormHeader');
const viewerButtons = document.getElementById('viewerButtons');
const myName = document.getElementById('myName');
const sessionTime = document.getElementById('sessionTime');
const video = document.querySelector('video');
const videoOff = document.getElementById('videoOff');

const enableAudio = document.getElementById('enableAudio');
const disableAudio = document.getElementById('disableAudio');
const recordingStart = document.getElementById('recordingStart');
const recordingStop = document.getElementById('recordingStop');
const recordingLabel = document.getElementById('recordingLabel');
const recordingTime = document.getElementById('recordingTime');
const snapshot = document.getElementById('snapshot');
const fullScreenOn = document.getElementById('fullScreenOn');
const fullScreenOff = document.getElementById('fullScreenOff');
const togglePIP = document.getElementById('togglePIP');
const goHome = document.getElementById('goHome');
const messagesBtn = document.getElementById('messagesBtn');
const messagesForm = document.getElementById('messagesForm');
const messageInput = document.getElementById('messageInput');
const messageSend = document.getElementById('messageSend');

const userAgent = navigator.userAgent.toLowerCase();
const isMobileDevice = isMobile();

// =====================================================
// Handle ToolTips
// =====================================================

const viewerTooltips = [
    { element: enableAudio, text: 'Enable audio', position: 'top' },
    { element: disableAudio, text: 'Disable audio', position: 'top' },
    { element: recordingStart, text: 'Start recording', position: 'top' },
    { element: recordingStop, text: 'Stop recording', position: 'top' },
    { element: snapshot, text: 'Take a snapshot', position: 'top' },
    { element: togglePIP, text: 'Toggle picture in picture', position: 'top' },
    { element: messagesBtn, text: 'Toggle messages', position: 'top' },
    { element: fullScreenOn, text: 'Enable full screen', position: 'top' },
    { element: fullScreenOff, text: 'Disable full screen', position: 'top' },
    { element: goHome, text: 'Go to home page', position: 'top' },
];

body.onload = loadViewerToolTip;

function loadViewerToolTip() {
    viewerTooltips.forEach(({ element, text, position }) => {
        setTippy(element, text, position);
    });
}

let zoom = 1;
let messagesFormOpen = true;
let recording = null;
let recordingTimer = null;
let sessionTimer = null;

myName.innerText = username;

// =====================================================
// Handle RTC Peer Connection
// =====================================================

let peerConnection;
let dataChannel;

const socket = io.connect(window.location.origin);

socket.on('offer', (id, description, iceServers) => {
    peerConnection = new RTCPeerConnection({ iceServers: iceServers });

    handleDataChannel();

    peerConnection.onconnectionstatechange = (event) => {
        console.log('RTCPeerConnection', {
            connectionStatus: event.currentTarget.connectionState,
            signalingState: event.currentTarget.signalingState,
        });
    };

    peerConnection
        .setRemoteDescription(description)
        .then(() => peerConnection.createAnswer())
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => socket.emit('answer', id, peerConnection.localDescription))
        .catch(handleError);

    peerConnection.ontrack = (event) => {
        saveRecording();
        attachStream(event.streams[0]);
        if (event.track.kind === 'audio') {
            popupEnableAudio();
        }
    };
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', id, event.candidate);
        }
    };
});

socket.on('candidate', (id, candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(handleError);
});

socket.on('connect', () => {
    socket.emit('viewer', broadcastID, username);
});

socket.on('broadcaster', () => {
    socket.emit('viewer', broadcastID, username);
});

socket.on('broadcasterDisconnect', () => {
    location.reload();
});

function handleError(error) {
    console.error('Error', error);
    //popupMessage('warning', 'Ops', error);
}

// =====================================================
// Handle RTC Data Channel
// =====================================================

function handleDataChannel() {
    dataChannel = peerConnection.createDataChannel('mt_bro_dc');
    dataChannel.binaryType = 'arraybuffer'; // blob
    dataChannel.onopen = (event) => {
        console.log('DataChannel open', event);
    };
    dataChannel.onclose = (event) => {
        console.log('DataChannel close', event);
    };
    dataChannel.onerror = (event) => {
        console.log('DataChannel error', event);
    };
    peerConnection.ondatachannel = (event) => {
        event.channel.onmessage = (message) => {
            let data = {};
            try {
                data = JSON.parse(message.data);
                handleDataChannelMessage(data);
                console.log('Incoming dc data', data);
            } catch (err) {
                console.log('Datachannel error', err);
            }
        };
    };
}

function handleDataChannelMessage(data) {
    switch (data.method) {
        case 'disconnect':
            openURL(viewerSettings.options.redirect_url);
            break;
        case 'video':
            videoOff.style.visibility = data.action.visibility;
            break;
        //...
        default:
            console.error('Data channel message not handled', data);
            break;
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
elementDisplay(recordingLabel, false);
elementDisplay(recordingStop, false);
elementDisplay(disableAudio, viewerSettings.buttons.audio);
elementDisplay(enableAudio, !viewerSettings.buttons.audio);
elementDisplay(snapshot, viewerSettings.buttons.snapshot);
elementDisplay(recordingStart, viewerSettings.buttons.recordingStart);
elementDisplay(fullScreenOn, viewerSettings.buttons.fullScreenOn && isFullScreenSupported());
elementDisplay(togglePIP, viewerSettings.buttons.pictureInPicture && isPIPSupported());
elementDisplay(goHome, viewerSettings.buttons.close);

messageDisplay(viewerSettings.buttons.message);

function messageDisplay(display) {
    elementDisplay(messagesBtn, display);
    elementDisplay(messagesForm, display, display ? 'grid' : 'none');
    elementDisplay(messageInput, display);
    elementDisplay(messageSend, display);
}

if (viewerSettings.options.start_full_screen) {
    viewerForm.classList.remove(...viewerForm.classList);
    viewerForm.classList.add('full-screen');
    elementDisplay(viewerFormHeader, false);
    elementDisplay(viewerButtons, false);
    elementDisplay(messagesForm, false);
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

// if (!isMobileDevice) makeDraggable(viewerForm, viewerFormHeader);

// =====================================================
// Handle messages
// =====================================================

messagesBtn.addEventListener('click', toggleMessages);

function toggleMessages() {
    const display = messagesFormOpen ? false : true;
    const mode = messagesFormOpen ? 'none' : 'grid';
    elementDisplay(messagesForm, display, mode);
    messagesFormOpen = !messagesFormOpen;
}

// =====================================================
// Handle video
// =====================================================

video.addEventListener('click', toggleFullScreen);
video.addEventListener('wheel', handleZoom);

function toggleFullScreen() {
    isFullScreen() ? goOutFullscreen(video) : goInFullscreen(video);
}

function handleZoom(e) {
    e.preventDefault();
    if (!video.srcObject || !viewerSettings.options.zoom_video) return;
    const delta = e.wheelDelta ? e.wheelDelta : -e.deltaY;
    delta > 0 ? (zoom *= 1.2) : (zoom /= 1.2);
    if (zoom < 1) zoom = 1;
    video.style.scale = zoom;
}

// =====================================================
// Handle stream
// =====================================================

function attachStream(stream) {
    video.srcObject = stream;
    video.playsInline = true;
    video.autoplay = true;
    video.muted = true;
    video.controls = false;
}

// =====================================================
// Handle audio
// =====================================================

enableAudio.addEventListener('click', setAudioOn);
disableAudio.addEventListener('click', setAudioOff);

function setAudioOn() {
    if (!peerConnection) return;
    video.muted = false;
    elementDisplay(enableAudio, false);
    elementDisplay(disableAudio, viewerSettings.buttons.audio);
}

function setAudioOff() {
    video.muted = true;
    elementDisplay(disableAudio, false);
    elementDisplay(enableAudio, true);
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
        recording = new Recording(video.srcObject, recordingLabel, recordingTime, recordingStop, recordingStart);
        recording.start();
    }
}
function stopRecording() {
    recording.stop();
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

function saveRecording() {
    if (recording && recording.isStreamRecording()) stopRecording();
}

// =====================================================
// Handle Snapshot
// =====================================================

snapshot.addEventListener('click', gotSnapshot);

function gotSnapshot() {
    if (!video.srcObject) {
        return popupMessage('toast', 'Video', "There isn't a video stream to capture", 'top');
    }
    playSound('snapshot');
    let context, canvas, width, height, dataURL;
    width = video.videoWidth;
    height = video.videoHeight;
    canvas = canvas || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);
    dataURL = canvas.toDataURL('image/png'); // or image/jpeg
    saveDataToFile(dataURL, getDataTimeString() + '-snapshot.png');
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
    openURL(viewerSettings.options.redirect_url);
}

// =====================================================
// Handle messages
// =====================================================

messageSend.addEventListener('click', sendMessage);

messageInput.onkeydown = (e) => {
    if (e.code === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        messageSend.click();
    }
};

messageInput.oninput = function () {
    const chatInputEmoji = {
        '<3': '❤️',
        '</3': '💔',
        ':D': '😀',
        ':)': '😃',
        ';)': '😉',
        ':(': '😒',
        ':p': '😛',
        ';p': '😜',
        ":'(": '😢',
        ':+1:': '👍',
        ':*': '😘',
        ':O': '😲',
        ':|': '😐',
        ':*(': '😭',
        XD: '😆',
        ':B': '😎',
        ':P': '😜',
        '<(': '👎',
        '>:(': '😡',
        ':S': '😟',
        ':X': '🤐',
        ';(': '😥',
        ':T': '😖',
        ':@': '😠',
        ':$': '🤑',
        ':&': '🤗',
        ':#': '🤔',
        ':!': '😵',
        ':W': '😷',
        ':%': '🤒',
        ':*!': '🤩',
        ':G': '😬',
        ':R': '😋',
        ':M': '🤮',
        ':L': '🥴',
        ':C': '🥺',
        ':F': '🥳',
        ':Z': '🤢',
        ':^': '🤓',
        ':K': '🤫',
        ':D!': '🤯',
        ':H': '🧐',
        ':U': '🤥',
        ':V': '🤪',
        ':N': '🥶',
        ':J': '🥴',
    };
    for (let i in chatInputEmoji) {
        let regex = new RegExp(escapeSpecialChars(i), 'gim');
        this.value = this.value.replace(regex, chatInputEmoji[i]);
    }
};

function sendMessage() {
    if (peerConnection && messageInput.value != '') {
        if (dataChannel.readyState === 'open') {
            dataChannel.send(
                JSON.stringify({
                    username: username,
                    message: messageInput.value,
                }),
            );
        }
    } else {
        popupMessage('toast', 'Video', 'There is no broadcast connected', 'top');
    }
    messageInput.value = '';
}

// =====================================================
// Handle window exit
// =====================================================

window.onbeforeunload = () => {
    socket.close();
    if (peerConnection) {
        peerConnection.close();
    }
    stopSessionTime();
    saveRecording();
    return undefined;
};
