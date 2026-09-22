# 任务管理器模板（Claude Code 教学用）

一个纯前端（HTML / CSS / JS，无需安装依赖）的任务管理小工具，带有登录页面和「绑定 WhatsApp 到期提醒」功能。用作 Claude Code 课程的起始模板，学员可以在此基础上继续加功能、接真实后端。

## 怎么运行

不需要安装任何东西，两种方式都行：

1. 直接双击 `index.html` 用浏览器打开。
2. 或者在项目目录下起一个本地静态服务器（推荐，某些浏览器通知权限在 `file://` 下行为会不一致）：

   ```bash
   python3 -m http.server 8000
   ```

   然后打开 `http://localhost:8000`。

## 登录信息（Mock）

- 账号：`1234`
- 密码：`1234`

账号密码写死在 [`js/auth.js`](js/auth.js) 里，登录状态存在浏览器的 `sessionStorage`。这是**故意简化**的假登录，用来演示流程，不是真实的身份验证方式。

## 功能

- **任务管理**：新增 / 编辑 / 删除 / 勾选完成，可设置标题、截止日期时间、优先级、备注。
- **筛选**：全部 / 今日 / 未完成 / 已完成。
- **数据存储**：任务和设置都存在浏览器的 `localStorage`，刷新页面不会丢，但换浏览器 / 换设备不会同步。
- **WhatsApp 到期提醒（Mock）**：在「设置」页绑定一个 WhatsApp 号码，选择提前多久提醒，系统会每 20 秒检查一次任务，快到期时在「提醒记录」里模拟写入一条“已发送”的消息，并尝试弹出浏览器通知。**不会真的发到 WhatsApp。**

## 项目结构

```
task-reminder-template/
├── index.html          # 登录页
├── dashboard.html       # 主界面（任务列表 + WhatsApp 设置）
├── css/style.css        # 全站样式
├── js/
│   ├── auth.js           # 模拟登录 / 登出
│   ├── tasks.js           # 任务增删改查、渲染
│   └── reminder.js        # WhatsApp 绑定 + 模拟提醒引擎
└── README.md
```

## 给学员的练习方向

这个模板刻意留了很多「假的」部分，方便你在 Claude Code 里练习把它变成真的：

1. **真实登录**：接一个后端（或 Firebase / Supabase 等 BaaS），做真正的账号密码校验和多用户支持，别再把密码写死在前端。
2. **真实 WhatsApp 发送**：`js/reminder.js` 里的 `sendWhatsAppMessage()` 函数有清楚的 `TODO` 注释——把它换成调用你自己的后端接口，再由后端调 [WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp) 或 Twilio 等服务发送消息。**切记：WhatsApp / Twilio 的密钥绝对不能放在前端代码里。**
3. **真实定时检查**：现在是浏览器每 20 秒轮询一次，只有页面开着才会提醒。真实产品应该把「检查任务是否到期」放到后端的排程任务（cron job / Cloud Scheduler）里。
4. **数据持久化**：把 `localStorage` 换成真实数据库，让任务能跨设备同步。
5. **多用户 / 团队协作**：任务分配给不同用户、共享任务列表等。

## 注意事项

- 本模板是**教学 Mock**，登录机制和 WhatsApp 发送都不安全 / 不真实，请勿直接部署为生产环境使用的产品。
- 浏览器通知需要用户授权；如果没有弹出通知也没关系，「提醒记录」列表是主要的演示方式。
