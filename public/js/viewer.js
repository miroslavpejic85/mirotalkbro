'use strict';

const broadcastID = new URLSearchParams(window.location.search).get('id');
const username = new URLSearchParams(window.location.search).get('name');

console.log('Viewer', {
    username: username,
    roomId: broadcastID,
});

const body = document.querySelector('body');

const awaitingBroadcaster = document.getElementById('awaitingBroadcaster');
const viewerForm = document.getElementById('viewerForm');
const viewerFormHeader = document.getElementById('viewerFormHeader');
const viewerButtons = document.getElementById('viewerButtons');
const myName = document.getElementById('myName');
const sessionTime = document.getElementById('sessionTime');
const video = document.getElementById('mainVideo');
const videoOff = document.getElementById('videoOff');

const enableAudio = document.getElementById('enableAudio');
const disableAudio = document.getElementById('disableAudio');
const videoBtn = document.getElementById('videoBtn');
const recordingStart = document.getElementById('recordingStart');
const recordingStop = document.getElementById('recordingStop');
const recordingLabel = document.getElementById('recordingLabel');
const recordingTime = document.getElementById('recordingTime');
const snapshot = document.getElementById('snapshot');
const fullScreenOn = document.getElementById('fullScreenOn');
const fullScreenOff = document.getElementById('fullScreenOff');
const togglePIP = document.getElementById('togglePIP');
const qualitySelect = document.getElementById('qualitySelect');
const leave = document.getElementById('leave');
const messagesBtn = document.getElementById('messagesBtn');
const messagesForm = document.getElementById('messagesForm');
const messagesCloseBtn = document.getElementById('messagesCloseBtn');
const viewerMessagesArea = document.getElementById('viewerMessagesArea');
const messageInput = document.getElementById('messageInput');
const messageSend = document.getElementById('messageSend');
const messagesClean = document.getElementById('messagesClean');
const messagesSave = document.getElementById('messagesSave');

const userAgent = navigator.userAgent;
const parser = new UAParser(userAgent);
const result = parser.getResult();
const deviceType = result.device.type || 'desktop';
const isMobileDevice = deviceType === 'mobile';

const viewerVideo = document.getElementById('viewerVideo');
const viewerVideoOff = document.getElementById('viewerVideoOff');
const viewerVideoContainer = document.getElementById('viewerVideoContainer');

// =====================================================
// Body on Load
// =====================================================

body.onload = onBodyLoad;

function onBodyLoad() {
    loadViewerToolTip();
}

// =====================================================
// Handle theme
// =====================================================

const getMode = window.localStorage.mode || 'dark';
const dark = getMode === 'dark';
if (dark) body.classList.toggle('dark');

// =====================================================
// Handle ToolTips
// =====================================================

function loadViewerToolTip() {
    const viewerTooltips = [
        { element: enableAudio, text: 'Enable your audio', position: 'top' },
        { element: disableAudio, text: 'Disable your audio', position: 'top' },
        { element: videoBtn, text: 'Toggle your video', position: 'top' },
        { element: recordingStart, text: 'Start recording', position: 'top' },
        { element: recordingStop, text: 'Stop recording', position: 'top' },
        { element: snapshot, text: 'Take a snapshot', position: 'top' },
        { element: togglePIP, text: 'Toggle picture in picture', position: 'top' },
        { element: qualitySelect, text: 'Video quality', position: 'top' },
        { element: messagesBtn, text: 'Toggle messages', position: 'top' },
        { element: fullScreenOn, text: 'Enable full screen', position: 'top' },
        { element: fullScreenOff, text: 'Disable full screen', position: 'top' },
        { element: leave, text: 'Disconnect', position: 'top' },
    ];

    viewerTooltips.forEach(({ element, text, position }) => {
        setTippy(element, text, position);
    });
}

let zoom = 1;
let messagesFormOpen = false;
let allViewerMessages = [];
let recording = null;
let recordingTimer = null;
let sessionTimer = null;

myName.innerText = username;

// =====================================================
// Handle RTC Peer Connection
// =====================================================

let peerConnection;
let dataChannel;
let viewerStream;
let broadcastingMode = 'p2p'; // Will be set by server

