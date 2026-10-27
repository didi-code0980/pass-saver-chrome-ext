let currentTab = null;
let currentDomain = '';
let allAccounts = [];

const currentDomainEl = document.getElementById('current-domain');
const chkAutofill = document.getElementById('chk-autofill');
const formPanel = document.getElementById('form-panel');
const formTitle = document.getElementById('form-title');
const editIdInp = document.getElementById('edit-id');
const domainInp = document.getElementById('inp-domain');
const userInp = document.getElementById('inp-username');
const passInp = document.getElementById('inp-password');
const searchInp = document.getElementById('inp-search');
const currentSiteSection = document.getElementById('current-site-section');
const currentSiteList = document.getElementById('current-site-list');
const allAccountsTitle = document.getElementById('all-accounts-title');
const allAccountsList = document.getElementById('all-accounts-list');
const toastEl = document.getElementById('toast');

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 1600);
}

async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0] && tabs[0].url && tabs[0].url.startsWith('http')) {
    currentTab = tabs[0];
    try {
      currentDomain = new URL(currentTab.url).hostname;
      currentDomainEl.textContent = currentDomain;
    } catch {
      currentDomainEl.textContent = 'Trang không xác định';
    }
  } else {
    currentDomainEl.textContent = 'Tab hệ thống';
  }

  const { accounts = [], autoFillEnabled = true } = await chrome.storage.local.get([
    'accounts',
    'autoFillEnabled'
  ]);
  allAccounts = accounts;
  chkAutofill.checked = autoFillEnabled;

  renderLists();
}

function renderLists() {
  const query = searchInp.value.trim().toLowerCase();

  // Lọc cho trang hiện tại
  const currentMatched = currentDomain
    ? allAccounts.filter(a => a.domain === currentDomain)
    : [];

  if (currentMatched.length > 0 && !query) {
    currentSiteSection.classList.remove('hidden');
    currentSiteList.innerHTML = '';
    currentMatched.forEach(acc => {
      currentSiteList.appendChild(createAccountCard(acc, true));
    });
  } else {
    currentSiteSection.classList.add('hidden');
  }

  // Lọc tất cả tài khoản theo từ khóa tìm kiếm
  const filtered = allAccounts.filter(
    a =>
      a.domain.toLowerCase().includes(query) ||
      a.username.toLowerCase().includes(query)
  );

  allAccountsTitle.textContent = `Tất cả tài khoản đã lưu (${filtered.length})`;
  allAccountsList.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = query
      ? 'Không tìm thấy tài khoản nào khớp từ khóa.'
      : 'Chưa có tài khoản nào được lưu.<br/>Hãy đăng nhập trên web hoặc bấm <b>"＋ Thêm"</b> ở góc trên.';
    allAccountsList.appendChild(empty);
    return;
  }

  filtered.forEach(acc => {
    allAccountsList.appendChild(createAccountCard(acc, false));
  });
}

function createAccountCard(acc, isCurrentSite) {
  const card = document.createElement('div');
  card.className = 'account-card';

  const top = document.createElement('div');
  top.className = 'card-top';

  const domainSpan = document.createElement('span');
  domainSpan.className = 'card-domain';
  domainSpan.textContent = acc.domain;

  const passSpan = document.createElement('span');
  passSpan.className = 'card-pass';
  let passVisible = false;
  passSpan.textContent = '••••••••';

  top.appendChild(domainSpan);
  top.appendChild(passSpan);

  const userDiv = document.createElement('div');
  userDiv.className = 'card-user';
  userDiv.textContent = acc.username;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  // Nút Điền vào trang
  if (currentDomain && (isCurrentSite || acc.domain === currentDomain)) {
    const btnFill = document.createElement('button');
    btnFill.className = 'chip-btn chip-fill';
    btnFill.textContent = '⚡ Điền';
    btnFill.addEventListener('click', () => fillIntoCurrentTab(acc));
    actions.appendChild(btnFill);
  }

  // Nút Copy User
  const btnCopyUser = document.createElement('button');
  btnCopyUser.className = 'chip-btn';
  btnCopyUser.textContent = 'Copy User';
  btnCopyUser.addEventListener('click', async () => {
    await navigator.clipboard.writeText(acc.username);
    showToast('Đã copy tài khoản!');
  });
  actions.appendChild(btnCopyUser);

  // Nút Copy Pass
  const btnCopyPass = document.createElement('button');
  btnCopyPass.className = 'chip-btn';
  btnCopyPass.textContent = 'Copy Pass';
  btnCopyPass.addEventListener('click', async () => {
    await navigator.clipboard.writeText(acc.password);
    showToast('Đã copy mật khẩu!');
  });
  actions.appendChild(btnCopyPass);

  // Nút Hiện/Ẩn Pass
  const btnTogglePass = document.createElement('button');
  btnTogglePass.className = 'chip-btn';
  btnTogglePass.textContent = '👁';
  btnTogglePass.title = 'Xem mật khẩu';
  btnTogglePass.addEventListener('click', () => {
    passVisible = !passVisible;
    passSpan.textContent = passVisible ? acc.password : '••••••••';
  });
  actions.appendChild(btnTogglePass);

  // Nút Sửa
  const btnEdit = document.createElement('button');
  btnEdit.className = 'chip-btn';
  btnEdit.textContent = '✎';
  btnEdit.title = 'Chỉnh sửa';
  btnEdit.addEventListener('click', () => openEditForm(acc));
  actions.appendChild(btnEdit);

  // Nút Xóa
  const btnDel = document.createElement('button');
  btnDel.className = 'chip-btn chip-danger';
  btnDel.textContent = '🗑';
  btnDel.title = 'Xóa tài khoản';
  btnDel.addEventListener('click', () => deleteAccount(acc.id));
  actions.appendChild(btnDel);

  card.appendChild(top);
  card.appendChild(userDiv);
  card.appendChild(actions);

  return card;
}

