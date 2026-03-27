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
const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');

const copyRoom = document.getElementById('copyRoom');
const shareRoom = document.getElementById('shareRoom');
const enableAudio = document.getElementById('enableAudio');
const disableAudio = document.getElementById('disableAudio');
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
const messageInput = document.getElementById('messageInput');
const messageSend = document.getElementById('messageSend');

const viewersOpenForm = document.getElementById('viewersOpenForm');
const viewersCloseForm = document.getElementById('viewersCloseForm');
const viewersForm = document.getElementById('viewersForm');
const viewersFormHeader = document.getElementById('viewersFormHeader');
const viewersTable = document.getElementById('viewersTable');
const viewerOpenMessageForm = document.getElementById('viewerOpenMessageForm');
const viewersSave = document.getElementById('viewersSave');
const viewerSearch = document.getElementById('viewerSearch');
const viewersMuteAudio = document.getElementById('viewersMuteAudio');
const viewersHideVideo = document.getElementById('viewersHideVideo');
const viewersDisconnect = document.getElementById('viewersDisconnect');

const fullScreenOn = document.getElementById('fullScreenOn');
const fullScreenOff = document.getElementById('fullScreenOff');
const togglePIP = document.getElementById('togglePIP');
const goHome = document.getElementById('goHome');

const videoSelect = document.getElementById('videoSelect');
const videoQualitySelect = document.getElementById('videoQualitySelect');
const videoFpsSelect = document.getElementById('videoFpsSelect');
const audioSelect = document.getElementById('audioSelect');

const userAgent = navigator.userAgent;
const parser = new UAParser(userAgent);
const result = parser.getResult();
const deviceType = result.device.type || 'desktop';
const isMobileDevice = deviceType === 'mobile';
const isTabletDevice = deviceType === 'tablet';
const isIPadDevice = result.device.model?.toLowerCase() === 'ipad';
const isDesktopDevice = deviceType === 'desktop';

const isSpeechSynthesisSupported = 'speechSynthesis' in window;

const images = {
    poster: '../assets/images/loader.gif',
    mute: '../assets/images/mute.png',
    hide: '../assets/images/hide.png',
    viewer: '../assets/images/viewer.png',
    muteLight: '../assets/images/mute-light.png',
    hideLight: '../assets/images/hide-light.png',
    viewerLight: '../assets/images/viewer-light.png',
};

// =====================================================
// Body on Load
// =====================================================

body.onload = onBodyLoad;

function onBodyLoad() {
    loadBroadcasterToolTip();
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

function loadBroadcasterToolTip() {
    const broadcastTooltips = [
        { element: copyRoom, text: 'Copy and share room URL', position: 'top' },
        { element: shareRoom, text: 'Share room URL', position: 'top' },
        { element: enableAudio, text: 'Enable audio', position: 'top' },
        { element: disableAudio, text: 'Disable audio', position: 'top' },
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
        { element: toggleSettingsBtn, text: 'Toggle settings', position: 'top' },
        { element: goHome, text: 'Go to home page', position: 'top' },
        { element: messagesClean, text: 'Clean messages', position: 'top' },
        { element: messagesSave, text: 'Save messages', position: 'top' },
        { element: messagesOpenViewersForm, text: 'Toggle viewers', position: 'top' },
        { element: messagesCloseForm, text: 'Close', position: 'top' },
        { element: viewersMuteAudio, text: 'Mute all viewers microphone', position: 'top' },
        { element: viewersHideVideo, text: 'Hide all viewers camera', position: 'top' },
        { element: viewersDisconnect, text: 'Disconnect all viewers', position: 'top' },
        { element: viewersSave, text: 'Save viewers', position: 'top' },
        { element: viewerOpenMessageForm, text: 'Toggle messages', position: 'top' },
        { element: viewersCloseForm, text: 'Close', position: 'top' },
    ];

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
let settingsFormOpen = false;
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
let broadcastingMode = 'p2p'; // Will be set by server

// SFU mode state
let sfuDevice = null;
let sfuSendTransport = null;
let sfuRecvTransport = null;
let sfuRecvTransportPromise = null; // serializes recv transport creation
let sfuProducers = new Map(); // kind -> producer
let sfuConsumers = new Map(); // producerId -> consumer
let sfuViewerCount = 0;

const socket = io.connect(window.location.origin);
const reconnectingOverlay = document.getElementById('reconnectingOverlay');

socket.on('disconnect', () => {
    console.log('Socket disconnected, waiting for reconnect...');
    if (reconnectingOverlay) reconnectingOverlay.classList.add('active');
});

// Server tells us which mode to use
socket.on('broadcastingMode', (mode) => {
    if (reconnectingOverlay) reconnectingOverlay.classList.remove('active');
    broadcastingMode = mode;
    console.log('Broadcasting mode:', broadcastingMode);

    const modeLabel = document.getElementById('broadcastingModeLabel');
    if (modeLabel) {
        const modeText = modeLabel.querySelector('.mode-text');
        if (modeText) modeText.textContent = broadcastingMode.toUpperCase();
        modeLabel.className = 'broadcasting-mode-badge mode-' + broadcastingMode;
    }

    // SFU reconnect: if we already had SFU state, the server restarted and all
    // mediasoup state is gone. Reset and re-broadcast with a fresh stream.
    if (broadcastingMode === 'sfu' && sfuSendTransport && broadcastStream) {
        sfuResetState();
        // Re-acquire stream since old tracks may have ended
        getStream();
    }
});

// =====================================================
// P2P Mode handlers (original mesh logic)
// =====================================================

socket.on('answer', (id, description) => {
    if (broadcastingMode !== 'p2p') return;
    peerConnections[id].setRemoteDescription(description);
});

socket.on('viewer', (id, iceServers, username) => {
    if (broadcastingMode === 'sfu') {
        // SFU mode: skip if already tracked (e.g. from sfuExistingViewers)
        if (connectedViewers[id]) return;
        sfuViewerCount++;
        addViewer(id, username);
        connectedPeers.innerText = sfuViewerCount;
        // Send current broadcaster video status to the new viewer
        sendToViewersDataChannel('video', { visibility: videoOff.style.visibility }, id);
        playSound('viewer');
        return;
    }

    // P2P mode: original logic
    const peerConnection = new RTCPeerConnection({ iceServers: iceServers });
    peerConnections[id] = peerConnection;

    handleDataChannels(id);

    addViewer(id, username);

    connectedPeers.innerText = Object.keys(peerConnections).length;

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

    peerConnection.ontrack = (event) => {
        addViewer(id, username, event.streams[0]);
    };

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
    if (broadcastingMode !== 'p2p') return;
    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate)).catch((e) => console.error(e));
});

