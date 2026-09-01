'use strict';

/**
 * MiroTalk BRO - mediasoup SFU handler
 *
 * Manages mediasoup workers, routers, transports, producers and consumers
 * for SFU-based broadcasting as an alternative to the P2P mesh approach.
 */

const mediasoup = require('mediasoup');
const { spawn } = require('child_process');
const dgram = require('dgram');
const os = require('os');
const fs = require('fs');

const logs = require('./logs');
const log = new logs('mediasoup');

// mediasoup workers (one per CPU core)
const workers = [];
let nextWorkerIdx = 0;

// Room state: broadcastID -> { router, broadcasterSocketId, broadcasterTransport, producers, viewers }
const sfuRooms = {};
const rtmpReservations = new Set();

// =====================================================
// Network helpers
// =====================================================

const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || null;
const LISTEN_IP = process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const IS_DOCKER = fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv');

const PUBLIC_IP_SERVICES = ['https://api.ipify.org', 'https://ipinfo.io/ip', 'https://ifconfig.me/ip'];

async function getIPv4() {
    if (ANNOUNCED_IP) return ANNOUNCED_IP;

    switch (ENVIRONMENT) {
        case 'development':
            return IS_DOCKER ? '127.0.0.1' : getLocalIPv4();
        case 'production':
            return (await getPublicIPv4()) || getLocalIPv4();
        default:
            return getLocalIPv4();
    }
}

async function getPublicIPv4() {
    for (const url of PUBLIC_IP_SERVICES) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (response.ok) {
                const ip = (await response.text()).trim();
                if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
                    log.info('Public IP detected', { ip, source: url });
                    return ip;
                }
            }
        } catch (error) {
            log.warn('Public IP detection failed', { url, error: error.message });
        }
    }
    log.warn('All public IP detection services failed, falling back to local IP');
    return null;
}

function getLocalIPv4() {
    const ifaces = os.networkInterfaces();
    const platform = os.platform();

    const PRIORITY_CONFIG = {
        win32: [{ name: 'Ethernet' }, { name: 'Wi-Fi' }, { name: 'Local Area Connection' }],
        darwin: [{ name: 'en0' }, { name: 'en1' }],
        linux: [{ name: 'eth0' }, { name: 'wlan0' }],
    };

    const VIRTUAL_INTERFACES = {
        all: ['docker', 'veth', 'tun', 'lo'],
        win32: ['Virtual', 'vEthernet', 'Teredo', 'Bluetooth'],
        darwin: ['awdl', 'bridge', 'utun'],
        linux: ['virbr', 'kube', 'cni'],
    };

    const platformPriorities = PRIORITY_CONFIG[platform] || [];
    const virtualExcludes = [...VIRTUAL_INTERFACES.all, ...(VIRTUAL_INTERFACES[platform] || [])];

    for (const { name: ifName } of platformPriorities) {
        const matchingIfaces = platform === 'win32' ? Object.keys(ifaces).filter((k) => k.includes(ifName)) : [ifName];
        for (const interfaceName of matchingIfaces) {
            const addr = findValidAddress(ifaces[interfaceName]);
            if (addr) return addr;
        }
    }

    for (const [name, addresses] of Object.entries(ifaces)) {
        if (virtualExcludes.some((ex) => name.toLowerCase().includes(ex.toLowerCase()))) continue;
        const addr = findValidAddress(addresses);
        if (addr) return addr;
    }

    return '0.0.0.0';
}

function findValidAddress(addresses) {
    return addresses?.find((addr) => addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.'))
        ?.address;
}

// =====================================================
// mediasoup configuration
// =====================================================

const RTC_MIN_PORT = parseInt(process.env.MEDIASOUP_RTC_MIN_PORT) || 20000;
const RTC_MAX_PORT = parseInt(process.env.MEDIASOUP_RTC_MAX_PORT) || 20099;
const RTMP_SOURCE_URL = process.env.RTMP_SOURCE_URL || 'rtmp://127.0.0.1:1935';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const RTMP_VIDEO_BITRATE = process.env.RTMP_VIDEO_BITRATE || '1500k';
const RTMP_VIDEO_WIDTH = parseInt(process.env.RTMP_VIDEO_WIDTH) || 1280;
const RTMP_VIDEO_HEIGHT = parseInt(process.env.RTMP_VIDEO_HEIGHT) || 720;
const RTMP_VIDEO_FPS = parseInt(process.env.RTMP_VIDEO_FPS) || 30;
// libvpx VP8 encodes single-threaded unless told otherwise, which cannot sustain realtime at 720p.
const RTMP_VIDEO_THREADS = parseInt(process.env.RTMP_VIDEO_THREADS) || Math.min(4, os.cpus().length);
const RTMP_VIDEO_PAYLOAD_TYPE = 96;
const RTMP_AUDIO_PAYLOAD_TYPE = 111;
// MediaMTX accepts the publisher before the stream is ready, so the first FFmpeg
// attempts fail with "no stream is available" and are retried quietly.
const RTMP_BRIDGE_STARTUP_MS = 3000;
const RTMP_BRIDGE_RETRY_DELAY_MS = 500;
const RTMP_BRIDGE_MAX_ATTEMPTS = 20;
// Once media flowed, a few failed respawns mean the publisher really went away.
const RTMP_BRIDGE_MAX_RESTARTS = 5;

const config = {
    // Worker settings
    worker: {
        logLevel: process.env.MEDIASOUP_LOG_LEVEL || 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    },
    // Router media codecs
    router: {
        mediaCodecs: [
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
            },
            {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: {
                    'x-google-start-bitrate': 1000,
                },
            },
            {
                kind: 'video',
                mimeType: 'video/VP9',
                clockRate: 90000,
                parameters: {
                    'profile-id': 2,
                    'x-google-start-bitrate': 1000,
                },
            },
            {
                kind: 'video',
                mimeType: 'video/H264',
                clockRate: 90000,
                parameters: {
                    'packetization-mode': 1,
                    'profile-level-id': '4d0032',
                    'level-asymmetry-allowed': 1,
                    'x-google-start-bitrate': 1000,
                },
            },
            {
                kind: 'video',
                mimeType: 'video/H264',
                clockRate: 90000,
                parameters: {
                    'packetization-mode': 1,
                    'profile-level-id': '42e01f',
                    'level-asymmetry-allowed': 1,
                    'x-google-start-bitrate': 1000,
                },
            },
        ],
    },
    // WebRTC transport settings
    webRtcTransport: {
        listenInfos: [
            {
                protocol: 'udp',
                ip: LISTEN_IP,
                announcedAddress: null, // Resolved async in createWorkers()
                portRange: {
                    min: RTC_MIN_PORT,
                    max: RTC_MAX_PORT,
                },
            },
            {
                protocol: 'tcp',
                ip: LISTEN_IP,
                announcedAddress: null, // Resolved async in createWorkers()
                portRange: {
                    min: RTC_MIN_PORT,
                    max: RTC_MAX_PORT,
                },
            },
        ],
        initialAvailableOutgoingBitrate: 1000000,
        minimumAvailableOutgoingBitrate: 600000,
        maxIncomingBitrate: 1500000,
    },
};

