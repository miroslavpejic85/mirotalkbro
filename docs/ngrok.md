# MiroTalk WebRTC Live Broadcast - Ngrok

![ngrok](../public/assets/images/ngrok.png)

If you want to expose MiroTalk Live Broadcast from your `Local PC` to outside in `HTTPS`, you need to do 1 thing

Edit the Ngrok part on `.env` file

```bash
# 1. Goto https://ngrok.com
# 2. Get started for free
# 3. Copy YourNgrokAuthToken: https://dashboard.ngrok.com/get-started/your-authtoken

NGROK_ENABLED=true
NGROK_AUTH_TOKEN=YourNgrokAuthToken
```

---

Then, when you run it with `npm start`, you should see in the console log:

```bash
ngrokHome: 'https://xxxx-xx-xx-xxx-xx.ngrok.io',
ngrokBroadcast: 'https://xxxx-xx-xx-xxx-xx.ngrok.io/broadcast?id=123&name=Broadcaster',
ngrokView: 'https://xxxx-xx-xx-xxx-xx.ngrok.io/viewer?id=123&name=Viewer',
```

Open the URL in your browser and join as `Broadcaster` or `Viewer`.