// SFU mode state
let sfuDevice = null;
let sfuRecvTransport = null;
let sfuSendTransport = null;
let sfuConsumers = new Map(); // producerId -> consumer
let sfuProducers = new Map(); // kind -> producer
let sfuJoined = false; // guard to prevent double SFU join
let isFirstConnect = true; // track first vs reconnect
let isBroadcasterConnected = false; // track if broadcaster is present

const socket = io.connect(window.location.origin);

socket.on('disconnect', () => {
    console.log('Socket disconnected, waiting for reconnect...');
    const reconnectingOverlay = document.getElementById('reconnectingOverlay');
    if (reconnectingOverlay) reconnectingOverlay.classList.add('active');
});

// Server tells us which mode to use
socket.on('broadcastingMode', async (mode) => {
    const reconnectingOverlay = document.getElementById('reconnectingOverlay');
    if (reconnectingOverlay) reconnectingOverlay.classList.remove('active');
    broadcastingMode = mode;
    console.log('Broadcasting mode:', broadcastingMode);

    // SFU reconnect: if we already joined once, server restarted and all
    // mediasoup state is gone. Reset and re-join.
    if (broadcastingMode === 'sfu' && sfuJoined) {
        // Save current audio/video UI state before reset
        // (sfuResetState closes transports which stops tracks, so track.enabled is lost)
        const savedAudioEnabled = disableAudio.style.display !== 'none';
        const savedVideoEnabled = videoBtn.style.color !== 'red';

        sfuResetState();
        // Re-acquire viewer stream if tracks ended
        if (viewerStream) {
            const tracks = viewerStream.getTracks();
            const allEnded = tracks.length === 0 || tracks.every((t) => t.readyState === 'ended');
            if (allEnded) {
                viewerStream = await getStream();
            }
        }

        // Restore track enabled state on the fresh stream to match UI
        if (viewerStream) {
            const audioTrack = viewerStream.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = savedAudioEnabled;
            const videoTrack = viewerStream.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = savedVideoEnabled;
            // Update the video element srcObject if video was on
            if (savedVideoEnabled && viewerVideoContainer.style.display !== 'none') {
                viewerVideo.srcObject = viewerStream;
            }
        }

        await sfuJoinBroadcast();
        return;
    }

    // Trigger SFU join here because 'connect' fires before this event arrives
    if (broadcastingMode === 'sfu' && !sfuJoined) {
        await sfuJoinBroadcast();
    }
});

// =====================================================
// P2P Mode handlers (original mesh logic)
// =====================================================

socket.on('offer', async (id, description, iceServers) => {
    if (broadcastingMode !== 'p2p') return;

    peerConnection = new RTCPeerConnection({ iceServers: iceServers });

    handleDataChannel();

    peerConnection.onconnectionstatechange = (event) => {
        console.log('RTCPeerConnection', {
            connectionStatus: event.currentTarget.connectionState,
            signalingState: event.currentTarget.signalingState,
        });
    };

    if (viewerStream) {
        viewerStream.getTracks().forEach((track) => peerConnection.addTrack(track, viewerStream));
    }

    peerConnection.ontrack = (event) => {
        saveRecording();
        attachStream(event.streams[0]);
        hideElement(awaitingBroadcaster);
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', id, event.candidate);
        }
    };

    peerConnection
        .setRemoteDescription(description)
        .then(() => peerConnection.createAnswer())
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => socket.emit('answer', id, peerConnection.localDescription))
        .catch(handleError);
});

socket.on('candidate', (id, candidate) => {
    if (broadcastingMode !== 'p2p') return;
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(handleError);
});

socket.on('connect', async () => {
    const reconnectingOverlay = document.getElementById('reconnectingOverlay');
    if (reconnectingOverlay) reconnectingOverlay.classList.remove('active');
    if (isFirstConnect) {
        isFirstConnect = false;
        await checkViewerAudioVideo();
    }
    // Note: broadcastingMode event arrives AFTER connect, so in SFU mode
    // the join is initiated from the broadcastingMode handler instead.
    // On reconnect, broadcastingMode handler handles SFU reset + rejoin.
    if (broadcastingMode !== 'sfu') {
        socket.emit('viewer', broadcastID, username);
    }
});

socket.on('broadcaster', () => {
    isBroadcasterConnected = true;
    if (broadcastingMode === 'sfu') {
        if (!sfuJoined) sfuJoinBroadcast();
    } else {
        socket.emit('viewer', broadcastID, username);
    }
});

socket.on('broadcasterDisconnect', () => {
    isBroadcasterConnected = false;
    location.reload();
});

