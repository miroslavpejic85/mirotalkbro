'use strict';

function popupMessage(icon, title, message, position = 'center', timer = 3000) {
    //playSound(icon);
    switch (icon) {
        case 'info':
        case 'success':
        case 'warning':
        case 'error':
            Swal.fire({
                allowOutsideClick: false,
                allowEscapeKey: false,
                position: position,
                icon: icon,
                title: title,
                html: message,
                showClass: { popup: 'animate__animated animate__fadeInDown' },
                hideClass: { popup: 'animate__animated animate__fadeOutUp' },
            });
            break;
        case 'clean':
            Swal.fire({
                allowOutsideClick: false,
                allowEscapeKey: false,
                position: position,
                title: title,
                html: message,
                showClass: { popup: 'animate__animated animate__fadeInDown' },
                hideClass: { popup: 'animate__animated animate__fadeOutUp' },
            });
            break;
        case 'toast':
            const Toast = Swal.mixin({
                toast: true,
                position: position,
                icon: 'info',
                showConfirmButton: false,
                timerProgressBar: true,
                timer: timer,
            });
            Toast.fire({
                icon: 'info',
                title: message,
                showClass: { popup: 'animate__animated animate__fadeInDown' },
                hideClass: { popup: 'animate__animated animate__fadeOutUp' },
            });
            break;
        default:
            alert(message);
    }
}

function popupEnableAutoPlay() {
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        showDenyButton: false,
        icon: 'warning',
        position: 'top',
        title: 'Autoplay is not allowed',
        text: 'Please click Play to start playback',
        confirmButtonText: '<i class="fas fa-play"></i>',
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            video.play().catch((error) => {
                console.error('Playback failed', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Playback Error',
                    text: 'Failed to start playback. Please try again',
                });
            });
        }
    });
}