// =====================================================
// Worker management
// =====================================================

async function createWorkers() {
    // Resolve announced IP (may require async public IP detection in production)
    const IPv4 = await getIPv4();
    for (const info of config.webRtcTransport.listenInfos) {
        info.announcedAddress = IPv4;
    }
    log.info('mediasoup network config', { LISTEN_IP, ANNOUNCED_IP: IPv4, IS_DOCKER, ENVIRONMENT });

    const numWorkers = Math.min(os.cpus().length, parseInt(process.env.MEDIASOUP_NUM_WORKERS) || os.cpus().length);

    log.info('Creating mediasoup workers', { count: numWorkers });

    for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker({
            logLevel: config.worker.logLevel,
            logTags: config.worker.logTags,
        });

        worker.on('died', () => {
            log.error('mediasoup Worker died, exiting in 2 seconds...', { pid: worker.pid });
            setTimeout(() => process.exit(1), 2000);
        });

        workers.push(worker);
        log.debug('mediasoup Worker created', { pid: worker.pid, index: i });
    }
}

function closeWorkers() {
    for (const broadcastID of Object.keys(sfuRooms)) {
        stopRtmpIngest(broadcastID);
    }
    for (const worker of workers) {
        if (!worker.closed) worker.close();
    }
    workers.length = 0;
}

function getNextWorker() {
    const worker = workers[nextWorkerIdx];
    nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
    return worker;
}

// =====================================================
// Room management
// =====================================================

async function getOrCreateRoom(broadcastID) {
    if (sfuRooms[broadcastID]) {
        return sfuRooms[broadcastID];
    }

    const worker = getNextWorker();
    const router = await worker.createRouter({ mediaCodecs: config.router.mediaCodecs });

    sfuRooms[broadcastID] = {
        router,
        broadcasterSocketId: null,
        broadcasterTransport: null,
        rtmpIngest: null,
        producers: new Map(), // producerId -> producer
        viewers: new Map(), // socketId -> { transport, consumers: Map<producerId, consumer>, username }
    };

    log.debug('Room created', { broadcastID, routerId: router.id });
    return sfuRooms[broadcastID];
}

function getRoom(broadcastID) {
    return sfuRooms[broadcastID] || null;
}

function deleteRoom(broadcastID) {
    const room = sfuRooms[broadcastID];
    if (room) {
        stopRtmpIngest(broadcastID);
        room.router.close();
        delete sfuRooms[broadcastID];
        log.debug('Room deleted', { broadcastID });
    }
}

// =====================================================
// RTMP ingest through FFmpeg and mediasoup PlainTransport
// =====================================================

function getRtmpBroadcastID(pathName) {
    if (typeof pathName !== 'string') return null;
    const match = /^live\/([A-Za-z0-9_-]{1,128})$/.exec(pathName);
    return match ? match[1] : null;
}

function canStartRtmpIngest(broadcastID) {
    const room = getRoom(broadcastID);
    return (
        !rtmpReservations.has(broadcastID) &&
        (!room || (!room.broadcasterTransport && !room.broadcasterSocketId && !room.rtmpIngest))
    );
}

function reserveRtmpIngest(pathName) {
    const broadcastID = getRtmpBroadcastID(pathName);
    if (!broadcastID) throw new Error('RTMP path must use live/<broadcastID>');
    if (!canStartRtmpIngest(broadcastID)) throw new Error(`Broadcast ${broadcastID} already has a source`);
    rtmpReservations.add(broadcastID);
    return broadcastID;
}

function isRtmpSourceActive(broadcastID) {
    return rtmpReservations.has(broadcastID) || Boolean(getRoom(broadcastID)?.rtmpIngest);
}

// Tells viewers whether the room is fed by an RTMP publisher, a browser broadcaster, or nothing yet.
function getRoomSourceType(broadcastID) {
    const room = getRoom(broadcastID);
    if (!room) return 'none';
    if (room.rtmpIngest) return 'rtmp';
    return room.broadcasterSocketId || room.broadcasterTransport ? 'browser' : 'none';
}