function handleError(error) {
    console.error('Error', error);
}

// =====================================================
// SFU Mode: mediasoup client logic
// =====================================================

async function sfuJoinBroadcast() {
    if (sfuJoined) return;
    sfuJoined = true;

    try {
        // Initialize device
        if (!sfuDevice) {
            if (typeof mediasoupClient === 'undefined') {
                console.error('mediasoup-client library not loaded');
                return;
            }
            sfuDevice = new mediasoupClient.Device();
            const { rtpCapabilities } = await sfuSocketRequest('sfu-getRtpCapabilities', broadcastID);
            await sfuDevice.load({ routerRtpCapabilities: rtpCapabilities });
            console.log('SFU Device loaded', { loaded: sfuDevice.loaded });
        }

        // Create recv transport
        if (!sfuRecvTransport) {
            const transportParams = await sfuSocketRequest('sfu-createViewerTransport', {
                broadcastID,
                username,
            });

            sfuRecvTransport = sfuDevice.createRecvTransport(transportParams);

            sfuRecvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    await sfuSocketRequest('sfu-connectViewerTransport', {
                        broadcastID,
                        dtlsParameters,
                    });
                    callback();
                } catch (error) {
                    errback(error);
                }
            });

            sfuRecvTransport.on('connectionstatechange', (state) => {
                console.log('SFU Recv Transport state:', state);
            });
        }

        // Register as viewer
        socket.emit('viewer', broadcastID, username);

        // Get existing producers and consume them
        const { producers } = await sfuSocketRequest('sfu-getProducers', broadcastID);
        if (producers.length > 0) isBroadcasterConnected = true;
        for (const { producerId, kind } of producers) {
            await sfuConsumeProducer(producerId, kind);
        }

        // If viewer has a send stream, produce it
        if (viewerStream) {
            await sfuProduceViewerStream();
            // Re-send current audio/video status to broadcaster (important after reconnect)
            sfuResendMediaStatus();
        }
    } catch (error) {
        console.error('SFU join error', error);
        sfuJoined = false; // allow retry on failure
    }
}

async function sfuConsumeProducer(producerId, kind) {
    try {
        const response = await sfuSocketRequest('sfu-consume', {
            broadcastID,
            producerId,
            rtpCapabilities: sfuDevice.rtpCapabilities,
        });

        const { consumerId, rtpParameters, producerPaused } = response;

        const consumer = await sfuRecvTransport.consume({
            id: consumerId,
            producerId,
            kind,
            rtpParameters,
        });

        sfuConsumers.set(producerId, consumer);

        // Resume the consumer on the server
        await sfuSocketRequest('sfu-resumeConsumer', { broadcastID, consumerId });

        // Build a new MediaStream with all active consumer tracks
        const tracks = [];
        for (const [, c] of sfuConsumers) {
            if (c.track && !c.closed) {
                tracks.push(c.track);
            }
        }
        const stream = new MediaStream(tracks);
        attachStream(stream);
        video.play().catch(() => {});

        hideElement(awaitingBroadcaster);
        console.log('SFU consuming', { producerId, kind, consumerId });

        consumer.on('trackended', () => {
            console.log('Consumer track ended', { producerId });
        });

        consumer.on('transportclose', () => {
            sfuConsumers.delete(producerId);
        });
    } catch (error) {
        console.error('SFU consume error', error);
    }
}

// Handle new producer from broadcaster (when broadcast starts or track changes)
socket.on('sfu-newProducer', async ({ producerId, kind }) => {
    if (broadcastingMode !== 'sfu') return;
    await sfuConsumeProducer(producerId, kind);
});

// Handle producer closed
socket.on('sfu-producerClosed', ({ producerId }) => {
    if (broadcastingMode !== 'sfu') return;
    const consumer = sfuConsumers.get(producerId);
    if (consumer) {
        consumer.close();
        sfuConsumers.delete(producerId);
    }
});

// Handle producer replaced (e.g., screen share toggle)
socket.on('sfu-producerReplaced', async ({ oldProducerId, newProducerId, kind }) => {
    if (broadcastingMode !== 'sfu') return;

    // Close old consumer
    const oldConsumer = sfuConsumers.get(oldProducerId);
    if (oldConsumer) {
        oldConsumer.close();
        sfuConsumers.delete(oldProducerId);
    }

    // Remove old tracks from video
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks().filter((t) => t.readyState === 'ended');
        tracks.forEach((t) => video.srcObject.removeTrack(t));
    }

    // Consume new producer
    await sfuConsumeProducer(newProducerId, kind);
});