async function fillIntoCurrentTab(acc) {
  if (!currentTab) return;
  try {
    await chrome.tabs.sendMessage(currentTab.id, {
      action: 'FILL_CREDENTIALS',
      username: acc.username,
      password: acc.password
    });
    showToast('Đã điền thông tin!');
  } catch {
    showToast('Không tìm thấy ô đăng nhập trên trang!');
  }
}

function openAddForm() {
  formTitle.textContent = 'Thêm tài khoản mới';
  editIdInp.value = '';
  domainInp.value = currentDomain || '';
  userInp.value = '';
  passInp.value = '';
  passInp.type = 'password';
  formPanel.classList.remove('hidden');
  userInp.focus();
}

function openEditForm(acc) {
  formTitle.textContent = 'Chỉnh sửa tài khoản';
  editIdInp.value = acc.id;
  domainInp.value = acc.domain;
  userInp.value = acc.username;
  passInp.value = acc.password;
  passInp.type = 'password';
  formPanel.classList.remove('hidden');
  userInp.focus();
}

async function deleteAccount(id) {
  allAccounts = allAccounts.filter(a => a.id !== id);
  await chrome.storage.local.set({ accounts: allAccounts });
  renderLists();
  showToast('Đã xóa tài khoản');
}

// Sự kiện nút Thêm / Lưu / Hủy
document.getElementById('btn-toggle-add').addEventListener('click', () => {
  if (formPanel.classList.contains('hidden')) {
    openAddForm();
  } else {
    formPanel.classList.add('hidden');
  }
});

document.getElementById('btn-cancel').addEventListener('click', () => {
  formPanel.classList.add('hidden');
});

document.getElementById('btn-eye').addEventListener('click', () => {
  passInp.type = passInp.type === 'password' ? 'text' : 'password';
});

document.getElementById('btn-save').addEventListener('click', async () => {
  const domain = domainInp.value.trim().replace(/^https?:\/\//, '').split('/')[0];
  const username = userInp.value.trim();
  const password = passInp.value;
  const editId = editIdInp.value;

  if (!domain || !password) {
    showToast('Vui lòng nhập Domain và Mật khẩu!');
    return;
  }

  const now = Date.now();
  if (editId) {
    const idx = allAccounts.findIndex(a => a.id === editId);
    if (idx >= 0) {
      allAccounts[idx] = {
        ...allAccounts[idx],
        domain,
        username: username || '(Không tên)',
        password,
        updatedAt: now
      };
    }
  } else {
    const existingIdx = allAccounts.findIndex(
      a => a.domain === domain && a.username.toLowerCase() === (username || '(Không tên)').toLowerCase()
    );
    if (existingIdx >= 0) {
      allAccounts[existingIdx].password = password;
      allAccounts[existingIdx].updatedAt = now;
    } else {
      allAccounts.unshift({
        id: crypto.randomUUID ? crypto.randomUUID() : String(now + Math.random()),
        domain,
        url: `https://${domain}`,
        username: username || '(Không tên)',
        password,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  await chrome.storage.local.set({ accounts: allAccounts });
  formPanel.classList.add('hidden');
  renderLists();
  showToast('Đã lưu thành công!');
});

// Tìm kiếm
searchInp.addEventListener('input', renderLists);

// Bật/tắt tự động điền
chkAutofill.addEventListener('change', async () => {
  await chrome.storage.local.set({ autoFillEnabled: chkAutofill.checked });
  showToast(chkAutofill.checked ? 'Đã bật tự động điền' : 'Đã tắt tự động điền');
});

// Xuất file JSON
document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(allAccounts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quickpass-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Nhập file JSON
const fileImport = document.getElementById('file-import');
document.getElementById('btn-import').addEventListener('click', () => {
  fileImport.click();
});

fileImport.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');

      let count = 0;
      imported.forEach(item => {
        if (item.domain && item.password) {
          const exists = allAccounts.find(
            a => a.domain === item.domain && a.username === item.username
          );
          if (!exists) {
            allAccounts.push({
              id: item.id || String(Date.now() + Math.random()),
              domain: item.domain,
              url: item.url || `https://${item.domain}`,
              username: item.username || '(Không tên)',
              password: item.password,
              createdAt: item.createdAt || Date.now(),
              updatedAt: Date.now()
            });
            count++;
          }
        }
      });

      await chrome.storage.local.set({ accounts: allAccounts });
      renderLists();
      showToast(`Đã nhập thêm ${count} tài khoản!`);
    } catch {
      showToast('File JSON không hợp lệ!');
    }
    fileImport.value = '';
  };
  reader.readAsText(file);
});

init();