socket.on('disconnectPeer', (id, username) => {
    if (broadcastingMode === 'sfu') {
        sfuViewerCount = Math.max(0, sfuViewerCount - 1);
        delViewer(id, username);
        connectedPeers.innerText = sfuViewerCount;
        return;
    }
    peerConnections[id].close();
    delete peerConnections[id];
    delete dataChannels[id];
    delViewer(id, username);
    connectedPeers.innerText = Object.keys(peerConnections).length;
});

// SFU mode: restore existing viewers when broadcaster reconnects
socket.on('sfuExistingViewers', async (existingViewers) => {
    if (broadcastingMode !== 'sfu') return;
    for (const { id, username } of existingViewers) {
        if (!connectedViewers[id]) {
            sfuViewerCount++;
            addViewer(id, username);
        }
    }
    connectedPeers.innerText = sfuViewerCount;

    // Consume existing viewer producers (they exist in the room from before the refresh)
    if (existingViewers.length > 0 && sfuDevice && sfuDevice.loaded) {
        await sfuConsumeExistingViewerProducers();
    }

    // Send current broadcaster video status to all existing viewers
    for (const { id } of existingViewers) {
        sendToViewersDataChannel('video', { visibility: videoOff.style.visibility }, id);
    }
});

function thereIsPeerConnections() {
    if (broadcastingMode === 'sfu') return sfuViewerCount > 0;
    return Object.keys(peerConnections).length > 0;
}

// =====================================================
// SFU Mode: mediasoup client logic
// =====================================================

async function sfuInitDevice(broadcastID) {
    if (typeof mediasoupClient === 'undefined') {
        console.error('mediasoup-client library not loaded');
        return;
    }

    sfuDevice = new mediasoupClient.Device();

    const { rtpCapabilities } = await socketRequest('sfu-getRtpCapabilities', broadcastID);
    await sfuDevice.load({ routerRtpCapabilities: rtpCapabilities });

    console.log('SFU Device loaded', { loaded: sfuDevice.loaded });
}

