(() => {
  const PENDING_KEY = 'pendingSave';
  let lastAttemptTime = 0;

  // Tìm trường username tương ứng với trường password
  function findUsernameInput(passwordInput) {
    const form = passwordInput.closest('form') || document.body;
    const candidates = Array.from(
      form.querySelectorAll(
        'input[type="text"], input[type="email"], input[type="tel"], input:not([type])'
      )
    ).filter(el => {
      if (el.disabled || el.readOnly || el.type === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    // Ưu tiên các input nằm trước passwordInput trong DOM
    let best = null;
    for (const input of candidates) {
      const pos = input.compareDocumentPosition(passwordInput);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        best = input;
      }
    }

    if (best) return best;
    return candidates[0] || null;
  }

  // Gán giá trị tương thích với React / Vue / Angular
  function setNativeValue(element, value) {
    if (!element) return;
    element.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(
      prototype,
      'value'
    )?.set;

    if (valueSetter && valueSetter !== prototypeValueSetter && prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
  }

  // Điền thông tin vào form
  function fillCredentials(username, password, targetPassInput = null) {
    const passInputs = targetPassInput
      ? [targetPassInput]
      : Array.from(document.querySelectorAll('input[type="password"]')).filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && !el.disabled;
        });

    if (passInputs.length === 0) return false;

    const passInput = passInputs[0];
    const userInput = findUsernameInput(passInput);

    if (userInput && username) {
      setNativeValue(userInput, username);
    }
    if (passInput && password) {
      setNativeValue(passInput, password);
    }
    return true;
  }

  // Kiểm tra xem tài khoản đã được lưu với đúng mật khẩu chưa
  async function checkSavedAccount(domain, username, password) {
    const { accounts = [] } = await chrome.storage.local.get('accounts');
    const existing = accounts.find(
      a => a.domain === domain && a.username.toLowerCase() === username.toLowerCase()
    );
    if (!existing) return { status: 'new' };
    if (existing.password !== password) return { status: 'update', existing };
    return { status: 'exact', existing };
  }

  // Lưu hoặc cập nhật tài khoản vào chrome.storage.local
  async function saveAccountToStorage(domain, url, username, password) {
    const { accounts = [] } = await chrome.storage.local.get('accounts');
    const idx = accounts.findIndex(
      a => a.domain === domain && a.username.toLowerCase() === username.toLowerCase()
    );

    const now = Date.now();
    if (idx >= 0) {
      accounts[idx].password = password;
      accounts[idx].url = url;
      accounts[idx].updatedAt = now;
    } else {
      accounts.unshift({
        id: crypto.randomUUID ? crypto.randomUUID() : String(now + Math.random()),
        domain,
        url,
        username,
        password,
        createdAt: now,
        updatedAt: now
      });
    }

    await chrome.storage.local.set({ accounts });
  }

  // Hiển thị hộp thoại hỏi "Lưu mật khẩu?" ở góc phải trên cùng (dùng Shadow DOM)
  function showSaveBanner({ domain, url, username, password, isUpdate }) {
    const existingHost = document.getElementById('qp-saver-banner-host');
    if (existingHost) existingHost.remove();

    const host = document.createElement('div');
    host.id = 'qp-saver-banner-host';
    host.style.cssText = 'all: initial; position: fixed; top: 16px; right: 16px; z-index: 2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <style>
        .card {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          width: 320px;
          background: #1e293b;
          color: #f8fafc;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1);
          padding: 16px;
          font-size: 13px;
          animation: slideIn 0.25s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .title {
          font-weight: 600;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #60a5fa;
        }
        .close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .close-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.1);
        }
        .domain {
          font-size: 11px;
          color: #94a3b8;
          margin-bottom: 10px;
          word-break: break-all;
        }
        .field {
          margin-bottom: 8px;
        }
        .field label {
          display: block;
          font-size: 11px;
          color: #cbd5e1;
          margin-bottom: 3px;
        }
        .field input {
          width: 100%;
          box-sizing: border-box;
          padding: 7px 10px;
          border-radius: 6px;
          border: 1px solid #334155;
          background: #0f172a;
          color: #f8fafc;
          font-size: 13px;
          outline: none;
        }
        .field input:focus {
          border-color: #3b82f6;
        }
        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 12px;
        }
        .btn {
          padding: 7px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        .btn-cancel {
          background: #334155;
          color: #e2e8f0;
        }
        .btn-cancel:hover {
          background: #475569;
        }
        .btn-save {
          background: #2563eb;
          color: #ffffff;
        }
        .btn-save:hover {
          background: #1d4ed8;
        }
      </style>
      <div class="card">
        <div class="header">
          <div class="title">
            <span>🔐</span>
            <span>${isUpdate ? 'Cập nhật mật khẩu?' : 'Lưu mật khẩu?'}</span>
          </div>
          <button class="close-btn" id="qp-close" title="Đóng">✕</button>
        </div>
        <div class="domain">${domain}</div>
        <div class="field">
          <label>Tài khoản</label>
          <input type="text" id="qp-user" value="" placeholder="Tên đăng nhập / Email" />
        </div>
        <div class="field">
          <label>Mật khẩu</label>
          <input type="password" id="qp-pass" value="" />
        </div>
        <div class="actions">
          <button class="btn btn-cancel" id="qp-never">Bỏ qua</button>
          <button class="btn btn-save" id="qp-save">${isUpdate ? 'Cập nhật' : 'Lưu lại'}</button>
        </div>
      </div>
    `;

    shadow.appendChild(wrapper);
    document.documentElement.appendChild(host);

    const userInputEl = shadow.getElementById('qp-user');
    const passInputEl = shadow.getElementById('qp-pass');
    userInputEl.value = username || '';
    passInputEl.value = password || '';

    const cleanup = async () => {
      host.remove();
      await chrome.storage.local.remove(PENDING_KEY);
    };

    shadow.getElementById('qp-close').addEventListener('click', cleanup);
    shadow.getElementById('qp-never').addEventListener('click', cleanup);

    shadow.getElementById('qp-save').addEventListener('click', async () => {
      const finalUser = userInputEl.value.trim();
      const finalPass = passInputEl.value;
      if (finalPass) {
        await saveAccountToStorage(domain, url, finalUser || '(Không tên)', finalPass);
      }
      await cleanup();
    });
  }

  // Bắt sự kiện người dùng chuẩn bị submit form đăng nhập
  async function handleLoginAttempt(passInput) {
    const now = Date.now();
    if (now - lastAttemptTime < 800) return;
    lastAttemptTime = now;

    const password = passInput.value;
    if (!password) return;

    const userInput = findUsernameInput(passInput);
    const username = userInput ? userInput.value.trim() : '';
    const domain = window.location.hostname;
    const url = window.location.origin;

    if (!domain) return;

    const check = await checkSavedAccount(domain, username, password);
    if (check.status === 'exact') return; // Đã lưu chính xác rồi thì không hỏi nữa

    const pendingData = {
      domain,
      url,
      username,
      password,
      isUpdate: check.status === 'update',
      timestamp: now
    };

    // Lưu tạm vào storage phòng trường hợp trang web reload/redirect ngay sau khi submit
    await chrome.storage.local.set({ [PENDING_KEY]: pendingData });

    // Nếu là SPA (không reload trang), hiển thị banner sau 600ms
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        showSaveBanner(pendingData);
      }
    }, 600);
  }

  // Lắng nghe sự kiện submit, nhấn Enter hoặc click nút Đăng nhập
  document.addEventListener(
    'submit',
    e => {
      const form = e.target;
      if (form && form.querySelector) {
        const passInput = form.querySelector('input[type="password"]');
        if (passInput && passInput.value) {
          handleLoginAttempt(passInput);
        }
      }
    },
    true
  );

  document.addEventListener(
    'keydown',
    e => {
      if (e.key === 'Enter') {
        const active = document.activeElement;
        if (active && active.tagName === 'INPUT') {
          if (active.type === 'password' && active.value) {
            handleLoginAttempt(active);
          } else {
            const form = active.closest('form');
            const passInput = form ? form.querySelector('input[type="password"]') : null;
            if (passInput && passInput.value) {
              handleLoginAttempt(passInput);
            }
          }
        }
      }
    },
    true
  );

  document.addEventListener(
    'click',
    e => {
      const target = e.target.closest('button, input[type="submit"], a[role="button"]');
      if (!target) return;
      const passInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(
        el => el.value
      );
      if (passInputs.length > 0) {
        handleLoginAttempt(passInputs[0]);
      }
    },
    true
  );

  // Kiểm tra xem có pendingSave từ trang trước vừa chuyển hướng sang không
  async function checkPendingSaveOnLoad() {
    const data = await chrome.storage.local.get(PENDING_KEY);
    const pending = data[PENDING_KEY];
    if (!pending) return;

    const age = Date.now() - pending.timestamp;
    if (age < 25000 && pending.domain === window.location.hostname) {
      const check = await checkSavedAccount(pending.domain, pending.username, pending.password);
      if (check.status !== 'exact') {
        showSaveBanner({
          ...pending,
          isUpdate: check.status === 'update'
        });
      } else {
        await chrome.storage.local.remove(PENDING_KEY);
      }
    } else if (age >= 25000) {
      await chrome.storage.local.remove(PENDING_KEY);
    }
  }

  // Hiển thị menu gợi ý chọn tài khoản nhanh khi focus vào ô input
  let suggestionHost = null;

  function removeSuggestionMenu() {
    if (suggestionHost) {
      suggestionHost.remove();
      suggestionHost = null;
    }
  }

  function showSuggestionMenu(targetInput, matchedAccounts, passInput) {
    removeSuggestionMenu();
    if (!matchedAccounts || matchedAccounts.length === 0) return;

    const rect = targetInput.getBoundingClientRect();
    suggestionHost = document.createElement('div');
    suggestionHost.style.cssText = `
      all: initial;
      position: fixed;
      top: ${Math.min(rect.bottom + 4, window.innerHeight - 160)}px;
      left: ${Math.max(8, Math.min(rect.left, window.innerWidth - 260))}px;
      z-index: 2147483646;
    `;
    const shadow = suggestionHost.attachShadow({ mode: 'open' });

    const menu = document.createElement('div');
    menu.innerHTML = `
      <style>
        .menu {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #1e293b;
          color: #f8fafc;
          border-radius: 8px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.12);
          min-width: 220px;
          max-width: 300px;
          overflow: hidden;
          font-size: 12px;
        }
        .header {
          padding: 6px 10px;
          background: #0f172a;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .item {
          padding: 8px 10px;
          cursor: pointer;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .item:hover {
          background: #2563eb;
        }
        .user {
          font-weight: 600;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pass-dots {
          color: #94a3b8;
          font-size: 10px;
        }
        .item:hover .pass-dots {
          color: #dbeafe;
        }
      </style>
      <div class="menu">
        <div class="header">
          <span>🔑 Điền nhanh (${matchedAccounts.length})</span>
        </div>
        <div id="qp-list"></div>
      </div>
    `;

    const listEl = menu.querySelector('#qp-list');
    matchedAccounts.forEach(acc => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <div class="user"></div>
        <div class="pass-dots">••••••••</div>
      `;
      item.querySelector('.user').textContent = acc.username;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        fillCredentials(acc.username, acc.password, passInput);
        removeSuggestionMenu();
      });
      listEl.appendChild(item);
    });

    shadow.appendChild(menu);
    document.documentElement.appendChild(suggestionHost);
  }

  // Tự động điền khi trang tải xong nếu có 1 tài khoản (hoặc tài khoản dùng gần nhất)
  async function autoFillOnPageLoad() {
    const domain = window.location.hostname;
    if (!domain) return;

    const { accounts = [], autoFillEnabled = true } = await chrome.storage.local.get([
      'accounts',
      'autoFillEnabled'
    ]);

    const matched = accounts.filter(a => a.domain === domain);
    if (matched.length === 0) return;

    const passInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(
      el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !el.disabled;
      }
    );

    if (passInputs.length > 0 && autoFillEnabled) {
      const passInput = passInputs[0];
      if (!passInput.value) {
        fillCredentials(matched[0].username, matched[0].password, passInput);
      }
    }
  }

  // Khi người dùng click/focus vào ô username hoặc password thì hiện menu chọn nhanh
  document.addEventListener(
    'focusin',
    async e => {
      const target = e.target;
      if (!target || target.tagName !== 'INPUT') return;

      const domain = window.location.hostname;
      if (!domain) return;

      const { accounts = [] } = await chrome.storage.local.get('accounts');
      const matched = accounts.filter(a => a.domain === domain);
      if (matched.length === 0) return;

      if (target.type === 'password') {
        showSuggestionMenu(target, matched, target);
      } else if (['text', 'email', 'tel', ''].includes(target.type)) {
        const form = target.closest('form') || document.body;
        const passInput = form.querySelector('input[type="password"]');
        if (passInput && findUsernameInput(passInput) === target) {
          showSuggestionMenu(target, matched, passInput);
        }
      }
    },
    true
  );

  document.addEventListener('mousedown', e => {
    if (suggestionHost && !suggestionHost.contains(e.target)) {
      removeSuggestionMenu();
    }
  });

  window.addEventListener('scroll', removeSuggestionMenu, true);

  // Nhận lệnh điền từ Popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'FILL_CREDENTIALS') {
      const ok = fillCredentials(msg.username, msg.password);
      sendResponse({ success: ok });
    }
    return true;
  });

  // Khởi chạy
  checkPendingSaveOnLoad();
  setTimeout(autoFillOnPageLoad, 500);
})();