async function sfuProduceViewerStream() {
    try {
        if (!sfuSendTransport) {
            const transportParams = await sfuSocketRequest('sfu-createViewerSendTransport', {
                broadcastID,
            });

            sfuSendTransport = sfuDevice.createSendTransport(transportParams);

            sfuSendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    await sfuSocketRequest('sfu-connectViewerSendTransport', {
                        broadcastID,
                        dtlsParameters,
                    });
                    callback();
                } catch (error) {
                    errback(error);
                }
            });

            sfuSendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
                try {
                    const { producerId } = await sfuSocketRequest('sfu-viewerProduce', {
                        broadcastID,
                        kind,
                        rtpParameters,
                        appData,
                    });
                    callback({ id: producerId });
                } catch (error) {
                    errback(error);
                }
            });
        }

        const audioTrack = viewerStream.getAudioTracks()[0];
        const videoTrack = viewerStream.getVideoTracks()[0];

        if (audioTrack) {
            const producer = await sfuSendTransport.produce({ track: audioTrack });
            sfuProducers.set('audio', producer);
        }
        if (videoTrack) {
            const producer = await sfuSendTransport.produce({ track: videoTrack });
            sfuProducers.set('video', producer);
        }
    } catch (error) {
        console.error('SFU viewer produce error', error);
    }
}

// SFU data messages through socket.io
socket.on('sfu-dataMessage', (data) => {
    if (broadcastingMode !== 'sfu') return;
    handleDataChannelMessage(data);
});

// Helper: promisify socket.emit with callback
function sfuSocketRequest(event, data) {
    return new Promise((resolve, reject) => {
        socket.emit(event, data, (response) => {
            if (response && response.error) {
                reject(new Error(response.error));
            } else {
                resolve(response);
            }
        });
    });
}

function sfuResetState() {
    // Close old transports to stop stale WebRTC traffic.
    // Track ending is fine since fresh tracks are acquired on reconnect.
    try {
        if (sfuRecvTransport) sfuRecvTransport.close();
    } catch (e) {}
    try {
        if (sfuSendTransport) sfuSendTransport.close();
    } catch (e) {}
    sfuDevice = null;
    sfuRecvTransport = null;
    sfuSendTransport = null;
    sfuConsumers = new Map();
    sfuProducers = new Map();
    sfuJoined = false;
}

function sfuResendMediaStatus() {
    if (!viewerStream) return;

    // Check current audio state
    const audioTrack = viewerStream.getAudioTracks()[0];
    const audioEnabled = audioTrack ? audioTrack.enabled : false;
    // Pause new audio producer if audio is off (client + server)
    const audioProducer = sfuProducers.get('audio');
    if (audioProducer && !audioEnabled) {
        audioProducer.pause();
        sfuSocketRequest('sfu-pauseProducer', { broadcastID, producerId: audioProducer.id }).catch(() => {});
    }
    sendToBroadcasterDataChannel('audio', {
        id: socket.id,
        username: username,
        enabled: audioEnabled,
    });

    // Check current video state
    const videoTrack = viewerStream.getVideoTracks()[0];
    const videoEnabled = videoTrack ? videoTrack.enabled : false;
    // Pause new video producer if video is off (client + server)
    const videoProducer = sfuProducers.get('video');
    if (videoProducer && !videoEnabled) {
        videoProducer.pause();
        sfuSocketRequest('sfu-pauseProducer', { broadcastID, producerId: videoProducer.id }).catch(() => {});
    }
    sendToBroadcasterDataChannel('video', {
        id: socket.id,
        username: username,
        enabled: videoEnabled,
    });
}

// =====================================================
// Check Viewer Audio/Video
// =====================================================