async function sfuCreateSendTransport(broadcastID) {
    const transportParams = await socketRequest('sfu-createBroadcasterTransport', broadcastID);

    sfuSendTransport = sfuDevice.createSendTransport(transportParams);

    sfuSendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
            await socketRequest('sfu-connectBroadcasterTransport', {
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
            const { producerId } = await socketRequest('sfu-produce', {
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

    sfuSendTransport.on('connectionstatechange', (state) => {
        console.log('SFU Send Transport state:', state);
        if (state === 'failed') {
            sfuSendTransport.close();
        }
    });

    console.log('SFU Send Transport created', { id: sfuSendTransport.id });
}

async function sfuProduceStream(stream) {
    if (!sfuSendTransport) return;

    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];

    if (audioTrack) {
        const existingAudio = sfuProducers.get('audio');
        if (existingAudio && !existingAudio.closed) {
            // Replace track on existing producer instead of closing/recreating
            await existingAudio.replaceTrack({ track: audioTrack });
        } else {
            if (existingAudio) {
                existingAudio.close();
                sfuProducers.delete('audio');
            }
            const audioProducer = await sfuSendTransport.produce({ track: audioTrack });
            sfuProducers.set('audio', audioProducer);
            audioProducer.on('transportclose', () => {
                sfuProducers.delete('audio');
            });
            audioProducer.on('trackended', () => {
                console.log('Audio track ended');
            });
        }
    }

    if (videoTrack) {
        const isScreenShare = screenShareEnabled;
        const existingVideo = sfuProducers.get('video');
        if (existingVideo && !existingVideo.closed) {
            // Replace track on existing producer (e.g. camera -> screen share)
            await existingVideo.replaceTrack({ track: videoTrack });
        } else {
            if (existingVideo) {
                existingVideo.close();
                sfuProducers.delete('video');
            }
            const produceOptions = {
                track: videoTrack,
            };
            if (simulcast.enabled && !isScreenShare) {
                produceOptions.encodings = simulcast.encodings;
                produceOptions.codecOptions = simulcast.codecOptions;
            }
            const videoProducer = await sfuSendTransport.produce(produceOptions);
            sfuProducers.set('video', videoProducer);
            videoProducer.on('transportclose', () => {
                sfuProducers.delete('video');
            });
            videoProducer.on('trackended', () => {
                console.log('Video track ended');
            });
        }
    }
}

// Handle viewer producer streams (SFU mode - viewer sends audio/video)
socket.on('sfu-viewerProducer', async ({ viewerSocketId, producerId, kind, username }) => {
    if (broadcastingMode !== 'sfu') return;

    // Skip if already consumed (e.g. from sfuConsumeExistingViewerProducers)
    if (sfuConsumers.has(producerId)) return;

    try {
        // Need a recv transport for broadcaster (serialized)
        await ensureSfuRecvTransport();

        const { consumerId, rtpParameters, producerPaused } = await socketRequest('sfu-broadcasterConsume', {
            broadcastID,
            producerId,
            rtpCapabilities: sfuDevice.rtpCapabilities,
        });

        const consumer = await sfuRecvTransport.consume({
            id: consumerId,
            producerId,
            kind,
            rtpParameters,
        });

        sfuConsumers.set(producerId, consumer);

        await socketRequest('sfu-resumeConsumer', { broadcastID, consumerId });

        // Update existing viewer card or create a new one
        const existingViewer = document.getElementById(viewerSocketId);
        const existingVideoEl = existingViewer ? existingViewer.querySelector('video') : null;

        if (existingVideoEl) {
            // Viewer card already exists - rebuild MediaStream with all tracks
            const existingTracks = existingVideoEl.srcObject ? [...existingVideoEl.srcObject.getTracks()] : [];
            existingTracks.push(consumer.track);
            existingVideoEl.srcObject = new MediaStream(existingTracks);
            existingVideoEl.poster = '';
            existingVideoEl.play().catch(() => {});

            // If this is a video track that arrives paused, show the "off" image
            if (kind === 'video' && producerPaused) {
                const videoOffEl = existingViewer.querySelector('img');
                if (videoOffEl) {
                    existingVideoEl.classList.add('hidden');
                    videoOffEl.classList.remove('hidden');
                }
            }
        } else {
            const stream = new MediaStream([consumer.track]);
            addViewer(viewerSocketId, username, stream);
        }
    } catch (error) {
        console.error('Error consuming viewer producer', error);
    }
});

// Ensures only one recv transport is created, even under concurrent calls
async function ensureSfuRecvTransport() {
    if (sfuRecvTransport) return;
    if (sfuRecvTransportPromise) {
        await sfuRecvTransportPromise;
        return;
    }
    sfuRecvTransportPromise = sfuCreateRecvTransport(broadcastID);
    await sfuRecvTransportPromise;
    sfuRecvTransportPromise = null;
}

async function sfuCreateRecvTransport(broadcastID) {
    const transportParams = await socketRequest('sfu-createViewerTransport', {
        broadcastID,
        username: 'broadcaster',
    });

    sfuRecvTransport = sfuDevice.createRecvTransport(transportParams);

    sfuRecvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
            await socketRequest('sfu-connectViewerTransport', {
                broadcastID,
                dtlsParameters,
            });
            callback();
        } catch (error) {
            errback(error);
        }
    });

    sfuRecvTransport.on('connectionstatechange', (state) => {
        console.log('SFU Broadcaster Recv Transport state:', state);
    });
}

