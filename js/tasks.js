// 任务的增删改查，数据存在 localStorage（每台设备/浏览器各自独立）。
// 支持三种视图：卡片 / 表格 / 看板，共用同一份数据和同一套过滤条件。

const TASKS_KEY = 'tm_tasks';
const PRIORITY_LABEL = { low: '低', medium: '中', high: '高' };
const STATUS_LABEL = { todo: '待办', doing: '进行中', done: '已完成' };
const STATUS_ORDER = ['todo', 'doing', 'done'];

let currentFilter = 'all';
let currentViewMode = 'card';

// 早期版本的任务只有 done（布尔值），没有 status。这里做个兼容迁移，
// 让浏览器里旧版本留下的任务也能在表格/看板视图里正常显示。
function normalizeTask(t) {
  if (!t.status) {
    t.status = t.done ? 'done' : 'todo';
  }
  delete t.done;
  return t;
}

function loadTasks() {
  try {
    const tasks = JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
    return tasks.map(normalizeTask);
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
    { id: uid(), title: '提交本周工作周报', dueDate: offsetDate(0), dueTime: '18:00', priority: 'high', notes: '记得附上下周计划', status: 'todo', createdAt: now, notifiedReminder: false },
    { id: uid(), title: '客户提案设计稿定稿', dueDate: offsetDate(0), dueTime: '15:30', priority: 'high', notes: '', status: 'doing', createdAt: now, notifiedReminder: false },
    { id: uid(), title: '缴纳这个月的水电费', dueDate: offsetDate(-1), dueTime: '23:59', priority: 'medium', notes: '网银转账即可', status: 'todo', createdAt: now, notifiedReminder: false },
    { id: uid(), title: '团队周会', dueDate: offsetDate(1), dueTime: '10:00', priority: 'medium', notes: '会议室 A', status: 'doing', createdAt: now, notifiedReminder: false },
    { id: uid(), title: '复习 Claude Code 课程笔记', dueDate: offsetDate(3), dueTime: '20:00', priority: 'low', notes: '', status: 'todo', createdAt: now, notifiedReminder: false },
    { id: uid(), title: '回复设计师的反馈邮件', dueDate: offsetDate(-2), dueTime: '12:00', priority: 'low', notes: '', status: 'done', createdAt: now, notifiedReminder: false },
  ];

  saveTasks(demoTasks);
}

function initTasksView() {
  seedDemoTasksIfEmpty();
  saveTasks(loadTasks()); // 把旧格式（done → status）迁移的结果写回去，避免每次都要重新推算

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
        status: 'todo',
        createdAt: new Date().toISOString(),
        notifiedReminder: false,
      }, taskData));
    }

    saveTasks(tasks);
    form.classList.add('hidden');
    form.reset();
    render();
  });

  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  document.querySelectorAll('.switch-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.switch-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentViewMode = btn.dataset.viewmode;
      render();
    });
  });

  render();
}

function getFilteredTasks() {
  const tasks = loadTasks().sort(function (a, b) {
    return (a.dueDate + a.dueTime).localeCompare(b.dueDate + b.dueTime);
  });
  const todayStr = new Date().toISOString().slice(0, 10);

  switch (currentFilter) {
    case 'today': return tasks.filter(function (t) { return t.dueDate === todayStr; });
    case 'pending': return tasks.filter(function (t) { return t.status !== 'done'; });
    case 'done': return tasks.filter(function (t) { return t.status === 'done'; });
    default: return tasks;
  }
}

