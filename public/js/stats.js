'use strict';

const umami = true;

// https://github.com/mikecao/umami

if (!umami) {
    console.warn('Umami is disabled');
} else {
    const script = document.createElement('script');
    script.setAttribute('async', '');
    script.setAttribute('src', 'https://stats.mirotalk.com/script.js');
    script.setAttribute('data-website-id', '5185fbad-9d16-4005-84d4-18310766be9d');
    document.head.appendChild(script);
}
