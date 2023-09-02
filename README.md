# MiroTalk WebRTC Live Broadcast

MiroTalk WebRTC Live Broadcast allows to broadcast live video, audio and screen stream to all connected users (viewers) and receive messages from them. Can handle unlimited rooms, without time limitations, each having a broadcast and many viewers.

---

<p align="center">
    <a href="https://bro.mirotalk.com">bro.mirotalk.com</a>
</p>

<p align="center">
    <a href="https://bro.mirotalk.com"><img src="./public/assets/images/ui.png"></a>
</p>

---

<p align="center">
    For questions, discussions, help & support, join with us on <a href="https://discord.gg/rgGYfeYW3N">discord</a>
</p>

---

</details>

<details open>
<summary>Quick Start</summary>

<br/>

Start the app using [nodejs](https://nodejs.org/en/download):

```bash
# Copy .env.template in .env and edit it if needed
$ cp .env.template .env
# Install dependencies
$ npm install
# Run the app
$ npm start
```

Start the app using [docker](https://docs.docker.com/engine/install/) and [docker-compose](https://docs.docker.com/compose/) and optional [official image](https://hub.docker.com/r/mirotalk/bro):

![docker](public/assets/images/docker.png)

```bash
# Copy .env.template in .env and edit it if needed
$ cp .env.template .env
# Copy docker-compose.template.yml in docker-compose.yml and edit it if needed
$ cp docker-compose.template.yml docker-compose.yml
# Building the image or get the official one: docker-compose pull
$ docker-compose build
# Run the image in a container
$ docker-compose up #-d
```

Server up and running

```js
Server is running {
  home: 'http://localhost:3016',
  broadcast: 'http://localhost:3016/broadcast?id=123&name=Broadcaster',
  viewer: 'http://localhost:3016/viewer?id=123&name=Viewer'
}
```

The app should now be running on your http://localhost:3016, you can choose if join room as a `Broadcaster` or `Viewer`.

The `Broadcaster` stream the audio, video or screen to all connected viewers and can receive messages from them.

The `Viewer` get the audio, video or screen that is streamed from the broadcaster and can send messages to it.

</details>

<details>
<summary>Direct Join</summary>

<br>

You can direct join room as `broadcaster` or `viewer` specifying the room id and your name.

| As            | URL                                                     |
| ------------- | ------------------------------------------------------- |
| `Broadcaster` | http://localhost:3016/broadcast?id=123&name=Broadcaster |
| `Viewer`      | http://localhost:3016/viewer?id=123&name=Viewer         |

| Params | Type   | Description |
| ------ | ------ | ----------- |
| id     | string | room Id     |
| name   | string | user name   |

</details>

<details>
<summary>Embedding</summary>

<br/>

Embedding MiroTalk Live Broadcast into a service or app using an iframe.

```html
<iframe
    allow="camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write; autoplay"
    src="https://bro.mirotalk.com"
    style="height: 100vh; width: 100vw; border: 0px;"
></iframe>
```

</details>

<details>
<summary>Documentations</summary>

<br>

-   [Install your own Stun/Turn](./docs/coturn.md)
-   [Ngrok](./docs/ngrok.md)
-   [How to Self-hosting](./docs/self-hosting.md)

</details>

<details>
<summary>Credits</summary>

<br>

-   Gabriel Tanner [webrtc-broadcast-logic](https://gabrieltanner.org/blog/webrtc-video-broadcast/)

</details>

<details>
<summary>License</summary>

<br/>

[![AGPLv3](public/assets/images/AGPLv3.png)](LICENSE)

MiroTalk is free and can be modified and forked. But the conditions of the AGPLv3 (GNU Affero General Public License v3.0) need to be respected. In particular modifications need to be free as well and made available to the public. Get a quick overview of the license at [Choose an open source license](https://choosealicense.com/licenses/agpl-3.0/).

For a MiroTalk license under conditions other than AGPLv3, please contact us at license.mirotalk@gmail.com.

</details>

<details open>
<summary>Support</summary>

<br/>

If MiroTalk BRO has been useful for you and want to contribute to its continued success, consider becoming a backer or sponsor by visiting [this link](https://github.com/sponsors/miroslavpejic85).

Your support means the world to us, and together, we can make MiroTalk Live Broadcast even better! Thank you for being part of this amazing journey. 🌟

</details>

---

## Other MiroTalk projects:

<details>
<summary>MiroTalk C2C</summary>

<br>

[MiroTalk C2C](https://github.com/miroslavpejic85/mirotalkc2c) `peer to peer` real-time video conferences, optimized for cam 2 cam. Unlimited time, unlimited rooms each having 2 participants.

</details>

<details>
<summary>MiroTalk P2P</summary>

<br>

[MiroTalk P2P](https://github.com/miroslavpejic85/mirotalk) `peer to peer` real-time video conferences, optimized for small groups. Unlimited time, unlimited rooms each having 5-8 participants.

</details>

<details>
<summary>MiroTalk SFU</summary>

<br>

[MiroTalk SFU](https://github.com/miroslavpejic85/mirotalksfu) `selective forwarding unit` real-time video conferences, optimized for large groups. Unlimited time, unlimited rooms each having 8+ participants.

</details>

<details>
<summary>MiroTalk WEB</summary>

<br>

[MiroTalk WEB](https://github.com/miroslavpejic85/mirotalkwebrtc) rooms scheduler.

</details>

---