// Consume existing viewer producers after broadcaster reconnect
async function sfuConsumeExistingViewerProducers() {
    try {
        const { viewerProducers } = await socketRequest('sfu-getViewerProducers', broadcastID);
        if (!viewerProducers || viewerProducers.length === 0) return;

        // Ensure recv transport exists (serialized)
        await ensureSfuRecvTransport();

        for (const { viewerSocketId, producerId, kind, username, paused } of viewerProducers) {
            // Skip if already consumed (e.g. from sfu-viewerProducer event)
            if (sfuConsumers.has(producerId)) continue;
            try {
                const { consumerId, rtpParameters, producerPaused } = await socketRequest('sfu-broadcasterConsume', {
                    broadcastID,
                    producerId,
                    rtpCapabilities: sfuDevice.rtpCapabilities,
                });

                const consumer = await sfuRecvTransport.consume({
                    id: consumerId,
                    producerId,
                    kind,
                    rtpParameters,
                });

                sfuConsumers.set(producerId, consumer);
                await socketRequest('sfu-resumeConsumer', { broadcastID, consumerId });

                // Update the viewer card
                const existingViewer = document.getElementById(viewerSocketId);
                const existingVideoEl = existingViewer ? existingViewer.querySelector('video') : null;
                const isActive = !producerPaused && !paused;

                if (existingVideoEl) {
                    const existingTracks = existingVideoEl.srcObject ? [...existingVideoEl.srcObject.getTracks()] : [];
                    existingTracks.push(consumer.track);
                    existingVideoEl.srcObject = new MediaStream(existingTracks);
                    existingVideoEl.poster = '';
                    existingVideoEl.play().catch(() => {});

                    if (kind === 'video') {
                        const videoOffEl = existingViewer.querySelector('img');
                        if (isActive) {
                            // Video is ON: show video, hide off image
                            existingVideoEl.classList.remove('hidden');
                            if (videoOffEl) videoOffEl.classList.add('hidden');
                        } else {
                            // Video is OFF: hide video, show off image
                            existingVideoEl.classList.add('hidden');
                            if (videoOffEl) videoOffEl.classList.remove('hidden');
                        }
                    }
                } else {
                    const stream = new MediaStream([consumer.track]);
                    addViewer(viewerSocketId, username, stream);
                }

                // Update audio/video button state to match producer paused state
                if (existingViewer) {
                    const baseId = `${viewerSocketId}___${username}`;
                    if (kind === 'audio') {
                        const audioBtn = document.getElementById(`${baseId}___viewerAudioStatus`);
                        if (audioBtn) {
                            isActive ? audioBtn.classList.remove('color-red') : audioBtn.classList.add('color-red');
                        }
                    }
                    if (kind === 'video') {
                        const videoBtn = document.getElementById(`${baseId}___viewerVideoStatus`);
                        if (videoBtn) {
                            isActive ? videoBtn.classList.remove('color-red') : videoBtn.classList.add('color-red');
                        }
                    }
                }
            } catch (err) {
                console.error('Error consuming existing viewer producer', { viewerSocketId, producerId, err });
            }
        }
    } catch (error) {
        console.error('Error fetching existing viewer producers', error);
    }
}

// SFU data messages through socket.io
socket.on('sfu-dataMessage', (data) => {
    if (broadcastingMode !== 'sfu') return;
    handleDataChannelMessage(data);
});

// Helper: promisify socket.emit with callback
function socketRequest(event, data) {
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
            appendMessage(data.action.username, data.action.message);
            if (isSpeechSynthesisSupported && broadcastSettings.options.speech_msg) {
                speechMessage(data.action.username, data.action.message);
            }
            // Relay viewer message to all other viewers (P2P public chat)
            if (broadcastingMode === 'p2p') {
                for (let id in dataChannels) {
                    if (id === socket.id || id === data.action.id) continue;
                    sendToViewersDataChannel('message', data.action, id);
                }
            }
            break;
        case 'audio':
            if (!data.action || !data.action.id) break;
            console.log('audio', { id: data.action.id, username: data.action.username, enabled: data.action.enabled });
            const viewerAudioStatus = document.getElementById(
                `${data.action.id}___${data.action.username}___viewerAudioStatus`
            );
            if (viewerAudioStatus) {
                data.action.enabled
                    ? viewerAudioStatus.classList.remove('color-red')
                    : viewerAudioStatus.classList.add('color-red');
            } else {
                console.warn(`Audio status element not found for viewer: ${data.action.id}, ${data.action.username}`);
            }
            break;
        case 'video':
            if (!data.action || !data.action.id) {
                // Broadcaster video status (visibility) messages don't have id
                if (data.action && 'visibility' in data.action) break;
                break;
            }
            const { id, username, enabled } = data.action;
            console.log('video', { id, username, enabled });

            const baseId = `${id}___${username}`;
            const viewerVideoStatus = document.getElementById(`${baseId}___viewerVideoStatus`);
            const viewerVideoElement = document.getElementById(`${baseId}___viewerVideo`);
            const viewerVideoElementOff = document.getElementById(`${baseId}___viewerVideoOff`);

            if (viewerVideoStatus && viewerVideoElement && viewerVideoElementOff) {
                viewerVideoStatus.classList.toggle('color-red', !enabled);
                viewerVideoElement.classList.toggle('hidden', !enabled);
                viewerVideoElementOff.classList.toggle('hidden', enabled);
                if (enabled) {
                    viewerVideoElement.play().catch(() => {});
                }
            } else {
                console.warn(`Elements not found for viewer with id: ${id}, username: ${username}`);
            }
            break;
        //...
        default:
            console.error('Data channel message not handled', data);
            break;
    }
}

