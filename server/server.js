// WhatsApp 自我提醒后端。
//
// 用法和 WhatsApp Web 一样：启动这个服务，去前端「WhatsApp 提醒设置」页扫二维码，
// 把你自己的 WhatsApp 帐号「挂」上去（这是 WhatsApp 的多设备连接功能，跟你手机
// 上另外登一个 WhatsApp Web 网页版是同一回事）。连上之后，到期提醒会作为一条
// 消息发到你「自己的聊天」（WhatsApp 里那个只有你自己的对话）。
//
// 这里用的是 Baileys（一个开源、非官方的 WhatsApp Web 协议实现），不是 WhatsApp
// 官方的 Business API，也没有申请任何商用发送资格 —— 只适合你自己对自己发提醒，
// 请不要用来批量发送或做营销/骚扰用途，那样很容易被 WhatsApp 封号。

const path = require('path');
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys');

const PORT = process.env.PORT || 3001;
// 默认只监听本机回环地址，不对局域网内的其他设备开放（避免同网段的人也能扫到
// 你的二维码、调用发送接口）。真的需要局域网访问时可以用 HOST=0.0.0.0 覆盖。
const HOST = process.env.HOST || '127.0.0.1';
const AUTH_DIR = path.join(__dirname, 'auth_info');

// 只允许「已知的前端页面来源」跨域调用发送接口，避免用户浏览器里打开的任何
// 一个网页都能悄悄 fetch 这个本地服务、借你的 WhatsApp 发消息（CSRF-to-localhost）。
// 'null' 是浏览器对 file:// 页面（直接双击 index.html 打开）发出的 Origin 值。
// 换了前端端口/域名，用逗号分隔的 ALLOWED_ORIGINS 环境变量覆盖即可。
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:8000', 'http://127.0.0.1:8000', 'null'];
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(function (s) { return s.trim(); })
  : DEFAULT_ALLOWED_ORIGINS;

const app = express();
app.use(cors({
  origin: function (origin, callback) {
    // 没有 Origin（比如用 curl/Postman 直接调用）先放行，方便本机调试；
    // 真正要拦的是浏览器里「别的网页」发起的跨域请求。
    if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    callback(new Error('CORS：来源不在白名单内 — ' + origin));
  },
}));
app.use(express.json());

let sock = null;
let latestQr = null;
let connectionStatus = 'connecting'; // 'connecting' | 'connected' | 'disconnected'
let selfNumber = null;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQr = qr;
      connectionStatus = 'connecting';
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      latestQr = null;
      selfNumber = sock.user && sock.user.id ? sock.user.id.split(':')[0] : null;
      console.log('✅ WhatsApp 已连接：', selfNumber);
    }

    if (connection === 'close') {
      connectionStatus = 'disconnected';
      const statusCode = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
        ? lastDisconnect.error.output.statusCode
        : null;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.log('已在手机上解除连接（登出）。刷新页面重新扫码即可再次连接。');
      } else {
        // 延迟一下再重连，避免网络不稳定时无限快速重试（容易被当成异常行为）。
        console.log('连接断开，3 秒后尝试重新连接…');
        setTimeout(function () {
          startWhatsApp().catch(function (err) {
            console.error('重新连接失败：', err);
          });
        }, 3000);
      }
    }
  });
}

startWhatsApp().catch((err) => {
  console.error('启动 WhatsApp 连接失败：', err);
});

app.get('/api/status', (req, res) => {
  res.json({ status: connectionStatus, selfNumber });
});

app.get('/api/qr', async (req, res) => {
  if (!latestQr) {
    return res.json({ qr: null });
  }
  const dataUrl = await QRCode.toDataURL(latestQr);
  res.json({ qr: dataUrl });
});

app.post('/api/send', async (req, res) => {
  if (connectionStatus !== 'connected' || !sock || !sock.user) {
    return res.status(400).json({ error: 'WhatsApp 尚未连接，请先扫码登录' });
  }

  const { message } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: '缺少 message 参数' });
  }

  try {
    const selfJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    await sock.sendMessage(selfJid, { text: message });
    res.json({ ok: true });
  } catch (err) {
    console.error('发送消息失败：', err);
    res.status(500).json({ error: '发送失败：' + err.message });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    if (sock) await sock.logout();
  } catch (err) {
    console.error('登出时出错：', err);
  }
  connectionStatus = 'disconnected';
  selfNumber = null;
  res.json({ ok: true });
});

app.listen(PORT, HOST, () => {
  console.log(`WhatsApp 提醒后端已启动：http://${HOST}:${PORT}`);
  console.log(`允许跨域来源：${ALLOWED_ORIGINS.join(', ')}`);
});