// Grabs a free ephemeral UDP port for FFmpeg to bind to.
function reserveUdpPort() {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4');
        socket.once('error', reject);
        socket.bind(0, '127.0.0.1', () => {
            const { port } = socket.address();
            socket.close(() => resolve(port));
        });
    });
}

async function createRtmpPlainProducer(room, kind, ssrc) {
    // FFmpeg cannot mux RTCP onto the RTP port, so RTCP gets its own mediasoup port
    // instead of leaking sender reports onto whatever listens on <rtpPort> + 1.
    const transport = await room.router.createPlainTransport({
        listenInfo: { protocol: 'udp', ip: '127.0.0.1' },
        rtcpListenInfo: { protocol: 'udp', ip: '127.0.0.1' },
        rtcpMux: false,
        comedia: true,
    });

    const isVideo = kind === 'video';
    const codec = isVideo
        ? {
              mimeType: 'video/VP8',
              payloadType: RTMP_VIDEO_PAYLOAD_TYPE,
              clockRate: 90000,
              parameters: {},
              rtcpFeedback: [],
          }
        : {
              mimeType: 'audio/opus',
              payloadType: RTMP_AUDIO_PAYLOAD_TYPE,
              clockRate: 48000,
              channels: 2,
              parameters: { useinbandfec: 1 },
              rtcpFeedback: [],
          };

    const producer = await transport.produce({
        kind,
        rtpParameters: {
            codecs: [codec],
            headerExtensions: [],
            encodings: [{ ssrc }],
            rtcp: { cname: `rtmp-${kind}-${ssrc}`, reducedSize: true },
        },
        appData: { source: 'rtmp' },
    });

    room.producers.set(producer.id, producer);
    producer.on('transportclose', () => room.producers.delete(producer.id));

    // comedia locks onto the first source address it sees, so FFmpeg must keep the
    // same local ports across respawns or its packets get discarded.
    const localRtpPort = await reserveUdpPort();
    const localRtcpPort = await reserveUdpPort();

    return {
        transport,
        producer,
        url:
            `rtp://127.0.0.1:${transport.tuple.localPort}` +
            `?rtcpport=${transport.rtcpTuple.localPort}` +
            `&localrtpport=${localRtpPort}&localrtcpport=${localRtcpPort}&pkt_size=1200`,
    };
}

function buildRtmpFfmpegArgs(inputUrl, video, audio, videoSsrc, audioSsrc) {
    return [
        '-hide_banner',
        '-loglevel',
        'warning',
        '-nostdin',
        '-i',
        inputUrl,
        '-map',
        '0:v:0',
        '-an',
        '-vf',
        `scale=${RTMP_VIDEO_WIDTH}:${RTMP_VIDEO_HEIGHT}:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=${RTMP_VIDEO_FPS}`,
        '-c:v',
        'libvpx',
        '-deadline',
        'realtime',
        '-cpu-used',
        '8',
        '-threads',
        String(RTMP_VIDEO_THREADS),
        '-b:v',
        RTMP_VIDEO_BITRATE,
        '-maxrate',
        RTMP_VIDEO_BITRATE,
        '-bufsize',
        RTMP_VIDEO_BITRATE,
        '-g',
        '60',
        '-payload_type',
        String(RTMP_VIDEO_PAYLOAD_TYPE),
        '-ssrc',
        String(videoSsrc),
        '-f',
        'rtp',
        video.url,
        '-map',
        '0:a:0',
        '-vn',
        '-c:a',
        'libopus',
        '-b:a',
        '64k',
        '-ar',
        '48000',
        '-ac',
        '2',
        '-payload_type',
        String(RTMP_AUDIO_PAYLOAD_TYPE),
        '-ssrc',
        String(audioSsrc),
        '-f',
        'rtp',
        audio.url,
    ];
}

function runRtmpBridge(broadcastID, ingest, args, onExit) {
    if (ingest.stopping) return;

    ingest.attempts++;
    const startedAt = Date.now();
    const isStartingUp = () => Date.now() - startedAt < RTMP_BRIDGE_STARTUP_MS;
    const ffmpegProcess = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    ingest.process = ffmpegProcess;

    ffmpegProcess.stderr.on('data', (data) => {
        const message = data
            .toString()
            .trim()
            .replace(/([?&]token=)[^&\s]+/g, '$1[REDACTED]');
        ingest.lastError = message;
        log[isStartingUp() ? 'debug' : 'warn']('RTMP FFmpeg', { broadcastID, message });
    });
    ffmpegProcess.on('error', (error) => {
        ingest.lastError = error.message;
        // A missing binary never fixes itself, so skip the retry loop.
        if (error.code === 'ENOENT') ingest.unrecoverable = true;
        log.error('RTMP FFmpeg failed to spawn', { broadcastID, ffmpegPath: FFMPEG_PATH, error: error.message });
    });
    ffmpegProcess.on('close', (code, signal) => {
        if (ingest.stopping || ingest.process !== ffmpegProcess) return;

        // MediaMTX only authenticates the publisher once, so a bridge that dies mid-stream
        // must respawn itself; the publisher is usually still connected.
        if (!isStartingUp()) {
            log.warn('RTMP FFmpeg bridge died mid-stream, restarting', {
                broadcastID,
                code,
                signal,
                lastError: ingest.lastError,
            });
            ingest.attempts = 0;
        }

        const maxAttempts = ingest.everRan ? RTMP_BRIDGE_MAX_RESTARTS : RTMP_BRIDGE_MAX_ATTEMPTS;
        if (!ingest.unrecoverable && ingest.attempts < maxAttempts) {
            log.debug('Retrying RTMP FFmpeg bridge', { broadcastID, attempt: ingest.attempts + 1 });
            ingest.retryTimer = setTimeout(
                () => runRtmpBridge(broadcastID, ingest, args, onExit),
                RTMP_BRIDGE_RETRY_DELAY_MS
            );
            return;
        }

        onExit(code, signal);
    });

    // Surviving the startup window means MediaMTX is really feeding us media.
    ingest.runningTimer = setTimeout(() => {
        if (ingest.process === ffmpegProcess) ingest.everRan = true;
    }, RTMP_BRIDGE_STARTUP_MS);

    log.debug('RTMP FFmpeg bridge started', { broadcastID, attempt: ingest.attempts, pid: ffmpegProcess.pid });
}