async function checkViewerAudioVideo() {
    if (broadcastSettings.options.show_viewers && (viewerSettings.buttons.audio || viewerSettings.buttons.video)) {
        viewerStream = await getStream();
        if (viewerSettings.buttons.audio) disableAudio.click();
        if (viewerSettings.buttons.video) videoBtn.click();
        // If SFU already joined but viewerStream wasn't ready, produce it now
        if (broadcastingMode === 'sfu' && sfuJoined && viewerStream) {
            await sfuProduceViewerStream();
            sfuResendMediaStatus();
        }
    }
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
        case 'message':
            appendViewerMessage(data.action.message, data.action.username, data.action.isBroadcaster);
            playSound('message');
            break;
        case 'mute':
            if (disableAudio.style.display !== 'none') {
                disableAudio.click();
                popupMessage('toast', 'Broadcaster', 'Broadcaster muted your microphone', 'top');
            }
            break;
        case 'hide':
            if (videoBtn.style.color !== 'red') {
                videoBtn.click();
                popupMessage('toast', 'Broadcaster', 'Broadcaster hide your camera', 'top');
            }
            break;
        case 'disconnect':
            openURL(viewerSettings.options.disconnect_url);
            break;
        case 'video':
            videoOff.style.visibility = data.action.visibility;
            break;
        case 'audio':
            popupMessage(
                'toast',
                'Broadcaster',
                `Broadcaster audio ${data.action.enable ? 'enabled' : 'disabled'}`,
                'top'
            );
            break;
        //...
        default:
            console.error('Data channel message not handled', data);
            break;
    }
}

function sendToBroadcasterDataChannel(method, action = {}) {
    if (broadcastingMode === 'sfu') {
        // SFU mode: send through socket.io
        socket.emit('sfu-dataMessage', {
            broadcastID,
            method,
            action,
        });
        return;
    }

    // P2P mode: send through WebRTC data channel
    if (!peerConnection || !dataChannel) return;

    if (dataChannel.readyState !== 'open') {
        console.warn('DataChannel is not open. Current state:', dataChannel.readyState);
        return;
    }

    dataChannel.send(
        JSON.stringify({
            method: method,
            action: action,
        })
    );
}

// =====================================================
// Handle element display
// =====================================================

elementDisplay(fullScreenOff, false);
elementDisplay(disableAudio, broadcastSettings.options.show_viewers && viewerSettings.buttons.audio);
elementDisplay(enableAudio, broadcastSettings.options.show_viewers && viewerSettings.buttons.audio && false);
elementDisplay(videoBtn, broadcastSettings.options.show_viewers && viewerSettings.buttons.video);
elementDisplay(recordingLabel, false);
elementDisplay(recordingStop, false);
elementDisplay(snapshot, viewerSettings.buttons.snapshot);
elementDisplay(recordingStart, viewerSettings.buttons.recordingStart);
elementDisplay(fullScreenOn, viewerSettings.buttons.fullScreenOn && isFullScreenSupported());
elementDisplay(togglePIP, viewerSettings.buttons.pictureInPicture && isPIPSupported());
elementDisplay(qualitySelect, viewerSettings.buttons.qualitySelect);
elementDisplay(leave, viewerSettings.buttons.close);

messageDisplay(viewerSettings.buttons.message);

function messageDisplay(display) {
    elementDisplay(messagesBtn, display);
}