function sendToViewersDataChannel(method, action = {}, peerId = '*') {
    if (broadcastingMode === 'sfu') {
        // SFU mode: send through socket.io
        socket.emit('sfu-dataMessage', {
            broadcastID,
            method,
            action,
            targetId: peerId,
        });
        return;
    }

    // P2P mode: send through WebRTC data channels
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
        if (!thereIsPeerConnections() || !dataChannels[id]) return;

        if (dataChannels[id].readyState !== 'open') {
            console.warn('DataChannel is not open. Current state:', dataChannels[id].readyState);
            return;
        }
        dataChannels[id].send(
            JSON.stringify({
                method: method,
                action: action,
            })
        );
    }
}

// =====================================================
// Handle element display
// =====================================================

elementDisplay(fullScreenOff, false);
elementDisplay(recordingLabel, false);
elementDisplay(recordingStop, false);
elementDisplay(screenShareStop, false);
elementDisplay(copyRoom, broadcastSettings.buttons.copyRoom);
elementDisplay(shareRoom, broadcastSettings.buttons.shareRoom);
elementDisplay(disableAudio, broadcastSettings.buttons.audio);
elementDisplay(enableAudio, broadcastSettings.buttons.audio && false);
elementDisplay(videoBtn, broadcastSettings.buttons.video);
elementDisplay(screenShareStart, broadcastSettings.buttons.screenShareStart);
elementDisplay(recordingStart, broadcastSettings.buttons.recordingStart);
elementDisplay(messagesOpenForm, broadcastSettings.buttons.messagesOpenForm);
elementDisplay(viewersOpenForm, broadcastSettings.buttons.viewersOpenForm);
elementDisplay(viewersHideVideo, broadcastSettings.options.show_viewers && viewerSettings.buttons.video);
elementDisplay(viewersMuteAudio, broadcastSettings.options.show_viewers && viewerSettings.buttons.audio);
elementDisplay(fullScreenOn, broadcastSettings.buttons.fullScreenOn && isFullScreenSupported());
elementDisplay(togglePIP, broadcastSettings.buttons.pictureInPicture && isPIPSupported());
elementDisplay(settingsBtn, broadcastSettings.options.settings);
elementDisplay(goHome, broadcastSettings.buttons.close);