function render() {
  const tasks = getFilteredTasks();
  const emptyEl = document.getElementById('emptyState');
  const listEl = document.getElementById('taskList');
  const tableWrap = document.getElementById('taskTableWrap');
  const kanban = document.getElementById('kanbanBoard');

  listEl.classList.add('hidden');
  tableWrap.classList.add('hidden');
  kanban.classList.add('hidden');

  if (tasks.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  if (currentViewMode === 'table') {
    tableWrap.classList.remove('hidden');
    renderTable(tasks);
  } else if (currentViewMode === 'kanban') {
    kanban.classList.remove('hidden');
    renderKanban(tasks);
  } else {
    listEl.classList.remove('hidden');
    renderCardList(tasks);
  }
}

function taskMetaHtml(task, now) {
  const due = new Date(task.dueDate + 'T' + task.dueTime);
  const overdue = task.status !== 'done' && due < now;
  return {
    overdue: overdue,
    html:
      '<span class="badge badge-priority">' + (PRIORITY_LABEL[task.priority] || task.priority) + '优先级</span>' +
      '<span class="badge">📅 ' + task.dueDate + ' ' + task.dueTime + '</span>' +
      (overdue ? '<span class="badge badge-overdue">已逾期</span>' : ''),
  };
}

// --- 卡片视图 ---
function renderCardList(tasks) {
  const list = document.getElementById('taskList');
  const now = new Date();
  list.innerHTML = '';

  tasks.forEach(function (task) {
    const meta = taskMetaHtml(task, now);
    const li = document.createElement('li');
    li.className = 'task-item priority-' + task.priority + (task.status === 'done' ? ' done' : '') + (meta.overdue ? ' overdue' : '');

    li.innerHTML =
      '<label class="task-check"><input type="checkbox" ' + (task.status === 'done' ? 'checked' : '') + '></label>' +
      '<div class="task-body">' +
        '<div class="task-title">' + escapeHtml(task.title) + '</div>' +
        '<div class="task-meta">' + meta.html +
          '<span class="badge badge-status-' + task.status + '">' + STATUS_LABEL[task.status] + '</span>' +
        '</div>' +
        (task.notes ? '<div class="task-notes">' + escapeHtml(task.notes) + '</div>' : '') +
      '</div>' +
      '<div class="task-actions">' +
        '<button class="icon-btn edit-btn" title="编辑">✏️</button>' +
        '<button class="icon-btn delete-btn" title="删除">🗑️</button>' +
      '</div>';

    li.querySelector('input[type=checkbox]').addEventListener('change', function (e) {
      toggleTaskDone(task.id, e.target.checked);
    });
    li.querySelector('.edit-btn').addEventListener('click', function () { editTask(task.id); });
    li.querySelector('.delete-btn').addEventListener('click', function () { deleteTask(task.id); });

    list.appendChild(li);
  });
}

// --- 表格视图 ---
function renderTable(tasks) {
  const tbody = document.getElementById('taskTableBody');
  const now = new Date();
  tbody.innerHTML = '';

  tasks.forEach(function (task) {
    const meta = taskMetaHtml(task, now);
    const tr = document.createElement('tr');
    tr.className = task.status === 'done' ? 'done' : '';

    tr.innerHTML =
      '<td class="table-title-cell">' + escapeHtml(task.title) +
        (task.notes ? '<div class="task-notes">' + escapeHtml(task.notes) + '</div>' : '') +
      '</td>' +
      '<td><span class="badge badge-priority">' + (PRIORITY_LABEL[task.priority] || task.priority) + '</span></td>' +
      '<td>📅 ' + task.dueDate + ' ' + task.dueTime + (meta.overdue ? ' <span class="badge badge-overdue">已逾期</span>' : '') + '</td>' +
      '<td></td>' +
      '<td class="col-actions"><button class="icon-btn edit-btn" title="编辑">✏️</button><button class="icon-btn delete-btn" title="删除">🗑️</button></td>';

    const statusSelect = document.createElement('select');
    statusSelect.className = 'status-select';
    STATUS_ORDER.forEach(function (s) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = STATUS_LABEL[s];
      if (s === task.status) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.addEventListener('change', function () {
      moveTaskStatus(task.id, statusSelect.value);
    });
    tr.children[3].appendChild(statusSelect);

    tr.querySelector('.edit-btn').addEventListener('click', function () { editTask(task.id); });
    tr.querySelector('.delete-btn').addEventListener('click', function () { deleteTask(task.id); });

    tbody.appendChild(tr);
  });
}

// --- 看板视图 ---
function renderKanban(tasks) {
  const now = new Date();
  const columns = {
    todo: document.getElementById('kanbanTodo'),
    doing: document.getElementById('kanbanDoing'),
    done: document.getElementById('kanbanDone'),
  };
  Object.keys(columns).forEach(function (s) { columns[s].innerHTML = ''; });

  STATUS_ORDER.forEach(function (status) {
    const columnTasks = tasks.filter(function (t) { return t.status === status; });
    document.getElementById('count' + status.charAt(0).toUpperCase() + status.slice(1)).textContent = columnTasks.length;

    columnTasks.forEach(function (task) {
      const meta = taskMetaHtml(task, now);
      const idx = STATUS_ORDER.indexOf(status);
      const card = document.createElement('div');
      card.className = 'kanban-card priority-' + task.priority;
      card.draggable = true;
      card.dataset.taskId = task.id;

      card.innerHTML =
        '<div class="kanban-card-title">' + escapeHtml(task.title) + '</div>' +
        '<div class="kanban-card-meta">' + meta.html + '</div>' +
        (task.notes ? '<div class="kanban-card-notes">' + escapeHtml(task.notes) + '</div>' : '') +
        '<div class="kanban-card-actions">' +
          '<div class="kanban-move-group">' +
            '<button class="icon-btn move-btn move-left" title="移到上一栏" ' + (idx === 0 ? 'disabled' : '') + '>◀</button>' +
            '<button class="icon-btn move-btn move-right" title="移到下一栏" ' + (idx === STATUS_ORDER.length - 1 ? 'disabled' : '') + '>▶</button>' +
          '</div>' +
          '<div class="kanban-card-icons">' +
            '<button class="icon-btn edit-btn" title="编辑">✏️</button>' +
            '<button class="icon-btn delete-btn" title="删除">🗑️</button>' +
          '</div>' +
        '</div>';

      card.querySelector('.move-left').addEventListener('click', function () {
        if (idx > 0) moveTaskStatus(task.id, STATUS_ORDER[idx - 1]);
      });
      card.querySelector('.move-right').addEventListener('click', function () {
        if (idx < STATUS_ORDER.length - 1) moveTaskStatus(task.id, STATUS_ORDER[idx + 1]);
      });
      card.querySelector('.edit-btn').addEventListener('click', function () { editTask(task.id); });
      card.querySelector('.delete-btn').addEventListener('click', function () { deleteTask(task.id); });

      card.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      });

      columns[status].appendChild(card);
    });
  });

  Object.keys(columns).forEach(function (status) {
    const el = columns[status];
    el.addEventListener('dragover', function (e) {
      e.preventDefault();
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', function () {
      el.classList.remove('drag-over');
    });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      el.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) moveTaskStatus(taskId, status);
    });
  });
}

function toggleTaskDone(id, done) {
  moveTaskStatus(id, done ? 'done' : 'todo');
}

function moveTaskStatus(id, status) {
  const tasks = loadTasks();
  const t = tasks.find(function (t) { return t.id === id; });
  if (!t) return;
  t.status = status;
  if (status !== 'done') t.notifiedReminder = false; // 重新打开的任务，到期时可以再提醒一次
  saveTasks(tasks);
  render();
}

function deleteTask(id) {
  if (!confirm('确定要删除这个任务吗？')) return;
  saveTasks(loadTasks().filter(function (t) { return t.id !== id; }));
  render();
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
