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
const AUTH_DIR = path.join(__dirname, 'auth_info');

const app = express();
app.use(cors());
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
        console.log('连接断开，尝试重新连接…');
        startWhatsApp();
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

app.listen(PORT, () => {
  console.log(`WhatsApp 提醒后端已启动：http://localhost:${PORT}`);
});
