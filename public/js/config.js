'use strict';

const broadcastSettings = {
    buttons: {
        copyRoom: true,
        shareRoom: true,
        screenShareStart: true,
        video: true,
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
    },
};

const viewerSettings = {
    buttons: {
        audio: true,
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

const html = {
    support: true,
};