async function startRtmpIngest(pathName, token, io, broadcasters, viewers) {
    const broadcastID = getRtmpBroadcastID(pathName);

    const room = await getOrCreateRoom(broadcastID);
    if (room.rtmpIngest) return;

    const videoSsrc = Math.floor(Math.random() * 0x3fffffff) + 1;
    const audioSsrc = Math.floor(Math.random() * 0x3fffffff) + 0x40000000;
    let video;
    let audio;

    try {
        video = await createRtmpPlainProducer(room, 'video', videoSsrc);
        audio = await createRtmpPlainProducer(room, 'audio', audioSsrc);

        const separator = RTMP_SOURCE_URL.includes('?') ? '&' : '?';
        const inputUrl = `${RTMP_SOURCE_URL}/${pathName}${separator}token=${encodeURIComponent(token)}`;
        const args = buildRtmpFfmpegArgs(inputUrl, video, audio, videoSsrc, audioSsrc);
        const ingest = {
            process: null,
            retryTimer: null,
            runningTimer: null,
            attempts: 0,
            lastError: null,
            unrecoverable: false,
            everRan: false,
            video,
            audio,
            stopping: false,
        };
        room.rtmpIngest = ingest;
        rtmpReservations.delete(broadcastID);
        broadcasters[broadcastID] = `rtmp:${broadcastID}`;

        runRtmpBridge(broadcastID, ingest, args, (code, signal) => {
            log.info('RTMP ingest stopped', { broadcastID, code, signal, lastError: ingest.lastError });
            stopRtmpIngest(broadcastID);
            delete broadcasters[broadcastID];
            for (const [viewerSocketId] of room.viewers) {
                io.to(viewerSocketId).emit('broadcasterDisconnect');
                delete viewers[viewerSocketId];
            }
            deleteRoom(broadcastID);
        });

        for (const { producer } of [video, audio]) {
            for (const [viewerSocketId] of room.viewers) {
                io.to(viewerSocketId).emit('sfu-newProducer', {
                    producerId: producer.id,
                    kind: producer.kind,
                    source: 'rtmp',
                });
            }
        }

        log.info('RTMP ingest started', { broadcastID, pathName });
    } catch (error) {
        if (video) video.transport.close();
        if (audio) audio.transport.close();
        room.rtmpIngest = null;
        rtmpReservations.delete(broadcastID);
        throw error;
    }
}

function stopRtmpIngest(broadcastID) {
    const room = getRoom(broadcastID);
    const ingest = room?.rtmpIngest;
    if (!ingest) return;

    ingest.stopping = true;
    room.rtmpIngest = null;
    if (ingest.retryTimer) clearTimeout(ingest.retryTimer);
    if (ingest.runningTimer) clearTimeout(ingest.runningTimer);
    if (ingest.process && ingest.process.exitCode === null) ingest.process.kill('SIGTERM');
    ingest.video.transport.close();
    ingest.audio.transport.close();
    log.debug('RTMP ingest resources closed', { broadcastID });
}

// =====================================================
// Transport creation
// =====================================================

async function createWebRtcTransport(broadcastID) {
    const room = getRoom(broadcastID);
    if (!room) throw new Error(`Room ${broadcastID} does not exist`);

    const transport = await room.router.createWebRtcTransport({
        listenInfos: config.webRtcTransport.listenInfos,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: config.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    if (config.webRtcTransport.maxIncomingBitrate) {
        try {
            await transport.setMaxIncomingBitrate(config.webRtcTransport.maxIncomingBitrate);
        } catch (error) {
            log.warn('setMaxIncomingBitrate error', error.message);
        }
    }

    transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed') {
            log.debug('Transport closed', { transportId: transport.id });
            transport.close();
        }
    });

    transport.on('@close', () => {
        log.debug('Transport @close', { transportId: transport.id });
    });

    return {
        transport,
        params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters,
        },
    };
}

// =====================================================
// Socket event handlers for SFU mode
// =====================================================

