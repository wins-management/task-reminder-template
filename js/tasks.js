// 任务的增删改查，数据存在 localStorage（每台设备/浏览器各自独立）。

const TASKS_KEY = 'tm_tasks';
const PRIORITY_LABEL = { low: '低', medium: '中', high: '高' };

let currentFilter = 'all';

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function uid() {
  return 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// 首次打开时塞几笔示范任务，让界面一开始看起来就有内容，方便想象实际用起来的样子。
// 只在「从未 seed 过」且「目前没有任务」时执行一次，之后学员自己增删都不会再被覆盖。
function seedDemoTasksIfEmpty() {
  const SEEDED_KEY = 'tm_seeded';
  if (localStorage.getItem(SEEDED_KEY)) return;
  localStorage.setItem(SEEDED_KEY, 'true');
  if (loadTasks().length > 0) return;

  function offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const now = new Date().toISOString();
  const demoTasks = [
    { id: uid(), title: '提交本周工作周报', dueDate: offsetDate(0), dueTime: '18:00', priority: 'high', notes: '记得附上下周计划', done: false, createdAt: now, notifiedReminder: false },
    { id: uid(), title: '客户提案设计稿定稿', dueDate: offsetDate(0), dueTime: '15:30', priority: 'high', notes: '', done: false, createdAt: now, notifiedReminder: false },
    { id: uid(), title: '缴纳这个月的水电费', dueDate: offsetDate(-1), dueTime: '23:59', priority: 'medium', notes: '网银转账即可', done: false, createdAt: now, notifiedReminder: false },
    { id: uid(), title: '团队周会', dueDate: offsetDate(1), dueTime: '10:00', priority: 'medium', notes: '会议室 A', done: false, createdAt: now, notifiedReminder: false },
    { id: uid(), title: '复习 Claude Code 课程笔记', dueDate: offsetDate(3), dueTime: '20:00', priority: 'low', notes: '', done: false, createdAt: now, notifiedReminder: false },
    { id: uid(), title: '回复设计师的反馈邮件', dueDate: offsetDate(-2), dueTime: '12:00', priority: 'low', notes: '', done: true, createdAt: now, notifiedReminder: false },
  ];

  saveTasks(demoTasks);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function initTasksView() {
  seedDemoTasksIfEmpty();

  const form = document.getElementById('taskForm');
  const toggleBtn = document.getElementById('toggleFormBtn');
  const cancelBtn = document.getElementById('cancelFormBtn');

  toggleBtn.addEventListener('click', function () {
    form.classList.remove('hidden');
    form.reset();
    document.getElementById('taskId').value = '';
  });

  cancelBtn.addEventListener('click', function () {
    form.classList.add('hidden');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const tasks = loadTasks();
    const taskData = {
      title: document.getElementById('taskTitle').value.trim(),
      dueDate: document.getElementById('taskDate').value,
      dueTime: document.getElementById('taskTime').value,
      priority: document.getElementById('taskPriority').value,
      notes: document.getElementById('taskNotes').value.trim(),
    };

    if (id) {
      const idx = tasks.findIndex(function (t) { return t.id === id; });
      if (idx > -1) {
        tasks[idx] = Object.assign({}, tasks[idx], taskData);
        tasks[idx].notifiedReminder = false; // 截止时间可能改了，允许重新提醒
      }
    } else {
      tasks.push(Object.assign({
        id: uid(),
        done: false,
        createdAt: new Date().toISOString(),
        notifiedReminder: false,
      }, taskData));
    }

    saveTasks(tasks);
    form.classList.add('hidden');
    form.reset();
    renderTasks();
  });

  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  renderTasks();
}

function getFilteredTasks() {
  const tasks = loadTasks().sort(function (a, b) {
    return (a.dueDate + a.dueTime).localeCompare(b.dueDate + b.dueTime);
  });
  const todayStr = new Date().toISOString().slice(0, 10);

  switch (currentFilter) {
    case 'today': return tasks.filter(function (t) { return t.dueDate === todayStr; });
    case 'pending': return tasks.filter(function (t) { return !t.done; });
    case 'done': return tasks.filter(function (t) { return t.done; });
    default: return tasks;
  }
}

function renderTasks() {
  const list = document.getElementById('taskList');
  const empty = document.getElementById('emptyState');
  const tasks = getFilteredTasks();
  const now = new Date();

  list.innerHTML = '';
  empty.style.display = tasks.length ? 'none' : 'block';

  tasks.forEach(function (task) {
    const due = new Date(task.dueDate + 'T' + task.dueTime);
    const overdue = !task.done && due < now;

    const li = document.createElement('li');
    li.className = 'task-item priority-' + task.priority + (task.done ? ' done' : '') + (overdue ? ' overdue' : '');

    li.innerHTML =
      '<label class="task-check"><input type="checkbox" ' + (task.done ? 'checked' : '') + '></label>' +
      '<div class="task-body">' +
        '<div class="task-title">' + escapeHtml(task.title) + '</div>' +
        '<div class="task-meta">' +
          '<span class="badge badge-priority">' + (PRIORITY_LABEL[task.priority] || task.priority) + '优先级</span>' +
          '<span class="badge">📅 ' + task.dueDate + ' ' + task.dueTime + '</span>' +
          (overdue ? '<span class="badge badge-overdue">已逾期</span>' : '') +
        '</div>' +
        (task.notes ? '<div class="task-notes">' + escapeHtml(task.notes) + '</div>' : '') +
      '</div>' +
      '<div class="task-actions">' +
        '<button class="icon-btn edit-btn" title="编辑">✏️</button>' +
        '<button class="icon-btn delete-btn" title="删除">🗑️</button>' +
      '</div>';

    li.querySelector('input[type=checkbox]').addEventListener('change', function (e) {
      toggleDone(task.id, e.target.checked);
    });
    li.querySelector('.edit-btn').addEventListener('click', function () { editTask(task.id); });
    li.querySelector('.delete-btn').addEventListener('click', function () { deleteTask(task.id); });

    list.appendChild(li);
  });
}

function toggleDone(id, done) {
  const tasks = loadTasks();
  const t = tasks.find(function (t) { return t.id === id; });
  if (t) {
    t.done = done;
    saveTasks(tasks);
    renderTasks();
  }
}

function deleteTask(id) {
  if (!confirm('确定要删除这个任务吗？')) return;
  saveTasks(loadTasks().filter(function (t) { return t.id !== id; }));
  renderTasks();
}

function editTask(id) {
  const t = loadTasks().find(function (t) { return t.id === id; });
  if (!t) return;

  document.getElementById('taskForm').classList.remove('hidden');
  document.getElementById('taskId').value = t.id;
  document.getElementById('taskTitle').value = t.title;
  document.getElementById('taskDate').value = t.dueDate;
  document.getElementById('taskTime').value = t.dueTime;
  document.getElementById('taskPriority').value = t.priority;
  document.getElementById('taskNotes').value = t.notes || '';
  document.getElementById('taskForm').scrollIntoView({ behavior: 'smooth' });
}
