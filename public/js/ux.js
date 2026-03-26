'use strict';

/**
 * UX enhancements — visual-only, no logic changes.
 * Auto-hide controls, keyboard shortcuts, button feedback.
 */

(function () {
    // =====================================================
    // Auto-hide controls on inactivity (broadcast/viewer)
    // =====================================================

    const controlBars = document.querySelectorAll('.broadcast-buttons, .viewer-buttons');
    const headers = document.querySelectorAll('.broadcast-header, .viewer-header');
    let hideTimer = null;
    let controlsVisible = true;

    function showControls() {
        controlBars.forEach((bar) => {
            bar.style.opacity = '1';
            bar.style.transform = 'translateY(0)';
        });
        headers.forEach((h) => {
            h.style.opacity = '1';
        });
        controlsVisible = true;
    }

    function hideControls() {
        controlBars.forEach((bar) => {
            bar.style.opacity = '0';
            bar.style.transform = 'translateY(8px)';
        });
        headers.forEach((h) => {
            h.style.opacity = '0';
        });
        controlsVisible = false;
    }

    function resetHideTimer() {
        showControls();
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideControls, 4000);
    }

    if (controlBars.length > 0) {
        // Apply transition styles
        controlBars.forEach((bar) => {
            bar.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        });
        headers.forEach((h) => {
            h.style.transition = 'opacity 0.3s ease';
        });

        document.addEventListener('mousemove', resetHideTimer);
        document.addEventListener('touchstart', resetHideTimer);
        document.addEventListener('keydown', resetHideTimer);

        // Don't hide when hovering over controls
        controlBars.forEach((bar) => {
            bar.addEventListener('mouseenter', () => {
                clearTimeout(hideTimer);
                showControls();
            });
            bar.addEventListener('mouseleave', resetHideTimer);
        });

        resetHideTimer();
    }

    // =====================================================
    // Button click ripple/feedback effect
    // =====================================================

    document.addEventListener('click', function (e) {
        const btn = e.target.closest('button');
        if (!btn) return;

        btn.style.transition = 'transform 100ms ease';
        btn.style.transform = 'scale(0.92)';
        setTimeout(() => {
            btn.style.transform = '';
            btn.style.transition = '';
        }, 150);
    });

    // =====================================================
    // Keyboard shortcuts (broadcast & viewer)
    // =====================================================

    document.addEventListener('keydown', function (e) {
        // Skip if typing in an input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        switch (e.key.toLowerCase()) {
            case 'f': {
                // Toggle fullscreen
                const fsOn = document.getElementById('fullScreenOn');
                const fsOff = document.getElementById('fullScreenOff');
                if (fsOn && fsOn.style.display !== 'none') {
                    fsOn.click();
                } else if (fsOff && fsOff.style.display !== 'none') {
                    fsOff.click();
                }
                break;
            }
            case 'm': {
                // Toggle mute
                const disAudio = document.getElementById('disableAudio');
                const enAudio = document.getElementById('enableAudio');
                if (disAudio && disAudio.style.display !== 'none') {
                    disAudio.click();
                } else if (enAudio && enAudio.style.display !== 'none') {
                    enAudio.click();
                }
                break;
            }
            case 'v': {
                // Toggle video
                const videoBtn = document.getElementById('videoBtn');
                if (videoBtn && videoBtn.style.display !== 'none') {
                    videoBtn.click();
                }
                break;
            }
        }
    });

    // =====================================================
    // Smooth scroll for messages area
    // =====================================================

    const messagesArea = document.getElementById('messagesArea');
    if (messagesArea) {
        messagesArea.style.scrollBehavior = 'smooth';
    }

    // =====================================================
    // Animate viewer count changes
    // =====================================================

    const connectedPeers = document.getElementById('connectedPeers');
    if (connectedPeers) {
        const observer = new MutationObserver(() => {
            connectedPeers.style.transition = 'transform 200ms ease';
            connectedPeers.style.transform = 'scale(1.3)';
            connectedPeers.style.color = 'var(--accent-color)';
            setTimeout(() => {
                connectedPeers.style.transform = 'scale(1)';
                connectedPeers.style.color = '';
            }, 300);
        });
        observer.observe(connectedPeers, { childList: true, characterData: true, subtree: true });
    }
})();