function handleSfuConnection(socket, io, broadcasters, viewers) {
    // Get RTP capabilities for the room
    socket.on('sfu-getRtpCapabilities', async (broadcastID, callback) => {
        try {
            const room = await getOrCreateRoom(broadcastID);
            callback({ rtpCapabilities: room.router.rtpCapabilities });
            log.debug('sfu-getRtpCapabilities', { broadcastID });
        } catch (error) {
            log.error('sfu-getRtpCapabilities error', error.message);
            callback({ error: error.message });
        }
    });

    // Broadcaster creates a send transport
    socket.on('sfu-createBroadcasterTransport', async (broadcastID, callback) => {
        try {
            const room = await getOrCreateRoom(broadcastID);
            if (isRtmpSourceActive(broadcastID)) throw new Error('This broadcast is using an RTMP source');

            // Cancel any pending broadcaster disconnect timer (browser refresh)
            if (broadcasterDisconnectTimers[broadcastID]) {
                clearTimeout(broadcasterDisconnectTimers[broadcastID]);
                delete broadcasterDisconnectTimers[broadcastID];
                log.debug('Cancelled broadcaster disconnect timer (reconnect)', { broadcastID });
            }

            // If broadcaster is reconnecting, close old send transport cleanly
            if (room.broadcasterTransport) {
                try {
                    room.broadcasterTransport.close();
                } catch (e) {
                    log.warn('Error closing old broadcaster transport', e.message);
                }
                // Old producers will be cleaned up by transportclose events
            }

            // Clean up old broadcaster's viewer entry (recv transport) if socket id changed
            if (room.broadcasterSocketId && room.broadcasterSocketId !== socket.id) {
                const oldViewer = room.viewers.get(room.broadcasterSocketId);
                if (oldViewer) {
                    try {
                        if (oldViewer.recvTransport) oldViewer.recvTransport.close();
                    } catch (e) {}
                    try {
                        if (oldViewer.sendTransport) oldViewer.sendTransport.close();
                    } catch (e) {}
                    room.viewers.delete(room.broadcasterSocketId);
                }
                // Also clean up broadcaster consumers
                if (room.broadcasterConsumers) {
                    for (const [, consumer] of room.broadcasterConsumers) {
                        try {
                            consumer.close();
                        } catch (e) {}
                    }
                    room.broadcasterConsumers = new Map();
                }
            }

            const { transport, params } = await createWebRtcTransport(broadcastID);
            room.broadcasterTransport = transport;
            room.broadcasterSocketId = socket.id;
            broadcasters[broadcastID] = socket.id;

            log.debug('sfu-createBroadcasterTransport', { broadcastID, transportId: transport.id });
            callback(params);
        } catch (error) {
            log.error('sfu-createBroadcasterTransport error', error.message);
            callback({ error: error.message });
        }
    });

    // Connect broadcaster transport
    socket.on('sfu-connectBroadcasterTransport', async ({ broadcastID, dtlsParameters }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room || !room.broadcasterTransport) throw new Error('No broadcaster transport');
            await room.broadcasterTransport.connect({ dtlsParameters });
            log.debug('sfu-connectBroadcasterTransport', { broadcastID });
            callback({ connected: true });
        } catch (error) {
            log.error('sfu-connectBroadcasterTransport error', error.message);
            callback({ error: error.message });
        }
    });

    // Broadcaster produces a track
    socket.on('sfu-produce', async ({ broadcastID, kind, rtpParameters, appData }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room || !room.broadcasterTransport) throw new Error('No broadcaster transport');

            const producer = await room.broadcasterTransport.produce({
                kind,
                rtpParameters,
                appData,
            });

            room.producers.set(producer.id, producer);

            producer.on('transportclose', () => {
                log.debug('Producer transport closed', { producerId: producer.id });
                room.producers.delete(producer.id);
            });

            log.debug('sfu-produce', { broadcastID, producerId: producer.id, kind });

            // Notify all existing viewers about the new producer
            for (const [viewerSocketId, viewerData] of room.viewers) {
                io.to(viewerSocketId).emit('sfu-newProducer', {
                    producerId: producer.id,
                    kind: producer.kind,
                    source: producer.appData.source || 'browser',
                });
            }

            callback({ producerId: producer.id });
        } catch (error) {
            log.error('sfu-produce error', error.message);
            callback({ error: error.message });
        }
    });

    // Viewer creates a receive transport
    socket.on('sfu-createViewerTransport', async ({ broadcastID, username }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error(`Room ${broadcastID} does not exist`);

            const { transport, params } = await createWebRtcTransport(broadcastID);

            // Store viewer data
            if (!room.viewers.has(socket.id)) {
                room.viewers.set(socket.id, {
                    recvTransport: null,
                    sendTransport: null,
                    consumers: new Map(),
                    producers: new Map(),
                    username: username,
                });
            }
            const viewer = room.viewers.get(socket.id);
            viewer.recvTransport = transport;

            // Track viewer in global viewers map (skip broadcaster — it's tracked in broadcasters)
            if (socket.id !== room.broadcasterSocketId) {
                if (!(socket.id in viewers)) viewers[socket.id] = {};
                viewers[socket.id]['broadcastID'] = broadcastID;
                viewers[socket.id]['username'] = username;
            }

            log.debug('sfu-createViewerTransport', { broadcastID, socketId: socket.id, transportId: transport.id });
            callback(params);
        } catch (error) {
            log.error('sfu-createViewerTransport error', error.message);
            callback({ error: error.message });
        }
    });

    // Viewer creates a send transport (for audio/video back to broadcaster)
    socket.on('sfu-createViewerSendTransport', async ({ broadcastID }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error(`Room ${broadcastID} does not exist`);

            const { transport, params } = await createWebRtcTransport(broadcastID);

            // Lazily register viewer if not yet present (race with sfu-createViewerTransport)
            if (!room.viewers.has(socket.id)) {
                room.viewers.set(socket.id, {
                    recvTransport: null,
                    sendTransport: null,
                    consumers: new Map(),
                    producers: new Map(),
                    username: '',
                });
            }
            const viewer = room.viewers.get(socket.id);
            viewer.sendTransport = transport;

            log.debug('sfu-createViewerSendTransport', { broadcastID, socketId: socket.id, transportId: transport.id });
            callback(params);
        } catch (error) {
            log.error('sfu-createViewerSendTransport error', error.message);
            callback({ error: error.message });
        }
    });

    socket.on('sfu-closeViewerSendTransport', ({ broadcastID }) => {
        const viewer = getRoom(broadcastID)?.viewers.get(socket.id);
        if (!viewer?.sendTransport) return;
        viewer.sendTransport.close();
        viewer.sendTransport = null;
        viewer.producers.clear();
        log.debug('sfu-closeViewerSendTransport', { broadcastID, socketId: socket.id });
    });

    // Connect viewer receive transport
    socket.on('sfu-connectViewerTransport', async ({ broadcastID, dtlsParameters }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error('Room not found');
            const viewer = room.viewers.get(socket.id);
            if (!viewer || !viewer.recvTransport) throw new Error('No viewer transport');
            await viewer.recvTransport.connect({ dtlsParameters });
            log.debug('sfu-connectViewerTransport', { broadcastID, socketId: socket.id });
            callback({ connected: true });
        } catch (error) {
            // Tolerate duplicate connect calls (race between concurrent consumers)
            if (error.message && error.message.includes('connect() already called')) {
                log.debug('sfu-connectViewerTransport already connected', { broadcastID, socketId: socket.id });
                callback({ connected: true });
                return;
            }
            log.error('sfu-connectViewerTransport error', error.message);
            callback({ error: error.message });
        }
    });

    // Connect viewer send transport
    socket.on('sfu-connectViewerSendTransport', async ({ broadcastID, dtlsParameters }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error('Room not found');
            const viewer = room.viewers.get(socket.id);
            if (!viewer || !viewer.sendTransport) throw new Error('No viewer send transport');
            await viewer.sendTransport.connect({ dtlsParameters });
            log.debug('sfu-connectViewerSendTransport', { broadcastID, socketId: socket.id });
            callback({ connected: true });
        } catch (error) {
            // Tolerate duplicate connect calls (race between concurrent producers)
            if (error.message && error.message.includes('connect() already called')) {
                log.debug('sfu-connectViewerSendTransport already connected', { broadcastID, socketId: socket.id });
                callback({ connected: true });
                return;
            }
            log.error('sfu-connectViewerSendTransport error', error.message);
            callback({ error: error.message });
        }
    });

    // Viewer produces (sends audio/video to SFU for broadcaster to see)
    socket.on('sfu-viewerProduce', async ({ broadcastID, kind, rtpParameters, appData }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error('Room not found');
            const viewer = room.viewers.get(socket.id);
            if (!viewer || !viewer.sendTransport) throw new Error('No viewer send transport');

            const producer = await viewer.sendTransport.produce({ kind, rtpParameters, appData });
            viewer.producers.set(producer.id, producer);

            producer.on('transportclose', () => {
                viewer.producers.delete(producer.id);
            });

            // Notify broadcaster about viewer's stream
            if (room.broadcasterSocketId) {
                io.to(room.broadcasterSocketId).emit('sfu-viewerProducer', {
                    viewerSocketId: socket.id,
                    producerId: producer.id,
                    kind: producer.kind,
                    username: viewer.username,
                });
            }

            log.debug('sfu-viewerProduce', { broadcastID, socketId: socket.id, producerId: producer.id, kind });
            callback({ producerId: producer.id });
        } catch (error) {
            log.error('sfu-viewerProduce error', error.message);
            callback({ error: error.message });
        }
    });

    // Consume a producer (viewer subscribes to broadcaster's stream)
    socket.on('sfu-consume', async ({ broadcastID, producerId, rtpCapabilities }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error('Room not found');

            if (!room.router.canConsume({ producerId, rtpCapabilities })) {
                throw new Error('Cannot consume this producer');
            }

            const viewer = room.viewers.get(socket.id);
            if (!viewer || !viewer.recvTransport) throw new Error('No viewer transport');

            const consumer = await viewer.recvTransport.consume({
                producerId,
                rtpCapabilities,
                paused: false, // Start unpaused so media flows immediately
            });

            viewer.consumers.set(producerId, consumer);

            consumer.on('transportclose', () => {
                viewer.consumers.delete(producerId);
            });

            consumer.on('producerclose', () => {
                viewer.consumers.delete(producerId);
                io.to(socket.id).emit('sfu-producerClosed', { producerId });
            });

            log.debug('sfu-consume', { broadcastID, socketId: socket.id, producerId, consumerId: consumer.id });

            callback({
                consumerId: consumer.id,
                producerId: producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                producerPaused: consumer.producerPaused,
            });
        } catch (error) {
            log.error('sfu-consume error', error.message);
            callback({ error: error.message });
        }
    });

    // Broadcaster consumes viewer's stream
    socket.on('sfu-broadcasterConsume', async ({ broadcastID, producerId, rtpCapabilities }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error('Room not found');

            // Use the broadcaster's recv transport (created via sfu-createViewerTransport)
            const broadcasterViewer = room.viewers.get(socket.id);
            const recvTransport = broadcasterViewer ? broadcasterViewer.recvTransport : null;
            if (!recvTransport) throw new Error('No broadcaster recv transport - create one first');

            if (!room.router.canConsume({ producerId, rtpCapabilities })) {
                throw new Error('Cannot consume this producer');
            }

            const consumer = await recvTransport.consume({
                producerId,
                rtpCapabilities,
                paused: false,
            });

            if (!room.broadcasterConsumers) room.broadcasterConsumers = new Map();
            room.broadcasterConsumers.set(producerId, consumer);

            consumer.on('transportclose', () => {
                room.broadcasterConsumers.delete(producerId);
            });

            consumer.on('producerclose', () => {
                room.broadcasterConsumers.delete(producerId);
                io.to(room.broadcasterSocketId).emit('sfu-producerClosed', { producerId });
            });

            callback({
                consumerId: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                producerPaused: consumer.producerPaused,
            });
        } catch (error) {
            log.error('sfu-broadcasterConsume error', error.message);
            callback({ error: error.message });
        }
    });

    // Connect broadcaster recv transport
    socket.on('sfu-connectBroadcasterRecvTransport', async ({ broadcastID, dtlsParameters }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room || !room.broadcasterRecvTransport) throw new Error('No broadcaster recv transport');
            await room.broadcasterRecvTransport.connect({ dtlsParameters });
            callback({ connected: true });
        } catch (error) {
            log.error('sfu-connectBroadcasterRecvTransport error', error.message);
            callback({ error: error.message });
        }
    });

    // Resume consumer
    socket.on('sfu-resumeConsumer', async ({ broadcastID, consumerId }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error('Room not found');

            let consumer = null;

            // Check if it's a viewer consumer
            const viewer = room.viewers.get(socket.id);
            if (viewer) {
                for (const [, c] of viewer.consumers) {
                    if (c.id === consumerId) {
                        consumer = c;
                        break;
                    }
                }
            }

            // Check if it's a broadcaster consumer
            if (!consumer && room.broadcasterConsumers) {
                for (const [, c] of room.broadcasterConsumers) {
                    if (c.id === consumerId) {
                        consumer = c;
                        break;
                    }
                }
            }

            if (!consumer) {
                // Consumer may have been closed by producerclose/transportclose between
                // the consume call and this resume call — this is a benign race condition.
                log.debug('sfu-resumeConsumer consumer already gone', { consumerId });
                callback({ resumed: true });
                return;
            }

            await consumer.resume();
            log.debug('sfu-resumeConsumer', { consumerId });
            callback({ resumed: true });
        } catch (error) {
            log.error('sfu-resumeConsumer error', error.message);
            callback({ error: error.message });
        }
    });

    // Let a viewer know the source type before it asks for camera/mic permission
    socket.on('sfu-getSourceType', (broadcastID, callback) => {
        callback({ sourceType: getRoomSourceType(broadcastID) });
    });

    // Get current producers (for viewer joining an existing broadcast)
    socket.on('sfu-getProducers', (broadcastID, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) {
                callback({ producers: [], sourceType: 'none' });
                return;
            }
            const producers = [];
            for (const [producerId, producer] of room.producers) {
                producers.push({ producerId, kind: producer.kind, source: producer.appData.source || 'browser' });
            }
            log.debug('sfu-getProducers', { broadcastID, count: producers.length });
            callback({ producers, sourceType: getRoomSourceType(broadcastID) });
        } catch (error) {
            log.error('sfu-getProducers error', error.message);
            callback({ error: error.message });
        }
    });

    // Get existing viewer producers (for broadcaster reconnect)
    socket.on('sfu-getViewerProducers', (broadcastID, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) {
                callback({ viewerProducers: [] });
                return;
            }
            const viewerProducers = [];
            for (const [viewerSocketId, viewerData] of room.viewers) {
                if (viewerSocketId === socket.id) continue; // skip broadcaster's own viewer entry
                for (const [producerId, producer] of viewerData.producers) {
                    viewerProducers.push({
                        viewerSocketId,
                        producerId,
                        kind: producer.kind,
                        username: viewerData.username,
                        paused: producer.paused,
                    });
                }
            }
            log.debug('sfu-getViewerProducers', { broadcastID, count: viewerProducers.length });
            callback({ viewerProducers });
        } catch (error) {
            log.error('sfu-getViewerProducers error', error.message);
            callback({ error: error.message });
        }
    });

    // Data channel messages through socket.io (SFU mode replacement for WebRTC data channels)
    socket.on('sfu-dataMessage', ({ broadcastID, method, action, targetId }) => {
        const room = getRoom(broadcastID);
        if (!room) return;

        const message = { method, action };

        if (targetId && targetId !== '*') {
            // Send to specific peer
            io.to(targetId).emit('sfu-dataMessage', message);
        } else if (socket.id === room.broadcasterSocketId) {
            // Broadcaster -> all viewers (exclude broadcaster's own viewer entry)
            for (const [viewerSocketId] of room.viewers) {
                if (viewerSocketId !== socket.id) {
                    io.to(viewerSocketId).emit('sfu-dataMessage', message);
                }
            }
        } else {
            // Viewer -> broadcaster + all other viewers (public chat)
            if (method === 'message') {
                if (room.broadcasterSocketId) {
                    io.to(room.broadcasterSocketId).emit('sfu-dataMessage', message);
                }
                for (const [viewerSocketId] of room.viewers) {
                    if (viewerSocketId !== socket.id && viewerSocketId !== room.broadcasterSocketId) {
                        io.to(viewerSocketId).emit('sfu-dataMessage', message);
                    }
                }
            } else {
                // Other viewer data (audio/video status) -> broadcaster only
                if (room.broadcasterSocketId) {
                    io.to(room.broadcasterSocketId).emit('sfu-dataMessage', message);
                }
            }
        }
    });

    // Pause/resume producer
    socket.on('sfu-pauseProducer', async ({ broadcastID, producerId }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error('Room not found');
            const producer = findProducer(room, producerId);
            if (producer) {
                await producer.pause();
                callback({ paused: true });
            } else {
                callback({ error: 'Producer not found' });
            }
        } catch (error) {
            callback({ error: error.message });
        }
    });

    socket.on('sfu-resumeProducer', async ({ broadcastID, producerId }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error('Room not found');
            const producer = findProducer(room, producerId);
            if (producer) {
                await producer.resume();
                callback({ resumed: true });
            } else {
                callback({ error: 'Producer not found' });
            }
        } catch (error) {
            callback({ error: error.message });
        }
    });

    // Set preferred layers on a consumer (viewer quality selector)
    socket.on('sfu-setPreferredLayers', async ({ broadcastID, consumerId, spatialLayer, temporalLayer }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room) throw new Error('Room not found');

            let consumer = null;
            const viewer = room.viewers.get(socket.id);
            if (viewer) {
                for (const [, c] of viewer.consumers) {
                    if (c.id === consumerId) {
                        consumer = c;
                        break;
                    }
                }
            }

            if (!consumer) throw new Error('Consumer not found');

            const layers = { spatialLayer };
            if (typeof temporalLayer === 'number') layers.temporalLayer = temporalLayer;
            await consumer.setPreferredLayers(layers);
            log.debug('sfu-setPreferredLayers', { consumerId, spatialLayer, temporalLayer });
            callback({ ok: true });
        } catch (error) {
            log.error('sfu-setPreferredLayers error', error.message);
            callback({ error: error.message });
        }
    });

    // Replace track / update producer
    socket.on('sfu-replaceProducer', async ({ broadcastID, producerId, kind, rtpParameters, appData }, callback) => {
        try {
            const room = getRoom(broadcastID);
            if (!room || !room.broadcasterTransport) throw new Error('Room/transport not found');

            // Close old producer
            const oldProducer = room.producers.get(producerId);
            if (oldProducer) {
                oldProducer.close();
                room.producers.delete(producerId);
            }

            // Create new producer
            const newProducer = await room.broadcasterTransport.produce({ kind, rtpParameters, appData });
            room.producers.set(newProducer.id, newProducer);

            newProducer.on('transportclose', () => {
                room.producers.delete(newProducer.id);
            });

            // Notify viewers
            for (const [viewerSocketId] of room.viewers) {
                io.to(viewerSocketId).emit('sfu-producerReplaced', {
                    oldProducerId: producerId,
                    newProducerId: newProducer.id,
                    kind: newProducer.kind,
                });
            }

            callback({ producerId: newProducer.id });
        } catch (error) {
            log.error('sfu-replaceProducer error', error.message);
            callback({ error: error.message });
        }
    });
}

