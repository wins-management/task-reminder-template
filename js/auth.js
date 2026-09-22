// 模拟登录（Mock Auth）
// 教学用途：账号密码写死在这里，登录状态存在 sessionStorage。
// 真实项目请换成后端验证 + 安全的 session/token 机制。

const MOCK_USER = { username: '1234', password: '1234' };

function login(username, password) {
  if (username === MOCK_USER.username && password === MOCK_USER.password) {
    sessionStorage.setItem('tm_logged_in', 'true');
    sessionStorage.setItem('tm_username', username);
    return true;
  }
  return false;
}

function isLoggedIn() {
  return sessionStorage.getItem('tm_logged_in') === 'true';
}

function logout() {
  sessionStorage.removeItem('tm_logged_in');
  sessionStorage.removeItem('tm_username');
  window.location.href = 'index.html';
}

function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
  }
}