if (viewerSettings.options.start_full_screen) {
    viewerForm.classList.remove(...viewerForm.classList);
    viewerForm.classList.add('full-screen');
    elementDisplay(viewerFormHeader, false);
    elementDisplay(viewerButtons, false);
    messagesForm.classList.remove('panel-open');
    messagesFormOpen = false;
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
messagesCloseBtn.addEventListener('click', toggleMessages);
messagesClean.addEventListener('click', cleanViewerMessages);
messagesSave.addEventListener('click', saveViewerMessages);

function toggleMessages() {
    messagesFormOpen = !messagesFormOpen;
    messagesForm.classList.toggle('panel-open', messagesFormOpen);
}

function saveViewerMessages() {
    if (allViewerMessages.length !== 0) {
        return saveAllMessages(allViewerMessages);
    }
    popupMessage('toast', 'Messages', "There isn't messages to save", 'top');
}

function cleanViewerMessages() {
    if (allViewerMessages.length !== 0) {
        return Swal.fire({
            position: 'top',
            title: 'Clean up',
            text: 'Do you want to clean up all the messages?',
            showDenyButton: true,
            confirmButtonText: 'Yes',
            denyButtonText: 'No',
            showClass: { popup: 'animate__animated animate__fadeInDown' },
            hideClass: { popup: 'animate__animated animate__fadeOutUp' },
        }).then((result) => {
            if (result.isConfirmed) {
                viewerMessagesArea.innerHTML = '';
                allViewerMessages = [];
            }
        });
    }
    popupMessage('toast', 'Messages', "There isn't messages to delete", 'top');
}

// =====================================================
// Handle audio stream
// =====================================================

enableAudio.addEventListener('click', () => toggleAudio(true));
disableAudio.addEventListener('click', () => toggleAudio(false));

function toggleAudio(enabled) {
    if (!viewerStream) return;

    viewerStream.getAudioTracks()[0].enabled = !viewerStream.getAudioTracks()[0].enabled;

    elementDisplay(enableAudio, !enabled);
    elementDisplay(disableAudio, enabled && viewerSettings.buttons.audio);

    // In SFU mode, pause/resume the audio producer (client + server)
    if (broadcastingMode === 'sfu') {
        const audioProducer = sfuProducers.get('audio');
        if (audioProducer) {
            if (enabled) {
                audioProducer.resume();
                sfuSocketRequest('sfu-resumeProducer', { broadcastID, producerId: audioProducer.id }).catch(() => {});
            } else {
                audioProducer.pause();
                sfuSocketRequest('sfu-pauseProducer', { broadcastID, producerId: audioProducer.id }).catch(() => {});
            }
        }
    }

    // Only send status to broadcaster after we've joined
    if (broadcastingMode === 'sfu' && !sfuJoined) return;

    sendToBroadcasterDataChannel('audio', {
        id: socket.id,
        username: username,
        enabled: enabled,
    });

    checkTrackAndPopup(viewerStream);
}

// =====================================================
// Handle video stream
// =====================================================

videoBtn.addEventListener('click', toggleVideo);

function toggleVideo() {
    if (!viewerStream) return;

    viewerStream.getVideoTracks()[0].enabled = !viewerStream.getVideoTracks()[0].enabled;

    const color = getMode === 'dark' ? 'white' : 'black';
    const enabled = videoBtn.style.color !== 'red';
    videoBtn.style.color = enabled ? 'red' : color;

    // Show/hide viewer video
    if (viewerStream.getVideoTracks()[0].enabled) {
        viewerVideo.srcObject = viewerStream;
        viewerVideoContainer.style.display = 'block';
    } else {
        viewerVideoContainer.style.display = 'none';
        viewerVideo.srcObject = null;
    }

    // In SFU mode, pause/resume the video producer (client + server)
    if (broadcastingMode === 'sfu') {
        const videoProducer = sfuProducers.get('video');
        if (videoProducer) {
            if (!enabled) {
                videoProducer.resume();
                sfuSocketRequest('sfu-resumeProducer', { broadcastID, producerId: videoProducer.id }).catch(() => {});
            } else {
                videoProducer.pause();
                sfuSocketRequest('sfu-pauseProducer', { broadcastID, producerId: videoProducer.id }).catch(() => {});
            }
        }
    }

    // Only send status to broadcaster after we've joined
    if (broadcastingMode === 'sfu' && !sfuJoined) return;

    sendToBroadcasterDataChannel('video', {
        id: socket.id,
        username: username,
        enabled: !enabled,
    });

    checkTrackAndPopup(viewerStream);
}

// =====================================================
// Handle video
// =====================================================

video.addEventListener('click', toggleFullScreen);
video.addEventListener('wheel', handleZoom);

function toggleFullScreen() {
    if (isMobileDevice) return;
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
    video.controls = false;
}

async function getStream() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: viewerSettings.buttons.video,
            audio: viewerSettings.buttons.audio,
        });
        return stream;
    } catch (error) {
        console.error('Failed to access media devices:', error.message);
        handleMediaStreamError(error);
        hideVideoAudioButtons();
        return null;
    }
}

function hideVideoAudioButtons() {
    elementDisplay(disableAudio, false);
    elementDisplay(enableAudio, false);
    elementDisplay(videoBtn, false);
}

video.addEventListener('loadeddata', () => {
    video.play().catch((error) => {
        console.error('Autoplay failed', error.message);
        popupEnableAutoPlay();
    });
});

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

handleVideoPIPonExit();

function handleVideoPIP() {
    if (!video.srcObject) {
        popupMessage('toast', 'Picture-in-Picture', 'There is no video for PIP', 'top');
    } else {
        togglePictureInPicture(video);
    }
}

// =====================================================
// Handle quality selector (SFU simulcast layer)
// =====================================================