if (broadcastSettings.options.start_full_screen) {
    broadcastForm.classList.remove(...broadcastForm.classList);
    broadcastForm.classList.add('full-screen');
    elementDisplay(broadcastFormHeader, false);
    elementDisplay(broadcastButtons, false);
    settingsForm.classList.remove('panel-open');
    settingsFormOpen = false;
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
toggleSettingsBtn.addEventListener('click', toggleSettings);

function toggleSettings() {
    settingsFormOpen = !settingsFormOpen;
    settingsForm.classList.toggle('panel-open', settingsFormOpen);
}

// =====================================================
// Handle video
// =====================================================

video.addEventListener('click', function () {
    toggleFullScreen(video);
});

video.addEventListener('wheel', function (e) {
    handleZoom(e, video);
});

function toggleFullScreen(video) {
    if (isMobileDevice) return;
    isFullScreen() ? goOutFullscreen() : goInFullscreen(video);
}

function handleZoom(e, video) {
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
// Handle audio
// =====================================================

enableAudio.addEventListener('click', () => toggleAudio(true));
disableAudio.addEventListener('click', () => toggleAudio(false));

function toggleAudio(enable) {
    const audioTrack = broadcastStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = enable;
    }
    elementDisplay(enableAudio, !enable);
    elementDisplay(disableAudio, enable && broadcastSettings.buttons.audio);
    sendToViewersDataChannel('audio', { enable });
    checkTrackAndPopup(broadcastStream);
}

// =====================================================
// Handle video stream
// =====================================================

videoBtn.addEventListener('click', toggleVideo);

function toggleVideo() {
    const color = dark ? 'white' : 'black';
    videoBtn.style.color = videoBtn.style.color == 'red' ? color : 'red';
    videoOff.style.visibility = videoBtn.style.color == 'red' ? 'visible' : 'hidden';
    broadcastStream.getVideoTracks()[0].enabled = !broadcastStream.getVideoTracks()[0].enabled;
    sendToViewersDataChannel('video', { visibility: videoOff.style.visibility });
    checkTrackAndPopup(broadcastStream);
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
            audioSelect
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
messageSend.addEventListener('click', sendBroadcasterMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendBroadcasterMessage();
});

function sendBroadcasterMessage() {
    if (!thereIsPeerConnections()) {
        return popupMessage('toast', 'Messages', "There isn't connected viewers", 'top');
    }
    if (messageInput.value.trim() === '') return;
    const message = messageInput.value;
    appendMessage(username, message, true);
    sendToViewersDataChannel('message', {
        id: socket.id,
        username: username,
        message: message,
        isBroadcaster: true,
    });
    messageInput.value = '';
}

function toggleMessagesForm() {
    messagesFormOpen = !messagesFormOpen;
    messagesForm.classList.toggle('panel-open', messagesFormOpen);
    if (viewersFormOpen) {
        viewersFormOpen = false;
        viewersForm.classList.remove('panel-open');
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

function appendMessage(username, message, isSelf = false) {
    playSound('message');
    const timeNow = getTime();
    const messageDiv = document.createElement('div');
    const messageTitle = document.createElement('span');
    messageTitle.innerHTML = `${timeNow} - ${isSelf ? `<span class="message-name-self">${username}</span>` : username}`;
    const messageText = document.createElement('p');
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

viewersMuteAudio.addEventListener('click', muteALLViewers);
viewersHideVideo.addEventListener('click', hideALLViewers);
viewersDisconnect.addEventListener('click', disconnectALLViewers);

function toggleViewersForm() {
    if (!viewersFormOpen && !thereIsPeerConnections()) {
        return popupMessage('toast', 'Viewers', "There isn't connected viewers", 'top');
    }
    viewersFormOpen = !viewersFormOpen;
    viewersForm.classList.toggle('panel-open', viewersFormOpen);
    if (messagesFormOpen) {
        messagesFormOpen = false;
        messagesForm.classList.remove('panel-open');
    }
}

function saveViewers() {
    if (thereIsPeerConnections()) {
        return saveAllViewers(connectedViewers);
    }
    popupMessage('toast', 'Viewers', "There isn't connected viewers", 'top');
}

function searchViewer() {
    const filter = viewerSearch.value.toUpperCase();
    const cards = viewersTable.querySelectorAll('.viewer-card');
    cards.forEach((card) => {
        const name = card.querySelector('.viewer-card-name');
        if (name) {
            const username = name.textContent || name.innerText;
            card.style.display = username.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
        }
    });
}

function addViewer(id, username, stream = null) {
    connectedViewers[id] = username;
    console.log('ConnectedViewers', { connected: username, connectedViewers: connectedViewers });

    const existing = document.getElementById(id);
    if (existing) viewersTable.removeChild(existing);

    const card = document.createElement('div');
    const cardHeader = document.createElement('div');
    const cardName = document.createElement('span');
    const cardBody = document.createElement('div');
    const cardFooter = document.createElement('div');
    const buttonAudio = document.createElement('button');
    const buttonVideo = document.createElement('button');
    const buttonDisconnect = document.createElement('button');
    const videoElement = document.createElement('video');
    const videoElementOff = document.createElement('img');

    card.id = id;
    card.className = 'viewer-card';
    cardHeader.className = 'viewer-card-header';
    cardName.className = 'viewer-card-name';
    cardBody.className = 'viewer-card-body';
    cardFooter.className = 'viewer-card-footer';

    cardName.innerText = username;
    cardHeader.appendChild(cardName);

    const { hasVideo, hasAudio } = hasVideoOrAudioTracks(stream);
    // In SFU mode, always create audio/video buttons (stream arrives later via sfu-viewerProducer)
    const sfuMode = broadcastingMode === 'sfu';
    const showAudio = hasAudio || sfuMode;
    const showVideo = hasVideo || sfuMode;

    Object.assign(videoElement, {
        id: `${id}___${username}___viewerVideo`,
        autoplay: true,
        controls: false,
        srcObject: stream,
        poster: images.poster,
    });

    Object.assign(videoElementOff, {
        id: `${id}___${username}___viewerVideoOff`,
        src: dark ? images.hide : images.hideLight,
    });

    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.cursor = 'pointer';
    videoElement.style.objectFit = 'cover';

    // In SFU mode with no stream yet, show "video off" image instead of loading poster
    if (sfuMode && !stream) {
        videoElement.classList.add('hidden');
        videoElementOff.classList.remove('hidden');
    } else {
        videoElementOff.classList.add('hidden');
    }

    cardBody.appendChild(videoElement);
    cardBody.appendChild(videoElementOff);

    if (showAudio) {
        Object.assign(buttonAudio, {
            id: `${id}___${username}___viewerAudioStatus`,
            className: 'viewer-card-btn color-red',
            title: 'Mute',
            innerHTML: '<i class="fas fa-microphone"></i>',
        });
        cardFooter.appendChild(buttonAudio);
    }

    if (showVideo) {
        Object.assign(buttonVideo, {
            id: `${id}___${username}___viewerVideoStatus`,
            className: 'viewer-card-btn color-red',
            title: 'Hide video',
            innerHTML: '<i class="fas fa-video"></i>',
        });
        cardFooter.appendChild(buttonVideo);

        if (hasVideo && stream.getVideoTracks()[0].enabled) {
            videoElement.classList.add('hidden');
            videoElementOff.classList.remove('hidden');
        }

        videoElement.addEventListener('click', function () {
            toggleFullScreen(videoElement);
        });
        videoElement.addEventListener('wheel', function (e) {
            handleZoom(e, videoElement);
        });
        videoElement.addEventListener('leavepictureinpicture', (event) => {
            console.log('Exited PiP mode');
            if (videoElement.paused) {
                videoElement.play().catch((error) => {
                    console.error('Error playing video after exit PIP mode', error);
                });
            }
        });
    }

    Object.assign(buttonDisconnect, {
        id: `${id}___${username}___disconnect`,
        className: 'viewer-card-btn viewer-card-btn-danger',
        title: 'Disconnect',
        innerHTML: '<i class="fas fa-plug"></i>',
    });
    cardFooter.appendChild(buttonDisconnect);

    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    card.appendChild(cardFooter);

    viewersTable.appendChild(card);

    handleAudioPeer(buttonAudio.id);
    handleDisconnectPeer(buttonDisconnect.id);
    handleVideoPeer(buttonVideo.id);
}

function handleVideoPeer(id) {
    const buttonAudio = document.getElementById(id);
    if (!buttonAudio) return;
    buttonAudio.addEventListener('click', () => {
        sendToViewersDataChannel('hide', {}, getPeerId(id));
    });
}

function handleAudioPeer(id) {
    const buttonVideo = document.getElementById(id);
    if (!buttonVideo) return;
    buttonVideo.addEventListener('click', () => {
        sendToViewersDataChannel('mute', {}, getPeerId(id));
    });
}

function handleDisconnectPeer(id) {
    const buttonDisconnect = document.getElementById(id);
    if (!buttonDisconnect) return;
    buttonDisconnect.addEventListener('click', () => {
        Swal.fire({
            allowOutsideClick: false,
            allowEscapeKey: false,
            showDenyButton: true,
            position: 'top',
            title: 'Disconnect',
            text: `Do you want to disconnect ${getPeerName(id)} ?`,
            confirmButtonText: `Yes`,
            denyButtonText: `No`,
            showClass: { popup: 'animate__animated animate__fadeInDown' },
            hideClass: { popup: 'animate__animated animate__fadeOutUp' },
        }).then((result) => {
            if (result.isConfirmed) {
                sendToViewersDataChannel('disconnect', {}, getPeerId(id));
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
    const card = document.getElementById(id);
    if (card) viewersTable.removeChild(card);
    if (!thereIsPeerConnections() && viewersFormOpen) toggleViewersForm();
}

function muteALLViewers() {
    if (!thereIsPeerConnections()) return;
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        showDenyButton: true,
        position: 'top',
        imageUrl: dark ? images.mute : images.muteLight,
        title: 'Mute all viewers',
        text: 'Do you want to mute all viewers microphone?',
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            sendToViewersDataChannel('mute');
        }
    });
}

function hideALLViewers() {
    if (!thereIsPeerConnections()) return;
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        showDenyButton: true,
        position: 'top',
        imageUrl: dark ? images.hide : images.hideLight,
        title: 'Hide all viewers',
        text: 'Do you want to hide all viewers camera?',
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            sendToViewersDataChannel('hide');
        }
    });
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

handleVideoPIPonExit();

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
    broadcastStream
        .getVideoTracks()[0]
        .applyConstraints(videoConstraints)
        .then(() => {
            logStreamSettingsInfo(broadcastStream);
            localStorage.videoQualitySelectedIndex = videoQualitySelect.selectedIndex;
            localStorage.videoFpsSelectedIndex = videoFpsSelect.selectedIndex;
        })
        .catch((error) => {
            console.error('setVideoQuality Error', error.name, error.message);
            videoQualitySelect.selectedIndex = localStorage.videoQualitySelectedIndex;
            videoFpsSelect.selectedIndex = localStorage.videoFpsSelectedIndex;
            popupMessage(
                'warning',
                'Video quality/fps',
                "Your device doesn't support the selected video quality and fps, please select the another one."
            );
        });
}

function getVideoConstraints() {
    const videoQuality = videoQualitySelect.value;
    const videoFrameRate = videoFpsSelect.value == 'default' ? 30 : parseInt(videoFpsSelect.value, 10);

    const qualityMap = {
        default: { width: { ideal: 1280 }, height: { ideal: 720 } },
        qvga: { width: { exact: 320 }, height: { exact: 240 } },
        vga: { width: { exact: 640 }, height: { exact: 480 } },
        hd: { width: { exact: 1280 }, height: { exact: 720 } },
        fhd: { width: { exact: 1920 }, height: { exact: 1080 } },
        '2k': { width: { exact: 2560 }, height: { exact: 1440 } },
        '4k': { width: { exact: 3840 }, height: { exact: 2160 } },
        '6k': { width: { exact: 6144 }, height: { exact: 3456 } },
        '8k': { width: { exact: 7680 }, height: { exact: 4320 } },
    };

    const videoConstraints = qualityMap[videoQuality] || {};
    videoConstraints.frameRate = { ideal: videoFrameRate };

    return videoConstraints;
}

// =====================================================
// Handle camera, microphone, screen
// =====================================================

audioSelect.onchange = getStream;
videoSelect.onchange = getStream;

getStream().then(getDevices).then(gotDevices);

function getStream() {
    try {
        videoOff.style.visibility = 'hidden';

        videoQualitySelect.selectedIndex = localStorage.videoQualitySelectedIndex
            ? localStorage.videoQualitySelectedIndex
            : 0;
        videoFpsSelect.selectedIndex = localStorage.videoFpsSelectedIndex ? localStorage.videoFpsSelectedIndex : 0;
        videoBtn.style.color = dark ? 'white' : 'black';

        const audioSource = audioSelect.value;
        const videoSource = videoSelect.value;

        const screenConstraints = { audio: true, video: true };
        const cameraConstraints = {
            audio: { deviceId: audioSource ? { exact: audioSource } : undefined },
            video: { deviceId: videoSource ? { exact: videoSource } : undefined },
        };
        const constraints = screenShareEnabled ? screenConstraints : cameraConstraints;

        if (screenShareEnabled) {
            stopVideoTrack(broadcastStream);

            video.classList.remove('mirror');
            isVideoMirrored = false;
            return navigator.mediaDevices
                .getDisplayMedia(constraints)
                .then(gotScreenStream)
                .then(applyVideoConstraints)
                .catch(handleMediaDeviceError);
        }

        if (isDesktopDevice && !isVideoMirrored) {
            video.className = 'mirror';
            isVideoMirrored = true;
        }

        stopTracks(broadcastStream);

        return navigator.mediaDevices
            .getUserMedia(constraints)
            .then(gotStream)
            .then(applyVideoConstraints)
            .catch(handleMediaDeviceError);
    } catch (error) {
        handleMediaDeviceError(error);
    }
}

function gotStream(stream) {
    if (!screenShareEnabled) {
        audioSelect.selectedIndex = [...audioSelect.options].findIndex(
            (option) => option.text === stream.getAudioTracks()[0].label
        );
        videoSelect.selectedIndex = [...videoSelect.options].findIndex(
            (option) => option.text === stream.getVideoTracks()[0].label
        );
    }
    attachStream(stream);

    if (broadcastingMode === 'sfu') {
        sfuStartBroadcast(stream);
    } else {
        socket.emit('broadcaster', broadcastID);
    }
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
    attachStream(newStream);

    if (broadcastingMode === 'sfu') {
        sfuStartBroadcast(newStream);
    } else {
        socket.emit('broadcaster', broadcastID);
    }
}

async function sfuStartBroadcast(stream) {
    try {
        if (!sfuDevice) {
            await sfuInitDevice(broadcastID);
        }
        if (!sfuSendTransport) {
            await sfuCreateSendTransport(broadcastID);
        }
        await sfuProduceStream(stream);
        socket.emit('broadcaster', broadcastID);
    } catch (error) {
        console.error('SFU broadcast error', error);
        popupMessage('warning', 'SFU Error', 'Failed to start SFU broadcast: ' + error.message);
    }
}

function sfuResetState() {
    // Close old transports to stop stale WebRTC traffic.
    // Track ending is fine since getStream() acquires fresh tracks.
    try {
        if (sfuSendTransport) sfuSendTransport.close();
    } catch (e) {}
    try {
        if (sfuRecvTransport) sfuRecvTransport.close();
    } catch (e) {}
    sfuDevice = null;
    sfuSendTransport = null;
    sfuRecvTransport = null;
    sfuRecvTransportPromise = null;
    sfuProducers = new Map();
    sfuConsumers = new Map();
    sfuViewerCount = 0;
    connectedPeers.innerText = 0;
    // Clear viewer cards — they'll be re-added via sfuExistingViewers
    for (const id in connectedViewers) {
        delViewer(id, connectedViewers[id]);
    }
}

function attachStream(stream) {
    broadcastStream = stream;
    video.srcObject = stream;
    video.playsInline = true;
    video.autoplay = true;
    video.muted = true;
    video.volume = 0;
    video.controls = false;
}

function handleMediaDeviceError(error) {
    console.error('Error', error);
    if (screenShareEnabled) {
        toggleScreen();
    } else {
        handleMediaStreamError(error);
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
    if (broadcastingMode === 'sfu') {
        // Close SFU resources
        for (const [, producer] of sfuProducers) {
            producer.close();
        }
        sfuProducers.clear();
        for (const [, consumer] of sfuConsumers) {
            consumer.close();
        }
        sfuConsumers.clear();
        if (sfuSendTransport) sfuSendTransport.close();
        if (sfuRecvTransport) sfuRecvTransport.close();
    } else if (thereIsPeerConnections()) {
        for (let id in peerConnections) {
            peerConnections[id].close();
        }
    }
    stopSessionTime();
    saveRecording();
    return undefined;
};
