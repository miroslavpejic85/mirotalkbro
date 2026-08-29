'use strict';

const homePage = {
    appName: 'MiroTalk BRO',
    showCopyright: true,
    about: {
        show: true,
        url: 'https://docs.mirotalk.com/sites/bro.html',
    },
    buttons: {
        broadcast: true,
        viewer: true,
    },
};

const broadcastSettings = {
    buttons: {
        copyRoom: true,
        shareRoom: true,
        audio: true,
        video: true,
        screenShareStart: true,
        recordingStart: true,
        messagesOpenForm: true,
        viewersOpenForm: true,
        fullScreenOn: true,
        pictureInPicture: true,
        close: true,
    },
    options: {
        settings: true,
        start_full_screen: false,
        zoom_video: true,
        show_chat_on_msg: false,
        speech_msg: false,
        show_viewers: true, // Either viewerSettings.buttons.audio or viewerSettings.buttons.video must be true to address privacy concerns!
    },
};

const viewerSettings = {
    buttons: {
        audio: true,
        video: true,
        snapshot: true,
        recordingStart: true,
        fullScreenOn: true,
        message: true,
        pictureInPicture: true,
        qualitySelect: false,
        settings: true,
        close: true,
    },
    options: {
        start_full_screen: false,
        zoom_video: true,
        redirect_url: '/disconnect', // URL to redirect viewers when they leave the room
        disconnect_url: '/disconnect', // URL to redirect viewers when the broadcaster ends the session or disconnects them
        disconnect_txt: 'Thank you for joining!', // Text to display on disconnect page
    },
};

/**
 * Simulcast encodings for video producers (broadcaster & viewer)
 * Each layer defines a spatial layer with rid, max bitrate, and scale-down factor.
 * The SFU can forward different layers to different consumers based on bandwidth.
 */
const simulcast = {
    enabled: true,
    encodings: [
        { rid: 'r0', maxBitrate: 100000, scaleResolutionDownBy: 4 }, // Low:    1/4 resolution
        { rid: 'r1', maxBitrate: 300000, scaleResolutionDownBy: 2 }, // Medium: 1/2 resolution
        { rid: 'r2', maxBitrate: 900000, scaleResolutionDownBy: 1 }, // High:   full resolution
    ],
    codecOptions: {
        videoGoogleStartBitrate: 1000,
    },
};

/**
 * SFU broadcast tuning (mediasoup-client, applied browser-side).
 * Tuned for one-way BRO broadcasting over variable uplinks where continuous
 * playback and readable presentation content matter more than low latency
 */
const sfuTuning = {
    /**
     * Receiver-side playout buffer (ms) for viewers consuming the broadcaster.
     * 0 disables the override (interactive default). Larger = smoother under loss.
     * - 500–1000 ms  — good uplinks, keeps latency low, absorbs minor jitter. Best if any near-real-time interaction (Q&A, chat reactions) matters.
     * - 1500–2000 ms — solid default for a variable uplink with observable packet loss. Best all-round choice for one-way webinars/presentations.
     * - 3000–4000 ms — very lossy/unstable uplinks where continuity is everything and latency is irrelevant (e.g. pure playback).
     */
    viewerJitterBufferTarget: 800,
    // Opus resilience on the broadcaster audio producer.
    audioCodecOptions: {
        opusFec: true, // in-band forward error correction
        opusNack: true, // retransmission of lost packets
        opusPtime: 20,
        opusMaxAverageBitrate: 48000,
        opusDtx: false, // keep audio continuous (no discontinuous transmission)
    },
    /**
     * Video track content hint for the broadcaster.
     * - 'motion' — best for live camera / moving footage: keeps frame rate smooth, sacrifices per-frame detail under bandwidth pressure.
     * - 'detail' — best for mixed slides + camera / graphics: keeps resolution sharp, drops frame rate first so images stay clear.
     * - 'text'   — best for pure slides / code / documents: maximum sharpness, lowest frame rate, prioritizes readable static content.
     */
    contentHint: {
        camera: 'motion',
        screen: 'detail',
    },
    /**
     * Optional explicit sender degradation override (mostly subsumed by contentHint).
     * - 'maintain-resolution' — best for slides / text / graphics: under bandwidth pressure drops frame rate, keeps content readable.
     * - 'maintain-framerate'  — best for live camera / motion: keeps playback smooth, lowers resolution when bandwidth is tight.
     * - 'balanced'            — best for mixed content: trades off resolution and frame rate together.
     * - null                  — leave the browser/contentHint default (no override).
     */
    degradationPreference: 'balanced',
};
