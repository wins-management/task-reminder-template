// WhatsApp 自我提醒 —— 连接本地后端（server/），用扫二维码的方式
// 把你自己的 WhatsApp 挂上去，跟打开网页版 WhatsApp Web 是同一回事。
//
// 后端负责维持 WhatsApp 连接、生成二维码、实际发送消息（发到你自己的聊天）。
// 这个文件只负责：轮询后端连接状态、显示二维码、以及在任务快到期时
// 呼叫后端的 /api/send 接口。
//
// 如果你把后端跑在别的机器 / 别的端口，改这里的 BACKEND_URL 就好。
const BACKEND_URL = 'http://localhost:3001';

const REMINDER_SETTINGS_KEY = 'tm_reminder_settings';
const REMINDER_LOG_KEY = 'tm_reminder_log';
const DEFAULT_SETTINGS = { enabled: false, leadMinutes: 60 };

let reminderIntervalId = null;
let statusPollIntervalId = null;
let currentStatus = 'connecting'; // 'connecting' | 'connected' | 'disconnected'

function loadReminderSettings() {
  try {
    return JSON.parse(localStorage.getItem(REMINDER_SETTINGS_KEY)) || DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

function saveReminderSettings(settings) {
  localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
}

function loadReminderLog() {
  try {
    return JSON.parse(localStorage.getItem(REMINDER_LOG_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveReminderLog(log) {
  localStorage.setItem(REMINDER_LOG_KEY, JSON.stringify(log.slice(-50)));
}

function initReminderView() {
  const settings = loadReminderSettings();
  document.getElementById('remindersEnabled').checked = settings.enabled;
  document.getElementById('leadMinutes').value = String(settings.leadMinutes);
  renderReminderLog();

  document.getElementById('saveSettingsBtn').addEventListener('click', function () {
    saveReminderSettings({
      enabled: document.getElementById('remindersEnabled').checked,
      leadMinutes: Number(document.getElementById('leadMinutes').value),
    });
    restartReminderEngine();
  });

  document.getElementById('disconnectBtn').addEventListener('click', function () {
    if (!confirm('确定要断开 WhatsApp 连接吗？下次要提醒需要重新扫码。')) return;
    fetch(BACKEND_URL + '/api/logout', { method: 'POST' })
      .then(function () { pollConnectionStatus(); })
      .catch(function () { alert('无法连接到本地后端，请确认 server/ 已启动'); });
  });

  document.getElementById('testReminderBtn').addEventListener('click', function () {
    sendWhatsAppMessage('这是一条测试提醒消息 🔔（来自任务管理器模板）');
  });

  pollConnectionStatus();
  statusPollIntervalId = setInterval(pollConnectionStatus, 3000);
}

function setBindStatus(text, cls) {
  const el = document.getElementById('bindStatus');
  el.textContent = text;
  el.className = 'bind-status' + (cls ? ' ' + cls : '');
}

function pollConnectionStatus() {
  fetch(BACKEND_URL + '/api/status')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      currentStatus = data.status;

      if (data.status === 'connected') {
        setBindStatus('✅ 已连接：' + (data.selfNumber || '未知号码'), 'bound');
        document.getElementById('qrPlaceholder').classList.remove('hidden');
        document.getElementById('qrPlaceholder').textContent = '✅ 已连接';
        document.getElementById('qrImage').classList.add('hidden');
      } else if (data.status === 'connecting') {
        setBindStatus('尚未连接，请用手机 WhatsApp 扫描左边的二维码', 'warn');
        fetchQrCode();
      } else {
        setBindStatus('WhatsApp 未连接（已断开）', 'warn');
        document.getElementById('qrPlaceholder').classList.remove('hidden');
        document.getElementById('qrPlaceholder').textContent = '尚未生成二维码，请稍候…';
        document.getElementById('qrImage').classList.add('hidden');
      }
    })
    .catch(function () {
      currentStatus = 'disconnected';
      setBindStatus('⚠️ 无法连接到本地后端，请先在 server/ 目录执行 npm start', 'warn');
      document.getElementById('qrPlaceholder').classList.remove('hidden');
      document.getElementById('qrPlaceholder').textContent = '后端未启动';
      document.getElementById('qrImage').classList.add('hidden');
    });
}

function fetchQrCode() {
  fetch(BACKEND_URL + '/api/qr')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      const img = document.getElementById('qrImage');
      const placeholder = document.getElementById('qrPlaceholder');
      if (data.qr) {
        img.src = data.qr;
        img.classList.remove('hidden');
        placeholder.classList.add('hidden');
      } else {
        img.classList.add('hidden');
        placeholder.classList.remove('hidden');
        placeholder.textContent = '正在生成二维码…';
      }
    })
    .catch(function () { /* 下一轮轮询会重试 */ });
}

function renderReminderLog() {
  const log = loadReminderLog();
  const ul = document.getElementById('reminderLog');
  const empty = document.getElementById('logEmptyState');

  ul.innerHTML = '';
  empty.style.display = log.length ? 'none' : 'block';

  log.slice().reverse().forEach(function (entry) {
    const li = document.createElement('li');
    li.className = 'log-item';
    li.innerHTML = '<span class="log-time">' + entry.time + '</span> ' + entry.status + '：' +
      escapeHtml(entry.message);
    ul.appendChild(li);
  });
}

function sendWhatsAppMessage(message) {
  const log = loadReminderLog();

  fetch(BACKEND_URL + '/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message }),
  })
    .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
    .then(function (result) {
      log.push({
        time: new Date().toLocaleString('zh-CN'),
        message: message,
        status: result.ok ? '✅ 已发送到你的 WhatsApp' : '❌ 发送失败（' + (result.data.error || '未知错误') + '）',
      });
      saveReminderLog(log);
      renderReminderLog();
    })
    .catch(function () {
      log.push({
        time: new Date().toLocaleString('zh-CN'),
        message: message,
        status: '❌ 发送失败（无法连接到本地后端）',
      });
      saveReminderLog(log);
      renderReminderLog();
    });
}

function checkDueTasksAndRemind() {
  const settings = loadReminderSettings();
  if (!settings.enabled || currentStatus !== 'connected') return;

  const now = new Date();
  const leadMs = settings.leadMinutes * 60 * 1000;

  loadTasks().forEach(function (task) {
    if (task.status === 'done' || task.notifiedReminder) return;

    const due = new Date(task.dueDate + 'T' + task.dueTime);
    const remindAt = new Date(due.getTime() - leadMs);
    if (now < remindAt) return;

    // 先重新读一次并立刻标记 + 写回，再去发消息（而不是发送成功后才标记）。
    // 这样如果同时开着多个标签页，两边都在轮询，重复发送同一条提醒的
    // 时间窗口会缩小到「读 + 写 localStorage」这一瞬间，而不是整个网络请求耗时。
    const tasks = loadTasks();
    const t = tasks.find(function (x) { return x.id === task.id; });
    if (!t || t.status === 'done' || t.notifiedReminder) return;
    t.notifiedReminder = true;
    saveTasks(tasks);

    const message = now >= due
      ? '⏰ 任务《' + task.title + '》已到期！'
      : '⏰ 任务《' + task.title + '》将在 ' + settings.leadMinutes + ' 分钟内到期，请及时处理。';
    sendWhatsAppMessage(message);
  });
}

function startReminderEngine() {
  checkDueTasksAndRemind();
  // 每 20 秒检查一次，仅用于教学演示。真实产品应把定时检查放到后端排程。
  reminderIntervalId = setInterval(checkDueTasksAndRemind, 20000);
}

function restartReminderEngine() {
  if (reminderIntervalId) clearInterval(reminderIntervalId);
  startReminderEngine();
}
