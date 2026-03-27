'use strict';

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

// Simulcast encodings for video producers (broadcaster & viewer)
// Each layer defines a spatial layer with rid, max bitrate, and scale-down factor.
// The SFU can forward different layers to different consumers based on bandwidth.
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

const html = {
    support: true,
};