qualitySelect.addEventListener('click', handleQualitySelect);

let selectedQualityLayer = '-1';

function handleQualitySelect() {
    if (broadcastingMode !== 'sfu') {
        popupMessage('toast', 'Quality', 'Quality selector is only available in SFU mode', 'top');
        return;
    }

    // Find the video consumer
    let videoConsumer = null;
    for (const [, c] of sfuConsumers) {
        if (c.kind === 'video' && !c.closed) {
            videoConsumer = c;
            break;
        }
    }

    if (!videoConsumer) {
        popupMessage('toast', 'Quality', 'No video stream available', 'top');
        return;
    }

    const layers = [
        { label: 'Auto', spatial: -1 },
        { label: 'Low (1/4)', spatial: 0 },
        { label: 'Medium (1/2)', spatial: 1 },
        { label: 'High (Full)', spatial: 2 },
    ];

    const inputOptions = {};
    layers.forEach((l) => {
        inputOptions[l.spatial] = l.label;
    });

    Swal.fire({
        position: 'top',
        title: 'Video Quality',
        input: 'select',
        inputOptions: inputOptions,
        inputValue: selectedQualityLayer,
        showCancelButton: true,
        confirmButtonText: 'Apply',
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then(async (result) => {
        if (result.isConfirmed) {
            const spatialLayer = parseInt(result.value);
            selectedQualityLayer = result.value;
            try {
                if (spatialLayer === -1) {
                    // Auto: set to highest layer, let mediasoup adapt
                    await sfuSocketRequest('sfu-setPreferredLayers', {
                        broadcastID,
                        consumerId: videoConsumer.id,
                        spatialLayer: 2,
                    });
                } else {
                    await sfuSocketRequest('sfu-setPreferredLayers', {
                        broadcastID,
                        consumerId: videoConsumer.id,
                        spatialLayer: spatialLayer,
                    });
                }
                const label = layers.find((l) => l.spatial === spatialLayer)?.label || 'Auto';
                popupMessage('toast', 'Quality', `Video quality set to: ${label}`, 'top');
            } catch (error) {
                console.error('Failed to set quality', error);
                popupMessage('toast', 'Quality', 'Failed to set video quality', 'top');
            }
        }
    });
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

leave.addEventListener('click', disconnectMe);

function disconnectMe() {
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
    const canSend = broadcastingMode === 'sfu' ? sfuJoined && isBroadcasterConnected : !!peerConnection;
    if (canSend && messageInput.value != '') {
        appendViewerMessage(messageInput.value);
        sendToBroadcasterDataChannel('message', {
            id: socket.id,
            username: username,
            message: messageInput.value,
        });
    } else {
        popupMessage('toast', 'Video', 'There is no broadcast connected', 'top');
    }
    messageInput.value = '';
}

function appendViewerMessage(text, from = null, isBroadcaster = false) {
    const timeNow = getTime();
    const msg = document.createElement('div');
    msg.className = 'viewer-msg';
    const time = document.createElement('div');
    time.className = 'viewer-msg-time';
    if (from && isBroadcaster) {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'viewer-msg-broadcaster';
        nameSpan.innerText = from;
        time.innerText = `${timeNow} - `;
        time.appendChild(nameSpan);
    } else {
        time.innerText = from ? `${timeNow} - ${from}` : timeNow;
    }
    const body = document.createElement('div');
    body.className = 'viewer-msg-text';
    body.innerText = text;
    msg.appendChild(time);
    msg.appendChild(body);
    viewerMessagesArea.appendChild(msg);
    viewerMessagesArea.scrollTop = viewerMessagesArea.scrollHeight;
    allViewerMessages.push({
        time: timeNow,
        from: from || username,
        message: text,
    });
}

// =====================================================
// Handle window exit
// =====================================================

window.onbeforeunload = () => {
    socket.close();
    if (broadcastingMode === 'sfu') {
        for (const [, consumer] of sfuConsumers) {
            consumer.close();
        }
        sfuConsumers.clear();
        for (const [, producer] of sfuProducers) {
            producer.close();
        }
        sfuProducers.clear();
        if (sfuRecvTransport) sfuRecvTransport.close();
        if (sfuSendTransport) sfuSendTransport.close();
    } else if (peerConnection) {
        peerConnection.close();
    }
    stopSessionTime();
    saveRecording();
    return undefined;
};