// =====================================================
// Helper: find a producer in broadcaster or viewer producers
// =====================================================

function findProducer(room, producerId) {
    // Check broadcaster producers
    const bp = room.producers.get(producerId);
    if (bp) return bp;
    // Check viewer producers
    for (const [, viewer] of room.viewers) {
        const vp = viewer.producers.get(producerId);
        if (vp) return vp;
    }
    return null;
}

// =====================================================
// Broadcaster disconnect grace period (handles browser refresh)
// =====================================================

const broadcasterDisconnectTimers = {};
const BROADCASTER_GRACE_PERIOD_MS = 5000; // 5 seconds for page reload

// =====================================================
// Handle SFU disconnect
// =====================================================

function handleSfuDisconnect(socket, broadcasters, viewers, io) {
    // Find which rooms this socket belongs to
    for (const [broadcastID, room] of Object.entries(sfuRooms)) {
        // If broadcaster disconnected
        if (room.broadcasterSocketId === socket.id) {
            log.debug('SFU broadcaster disconnected (starting grace period)', { broadcastID, socketId: socket.id });

            // Clear any existing timer for this room
            if (broadcasterDisconnectTimers[broadcastID]) {
                clearTimeout(broadcasterDisconnectTimers[broadcastID]);
            }

            // Delay room destruction to allow for page refresh reconnect
            broadcasterDisconnectTimers[broadcastID] = setTimeout(() => {
                delete broadcasterDisconnectTimers[broadcastID];

                // Re-check: if broadcaster reconnected with a new socket, skip cleanup
                const currentRoom = sfuRooms[broadcastID];
                if (!currentRoom || currentRoom.broadcasterSocketId !== socket.id) {
                    log.debug('SFU broadcaster reconnected during grace period, skipping cleanup', { broadcastID });
                    return;
                }

                log.debug('SFU broadcaster grace period expired, cleaning up', { broadcastID });

                // Notify all viewers and clean them from the global viewers object
                for (const [viewerSocketId] of currentRoom.viewers) {
                    io.to(viewerSocketId).emit('broadcasterDisconnect');
                    delete viewers[viewerSocketId];
                }

                // Clean up
                delete broadcasters[broadcastID];
                deleteRoom(broadcastID);
            }, BROADCASTER_GRACE_PERIOD_MS);

            return true;
        }

        // If viewer disconnected
        if (room.viewers.has(socket.id)) {
            const viewer = room.viewers.get(socket.id);

            // Close all consumer transports
            if (viewer.recvTransport) viewer.recvTransport.close();
            if (viewer.sendTransport) viewer.sendTransport.close();

            // Notify broadcaster
            if (room.broadcasterSocketId) {
                io.to(room.broadcasterSocketId).emit('disconnectPeer', socket.id, viewer.username);
            }

            room.viewers.delete(socket.id);
            delete viewers[socket.id];

            log.debug('SFU viewer disconnected', {
                broadcastID,
                socketId: socket.id,
                username: viewer.username,
                remainingViewers: room.viewers.size,
            });
            return true;
        }
    }
    return false;
}

// =====================================================
// Module exports
// =====================================================

module.exports = {
    createWorkers,
    closeWorkers,
    getOrCreateRoom,
    getRoom,
    deleteRoom,
    getRoomSourceType,
    reserveRtmpIngest,
    isRtmpSourceActive,
    startRtmpIngest,
    handleSfuConnection,
    handleSfuDisconnect,
    sfuRooms,
    config,
};
