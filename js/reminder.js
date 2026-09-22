// WhatsApp 绑定与到期提醒 —— 本文件是教学模板的核心 Mock 部分。
//
// 重要说明：这里并不会真的发送 WhatsApp 消息。
// 绑定的号码只存在浏览器的 localStorage 里，提醒也只是写进本地的
// 「提醒记录」列表 + 弹一个浏览器通知，用来模拟「消息已送达」的体验。
//
// 想接真实 WhatsApp，需要：
//   1. 一个后端服务（Node / Python 都行），保存 WhatsApp API 的密钥，绝对不要放在前端。
//   2. 后端调用 WhatsApp Business Cloud API 或 Twilio 等服务的发送消息接口。
//   3. 把下面 sendWhatsAppMessage() 里的模拟逻辑，换成对你后端接口的 fetch() 调用。

const WHATSAPP_SETTINGS_KEY = 'tm_whatsapp_settings';
const REMINDER_LOG_KEY = 'tm_reminder_log';
const DEFAULT_SETTINGS = { phoneNumber: '', enabled: false, leadMinutes: 60 };

let reminderIntervalId = null;

function loadWhatsappSettings() {
  try {
    return JSON.parse(localStorage.getItem(WHATSAPP_SETTINGS_KEY)) || DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

function saveWhatsappSettings(settings) {
  localStorage.setItem(WHATSAPP_SETTINGS_KEY, JSON.stringify(settings));
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
  const settings = loadWhatsappSettings();
  document.getElementById('whatsappNumber').value = settings.phoneNumber;
  document.getElementById('remindersEnabled').checked = settings.enabled;
  document.getElementById('leadMinutes').value = String(settings.leadMinutes);
  renderBindStatus();
  renderReminderLog();

  document.getElementById('bindBtn').addEventListener('click', function () {
    const phone = document.getElementById('whatsappNumber').value.trim();
    if (!phone) {
      alert('请输入 WhatsApp 号码');
      return;
    }
    saveWhatsappSettings({
      phoneNumber: phone,
      enabled: document.getElementById('remindersEnabled').checked,
      leadMinutes: Number(document.getElementById('leadMinutes').value),
    });
    renderBindStatus();
    restartReminderEngine();
  });

  document.getElementById('unbindBtn').addEventListener('click', function () {
    saveWhatsappSettings(DEFAULT_SETTINGS);
    document.getElementById('whatsappNumber').value = '';
    document.getElementById('remindersEnabled').checked = false;
    renderBindStatus();
    restartReminderEngine();
  });

  document.getElementById('testReminderBtn').addEventListener('click', function () {
    const s = loadWhatsappSettings();
    if (!s.phoneNumber) {
      alert('请先绑定 WhatsApp 号码');
      return;
    }
    sendWhatsAppMessage(s.phoneNumber, '这是一条测试提醒消息 🔔（来自任务管理器模板）');
  });
}

function renderBindStatus() {
  const s = loadWhatsappSettings();
  const el = document.getElementById('bindStatus');
  if (s.phoneNumber) {
    el.textContent = '✅ 已绑定：' + s.phoneNumber + '（提醒' + (s.enabled ? '已启用' : '已停用') + '）';
    el.className = 'bind-status bound';
  } else {
    el.textContent = '尚未绑定 WhatsApp 号码';
    el.className = 'bind-status';
  }
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
    li.innerHTML = '<span class="log-time">' + entry.time + '</span> 已（模拟）发送给 <strong>' +
      escapeHtml(entry.phone) + '</strong>：' + escapeHtml(entry.message);
    ul.appendChild(li);
  });
}

function sendWhatsAppMessage(phoneNumber, message) {
  // TODO(学员任务): 换成真实 API 调用，例如：
  // fetch('/api/send-whatsapp', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ to: phoneNumber, message: message }),
  // });

  const log = loadReminderLog();
  log.push({ time: new Date().toLocaleString('zh-CN'), phone: phoneNumber, message: message });
  saveReminderLog(log);
  renderReminderLog();

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('WhatsApp 提醒（模拟）', { body: message });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }
}

function checkDueTasksAndRemind() {
  const settings = loadWhatsappSettings();
  if (!settings.enabled || !settings.phoneNumber) return;

  const tasks = loadTasks();
  const now = new Date();
  let changed = false;

  tasks.forEach(function (task) {
    if (task.done || task.notifiedReminder) return;

    const due = new Date(task.dueDate + 'T' + task.dueTime);
    const leadMs = settings.leadMinutes * 60 * 1000;
    const remindAt = new Date(due.getTime() - leadMs);

    if (now >= remindAt) {
      const message = now >= due
        ? '⏰ 任务《' + task.title + '》已到期！'
        : '⏰ 任务《' + task.title + '》将在 ' + settings.leadMinutes + ' 分钟内到期，请及时处理。';
      sendWhatsAppMessage(settings.phoneNumber, message);
      task.notifiedReminder = true;
      changed = true;
    }
  });

  if (changed) saveTasks(tasks);
}

function startReminderEngine() {
  checkDueTasksAndRemind();
  // 每 20 秒检查一次，仅用于教学演示。真实产品应把定时检查放到后端（cron / 排程任务）。
  reminderIntervalId = setInterval(checkDueTasksAndRemind, 20000);
}

function restartReminderEngine() {
  if (reminderIntervalId) clearInterval(reminderIntervalId);
  startReminderEngine();
}
