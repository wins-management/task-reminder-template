# 任务管理器模板（Claude Code 教学用）

一个任务管理小工具，带有登录页面，以及「扫码把自己的 WhatsApp 挂上去、任务快到期时提醒自己」的功能。用作 Claude Code 课程的起始模板，学员可以在此基础上继续加功能。

项目分两部分：

- **前端**：纯静态 HTML / CSS / JS，不需要安装依赖，负责登录、任务管理、UI。
- **后端**（`server/` 目录）：一个小型 Node.js 服务，用 [Baileys](https://github.com/WhiskeySockets/Baileys)（开源、非官方的 WhatsApp Web 协议实现）连接 WhatsApp，方式跟你在浏览器打开 web.whatsapp.com 扫码是一样的。连接后，到期提醒会以消息形式发到**你自己的聊天**里。

> ⚠️ 这是非官方实现，**只适合自己对自己发提醒**，请勿用来批量发送、营销或自动回复陌生人，容易触发 WhatsApp 的风控甚至封号。真的要做商用批量发送，请改用官方 [WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp)。

## 怎么运行

### 1. 前端

直接双击 `index.html`，或起一个本地静态服务器（推荐）：

```bash
python3 -m http.server 8000
```

然后打开 `http://localhost:8000`。

### 2. WhatsApp 提醒后端

```bash
cd server
npm install
npm start
```

服务默认跑在 `http://localhost:3001`。第一次启动后，去前端「📱 WhatsApp 提醒设置」页面，会看到一个二维码，用手机 WhatsApp 的「设置 → 已连接的设备 → 连接设备」扫描它，跟连接 WhatsApp Web 网页版一样。连上之后状态会变成「已连接」。

连接信息会存在 `server/auth_info/` 里（已加入 `.gitignore`，不会被提交），下次启动服务不用重新扫码，除非你在手机上解除了连接。

## 登录信息（Mock）

- 账号：`1234`
- 密码：`1234`

账号密码写死在 [`js/auth.js`](js/auth.js) 里，登录状态存在浏览器的 `sessionStorage`。这是**故意简化**的假登录，用来演示流程，不是真实的身份验证方式。

## 功能

- **任务管理**：新增 / 编辑 / 删除 / 勾选完成，可设置标题、截止日期时间、优先级、备注。
- **筛选**：全部 / 今日 / 未完成 / 已完成。
- **数据存储**：任务和提醒设置都存在浏览器的 `localStorage`，刷新页面不会丢，但换浏览器 / 换设备不会同步。
- **WhatsApp 到期提醒**：扫码连接后，浏览器每 20 秒检查一次任务，快到期时会呼叫本地后端的 `/api/send`，由后端通过 WhatsApp 把提醒发到你自己的聊天里，并记录在页面的「提醒记录」列表中。

## 项目结构

```
task-reminder-template/
├── index.html            # 登录页
├── dashboard.html         # 主界面（任务列表 + WhatsApp 设置）
├── css/style.css          # 全站样式
├── js/
│   ├── auth.js              # 模拟登录 / 登出
│   ├── tasks.js              # 任务增删改查、渲染
│   └── reminder.js            # 轮询后端连接状态、显示二维码、触发提醒
├── server/                # WhatsApp 连接后端
│   ├── package.json
│   ├── server.js             # Express + Baileys：连接、生成二维码、发送消息
│   └── auth_info/            # 运行后自动生成，存 WhatsApp 会话（已 gitignore）
└── README.md
```

## 给学员的练习方向

这个模板刻意留了一些简化的部分，方便你在 Claude Code 里练习把它变成更完整的产品：

1. **真实登录**：接一个后端（或 Firebase / Supabase 等 BaaS），做真正的账号密码校验和多用户支持，别再把密码写死在前端。
2. **真实定时检查**：现在是浏览器每 20 秒轮询一次，只有页面开着才会提醒。可以把「检查任务是否到期」也搬到 `server/` 后端，用 `node-cron` 之类的排程库定时跑，这样浏览器不开也能收到提醒。
3. **数据持久化**：把 `localStorage` 换成真实数据库（比如 SQLite / Postgres），让任务能跨设备同步，也方便后端排程读取任务。
4. **多用户 / 团队协作**：任务分配给不同用户、共享任务列表、每个用户各自的 WhatsApp 连接等。
5. **部署上线**：`server/` 目前只适合本地跑。如果要部署到云端长期运行，要考虑会话持久化、断线重连、以及不把它暴露成公开可调用的发送接口（现在 `/api/send` 没有任何身份验证，只适合本地个人使用）。

## 注意事项

- 本模板是**教学用途**，登录机制是 Mock 的；WhatsApp 连接虽然是真的，但用的是非官方协议实现，仅适合个人自用，请勿用于生产环境或批量/商用场景。
- `server/api/send` 目前没有任何鉴权，任何能访问你本机 3001 端口的程序都能借你的 WhatsApp 发消息，仅适合本地开发环境使用。
