/**
 * Kslit frontend — guest login page, then upload / gallery / users.
 */

const els = {
  viewLogin: document.getElementById('view-login'),
  appShell: document.getElementById('app-shell'),
  loginHeading: document.getElementById('login-heading'),
  loginSub: document.getElementById('login-sub'),
  tabUpload: document.getElementById('tab-upload'),
  tabGallery: document.getElementById('tab-gallery'),
  tabUsers: document.getElementById('tab-users'),
  viewUpload: document.getElementById('view-upload'),
  viewGallery: document.getElementById('view-gallery'),
  viewUsers: document.getElementById('view-users'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  uploadFolder: document.getElementById('upload-folder'),
  galleryFolder: document.getElementById('gallery-folder'),
  btnNewFolder: document.getElementById('btn-new-folder'),
  progress: document.getElementById('upload-progress'),
  results: document.getElementById('upload-results'),
  galleryGrid: document.getElementById('gallery-grid'),
  galleryStatus: document.getElementById('gallery-status'),
  btnMore: document.getElementById('btn-more'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnAuth: document.getElementById('btn-auth'),
  authOverlay: document.getElementById('auth-overlay'),
  authTitle: document.getElementById('auth-title'),
  authHint: document.getElementById('auth-hint'),
  authForm: document.getElementById('auth-form'),
  authCurrentUser: document.getElementById('auth-current-user'),
  authUsername: document.getElementById('auth-username'),
  authPassword: document.getElementById('auth-password'),
  btnAuthSubmit: document.getElementById('btn-auth-submit'),
  btnLogout: document.getElementById('btn-logout'),
  btnCloseAuthIn: document.getElementById('btn-close-auth-in'),
  formCreateUser: document.getElementById('form-create-user'),
  newUsername: document.getElementById('new-username'),
  newPassword: document.getElementById('new-password'),
  newRole: document.getElementById('new-role'),
  usersStatus: document.getElementById('users-status'),
  usersList: document.getElementById('users-list'),
  btnRefreshUsers: document.getElementById('btn-refresh-users'),
  toast: document.getElementById('toast'),
};

const state = {
  view: 'upload',
  cursor: null,
  loadingGallery: false,
  galleryLoaded: false,
  user: null,
  needSetup: false,
  authEnabled: false,
  usersLoaded: false,
  folders: [],
  foldersLoaded: false,
  uploadFolder: '',
  galleryFolder: '',
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

let toastTimer;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2200);
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const prev = button.textContent;
      button.classList.add('is-copied');
      button.textContent = '已复制';
      setTimeout(() => {
        button.classList.remove('is-copied');
        button.textContent = prev;
      }, 1200);
    } else {
      showToast('已复制到剪贴板');
    }
  } catch {
    showToast('复制失败，请手动选择');
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

function showLoginScreen() {
  document.body.classList.remove('is-booting');
  els.viewLogin.hidden = false;
  els.appShell.hidden = true;
  closeAccountSheet();

  if (state.needSetup) {
    els.loginHeading.textContent = '创建管理员账号';
    els.loginSub.textContent = '首次使用：账号保存在 Cloudflare D1。';
    els.btnAuthSubmit.textContent = '创建并进入';
  } else {
    els.loginHeading.textContent = '登录后开始上传';
    els.loginSub.textContent = '边缘图床 · R2 存储 · D1 账号';
    els.btnAuthSubmit.textContent = '登录';
  }

  requestAnimationFrame(() => els.authUsername?.focus());
}

function showAppShell() {
  document.body.classList.remove('is-booting');
  els.viewLogin.hidden = true;
  els.appShell.hidden = false;
  const isAdmin = state.user?.role === 'admin';
  els.tabUsers.classList.toggle('hidden', !isAdmin);
  if (state.user) {
    els.btnAuth.textContent = state.user.username;
  }
  if (!state.foldersLoaded) {
    loadFolders();
  }
  if (state.view === 'users' && !isAdmin) {
    switchView('upload');
  } else {
    switchView(state.view || 'upload');
  }
}

function updateAuthUi() {
  if (state.user) {
    showAppShell();
  } else if (state.authEnabled || state.needSetup) {
    showLoginScreen();
  } else {
    // D1 not bound — allow open app for local / misconfig visibility
    showAppShell();
  }
}

function openAccountSheet() {
  if (!state.user) return;
  els.authTitle.textContent = '账号';
  els.authHint.textContent = '当前登录信息';
  els.authCurrentUser.textContent = `${state.user.username}（${state.user.role === 'admin' ? '管理员' : '用户'}）`;
  els.authOverlay.hidden = false;
}

function closeAccountSheet() {
  els.authOverlay.hidden = true;
}

async function refreshMe() {
  const { res, data } = await api('/api/auth/me');
  if (!res.ok && data?.error) {
    showToast(data.error);
  }
  state.user = data.user || null;
  state.needSetup = Boolean(data.needSetup);
  state.authEnabled = Boolean(data.authEnabled);
  updateAuthUi();
}

function fillFolderSelects(preferredUpload) {
  const folders = state.folders || [];
  const uploadVal = preferredUpload ?? els.uploadFolder?.value ?? state.uploadFolder ?? '';
  const galleryVal = els.galleryFolder?.value ?? state.galleryFolder ?? '';

  if (els.uploadFolder) {
    els.uploadFolder.innerHTML =
      `<option value="">根目录</option>` +
      folders.map((f) => `<option value="${escapeAttr(f)}">${escapeHtml(f)}</option>`).join('');
    if (uploadVal && [...els.uploadFolder.options].some((o) => o.value === uploadVal)) {
      els.uploadFolder.value = uploadVal;
    }
    state.uploadFolder = els.uploadFolder.value;
  }

  if (els.galleryFolder) {
    els.galleryFolder.innerHTML =
      `<option value="">全部</option>` +
      folders.map((f) => `<option value="${escapeAttr(f)}">${escapeHtml(f)}</option>`).join('');
    if (galleryVal && [...els.galleryFolder.options].some((o) => o.value === galleryVal)) {
      els.galleryFolder.value = galleryVal;
    }
    state.galleryFolder = els.galleryFolder.value;
  }
}

async function loadFolders() {
  try {
    const { res, data } = await api('/api/folders');
    if (!res.ok || !data.success) {
      throw new Error(data.error || '加载文件夹失败');
    }
    state.folders = data.folders || [];
    state.foldersLoaded = true;
    fillFolderSelects();
  } catch (err) {
    console.warn(err);
    state.folders = state.folders || [];
    fillFolderSelects();
  }
}

async function createFolder() {
  const name = prompt('新文件夹名称（可含空格，如 fizzy 50k）');
  if (name == null) return;
  const trimmed = name.trim();
  if (!trimmed) {
    showToast('名称不能为空');
    return;
  }
  const { res, data } = await api('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ name: trimmed }),
  });
  if (!res.ok || !data.success) {
    showToast(data.error || '创建失败');
    return;
  }
  const folder = data.folder || trimmed;
  if (!state.folders.includes(folder)) {
    state.folders.push(folder);
    state.folders.sort((a, b) => a.localeCompare(b, 'zh'));
  }
  fillFolderSelects(folder);
  showToast(`已选择文件夹：${folder}`);
}

function getSelectedUploadFolder() {
  return (els.uploadFolder?.value || '').trim();
}

async function ensureAuthed() {
  if (state.user) return true;
  showLoginScreen();
  showToast(state.needSetup ? '请先创建管理员账号' : '请先登录');
  return false;
}

function switchView(view) {
  if (view === 'users' && state.user?.role !== 'admin') {
    showToast('需要管理员权限');
    return;
  }

  state.view = view;
  const map = {
    upload: els.viewUpload,
    gallery: els.viewGallery,
    users: els.viewUsers,
  };

  Object.entries(map).forEach(([name, el]) => {
    const on = name === view;
    el.hidden = !on;
    el.classList.toggle('is-visible', on);
  });

  els.tabUpload.classList.toggle('is-active', view === 'upload');
  els.tabGallery.classList.toggle('is-active', view === 'gallery');
  els.tabUsers.classList.toggle('is-active', view === 'users');
  els.tabUpload.setAttribute('aria-selected', String(view === 'upload'));
  els.tabGallery.setAttribute('aria-selected', String(view === 'gallery'));
  els.tabUsers.setAttribute('aria-selected', String(view === 'users'));

  if (view === 'gallery' && !state.galleryLoaded) loadGallery(true);
  if (view === 'users' && !state.usersLoaded) loadUsers();
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildFormats(data) {
  const url = data.url;
  const name = data.originalName || data.key || 'image';
  return {
    url,
    markdown: data.markdown || `![${name}](${url})`,
    html: data.html || `<img src="${url}" alt="${name}" />`,
    bbcode: data.bbcode || `[img]${url}[/img]`,
  };
}

function renderResult(data) {
  const formats = buildFormats(data);
  const item = document.createElement('article');
  item.className = 'result-item';
  const rows = [
    ['直链', formats.url],
    ['Markdown', formats.markdown],
    ['HTML', formats.html],
    ['BBCode', formats.bbcode],
  ];

  item.innerHTML = `
    <img class="result-thumb" src="${escapeAttr(formats.url)}" alt="" loading="lazy" />
    <div>
      <p class="text-sm text-ink-600 mb-3">
        <span class="font-medium text-ink-950">${escapeHtml(data.key || '')}</span>
        ${data.folder ? ` · <span class="text-tide-500">${escapeHtml(data.folder)}</span>` : ''}
        ${data.size != null ? ` · ${formatSize(data.size)}` : ''}
      </p>
      <div class="result-links">
        ${rows
          .map(
            ([label, value]) => `
          <div class="link-row">
            <label>${label}</label>
            <input type="text" readonly value="${escapeAttr(value)}" />
            <button type="button" class="copy-btn" data-copy="${escapeAttr(value)}">复制</button>
          </div>`,
          )
          .join('')}
      </div>
    </div>
  `;

  item.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => copyText(btn.dataset.copy, btn));
  });
  els.results.prepend(item);
}

function setProgress(visible, percent = 0, label = '') {
  if (!visible) {
    els.progress.classList.add('hidden');
    els.progress.innerHTML = '';
    return;
  }
  els.progress.classList.remove('hidden');
  els.progress.innerHTML = `
    <p class="mb-2 text-sm text-ink-600">${escapeHtml(label)}</p>
    <div class="progress-bar"><span style="width:${percent}%"></span></div>
  `;
}

async function uploadFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast(`已跳过非图片：${file.name || 'unknown'}`);
    return;
  }
  if (!(await ensureAuthed())) return;

  const form = new FormData();
  form.append('file', file, file.name || 'image');
  const folder = getSelectedUploadFolder();
  if (folder) form.append('folder', folder);
  setProgress(true, 15, `正在上传 ${file.name || '图片'}${folder ? ` → ${folder}` : ''}…`);
  els.dropzone.classList.add('is-busy');

  try {
    const { res, data } = await api('/api/upload', { method: 'POST', body: form });
    setProgress(true, 85, '处理响应…');
    if (!res.ok || !data.success) {
      if (res.status === 401) showLoginScreen();
      throw new Error(data.error || `上传失败 (${res.status})`);
    }
    setProgress(true, 100, '完成');
    renderResult(data);
    showToast(folder ? `已上传到 ${folder}` : '上传成功');
    state.galleryLoaded = false;
    if (folder && !state.folders.includes(folder)) {
      state.folders.push(folder);
      state.folders.sort((a, b) => a.localeCompare(b, 'zh'));
      fillFolderSelects(folder);
    }
  } catch (err) {
    showToast(err.message || '上传失败');
  } finally {
    els.dropzone.classList.remove('is-busy');
    setTimeout(() => setProgress(false), 500);
  }
}

async function uploadFiles(fileList) {
  const files = [...fileList].filter(Boolean);
  for (const file of files) {
    await uploadFile(file);
  }
}

function onDrag(e) {
  e.preventDefault();
  e.stopPropagation();
}

function onDragEnter(e) {
  onDrag(e);
  els.dropzone.classList.add('is-dragover');
}

function onDragLeave(e) {
  onDrag(e);
  if (!els.dropzone.contains(e.relatedTarget)) {
    els.dropzone.classList.remove('is-dragover');
  }
}

function onDrop(e) {
  onDrag(e);
  els.dropzone.classList.remove('is-dragover');
  const files = e.dataTransfer?.files;
  if (files?.length) uploadFiles(files);
}

async function handlePaste(e) {
  if (els.appShell.hidden) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  const images = [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) images.push(file);
    }
  }
  if (!images.length) return;
  e.preventDefault();
  await uploadFiles(images);
}

function renderGalleryItems(images, append) {
  if (!append) els.galleryGrid.innerHTML = '';

  for (const img of images) {
    const el = document.createElement('figure');
    el.className = 'gallery-item';
    el.innerHTML = `
      <a href="${escapeAttr(img.url)}" target="_blank" rel="noopener noreferrer">
        <img src="${escapeAttr(img.url)}" alt="" loading="lazy" />
      </a>
      <div class="gallery-actions">
        <button type="button" class="copy-btn" data-url="${escapeAttr(img.url)}">复制链接</button>
        <button type="button" class="delete-btn" data-key="${escapeAttr(img.key)}">删除</button>
      </div>
    `;

    el.querySelector('.copy-btn').addEventListener('click', (ev) => {
      copyText(ev.currentTarget.dataset.url, ev.currentTarget);
    });

    el.querySelector('.delete-btn').addEventListener('click', async (ev) => {
      const key = ev.currentTarget.dataset.key;
      if (!key || !confirm(`确认删除？\n${key}`)) return;
      if (!(await ensureAuthed())) return;

      try {
        const { res, data } = await api('/api/delete', {
          method: 'POST',
          body: JSON.stringify({ key }),
        });
        if (!res.ok || !data.success) throw new Error(data.error || '删除失败');
        el.remove();
        showToast('已删除');
      } catch (err) {
        showToast(err.message || '删除失败');
      }
    });

    els.galleryGrid.appendChild(el);
  }
}

async function loadGallery(reset = false) {
  if (state.loadingGallery) return;
  if (!(await ensureAuthed())) {
    els.galleryStatus.textContent = '请先登录后查看画廊';
    return;
  }

  state.loadingGallery = true;
  if (reset) {
    state.cursor = null;
    els.galleryStatus.textContent = '加载中…';
    els.btnMore.classList.add('hidden');
  }

  try {
    const params = new URLSearchParams({ limit: '24' });
    if (!reset && state.cursor) params.set('cursor', state.cursor);
    const folder = (els.galleryFolder?.value || state.galleryFolder || '').trim();
    state.galleryFolder = folder;
    if (folder) params.set('folder', folder);

    const { res, data } = await api(`/api/list?${params}`);
    if (!res.ok || !data.success) {
      if (res.status === 401) showLoginScreen();
      throw new Error(data.error || `加载失败 (${res.status})`);
    }

    renderGalleryItems(data.images || [], !reset);
    state.cursor = data.cursor || null;
    state.galleryLoaded = true;

    const totalShown = els.galleryGrid.children.length;
    els.galleryStatus.textContent = totalShown
      ? `已显示 ${totalShown} 张${data.truncated ? '（还有更多）' : ''}`
      : '还没有图片，先去上传一张吧。';
    els.btnMore.classList.toggle('hidden', !data.truncated);
  } catch (err) {
    els.galleryStatus.textContent = err.message || '加载失败';
  } finally {
    state.loadingGallery = false;
  }
}

async function loadUsers() {
  els.usersStatus.textContent = '加载中…';
  try {
    const { res, data } = await api('/api/users');
    if (!res.ok || !data.success) {
      if (res.status === 401) showLoginScreen();
      throw new Error(data.error || '加载用户失败');
    }

    const users = data.users || [];
    state.usersLoaded = true;
    els.usersStatus.textContent = `共 ${users.length} 个账号`;
    els.usersList.innerHTML = users
      .map(
        (u) => `
      <div class="user-row" data-id="${escapeAttr(u.id)}">
        <div>
          <p class="font-medium text-ink-950">${escapeHtml(u.username)}</p>
          <p class="text-xs text-ink-400 mt-1">${u.role === 'admin' ? '管理员' : '用户'} · ${escapeHtml(u.createdAt || '')}</p>
        </div>
        <button type="button" class="delete-btn" data-id="${escapeAttr(u.id)}" data-name="${escapeAttr(u.username)}" ${u.id === state.user?.id ? 'disabled' : ''}>删除</button>
      </div>`,
      )
      .join('');

    els.usersList.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        if (!id || !confirm(`确认删除用户「${name}」？`)) return;
        const { res: r, data: d } = await api(`/api/users?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!r.ok || !d.success) {
          showToast(d.error || '删除失败');
          return;
        }
        showToast('已删除用户');
        loadUsers();
      });
    });
  } catch (err) {
    els.usersStatus.textContent = err.message || '加载失败';
    els.usersList.innerHTML = '';
  }
}

function bindEvents() {
  els.tabUpload.addEventListener('click', () => switchView('upload'));
  els.tabGallery.addEventListener('click', () => switchView('gallery'));
  els.tabUsers.addEventListener('click', () => switchView('users'));

  els.fileInput.addEventListener('change', () => {
    if (els.fileInput.files?.length) {
      uploadFiles(els.fileInput.files);
      els.fileInput.value = '';
    }
  });

  els.dropzone.addEventListener('dragenter', onDragEnter);
  els.dropzone.addEventListener('dragover', onDragEnter);
  els.dropzone.addEventListener('dragleave', onDragLeave);
  els.dropzone.addEventListener('drop', onDrop);
  els.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.fileInput.click();
    }
  });

  document.addEventListener('paste', handlePaste);
  els.btnMore.addEventListener('click', () => loadGallery(false));
  els.btnRefresh.addEventListener('click', () => {
    state.galleryLoaded = false;
    loadGallery(true);
  });
  els.btnRefreshUsers.addEventListener('click', () => loadUsers());
  els.btnNewFolder?.addEventListener('click', createFolder);
  els.uploadFolder?.addEventListener('change', () => {
    state.uploadFolder = els.uploadFolder.value;
  });
  els.galleryFolder?.addEventListener('change', () => {
    state.galleryFolder = els.galleryFolder.value;
    state.galleryLoaded = false;
    loadGallery(true);
  });

  els.btnAuth.addEventListener('click', openAccountSheet);
  els.btnCloseAuthIn.addEventListener('click', closeAccountSheet);
  els.authOverlay.addEventListener('click', (e) => {
    if (e.target === els.authOverlay) closeAccountSheet();
  });

  els.authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = els.authUsername.value.trim();
    const password = els.authPassword.value;
    const path = state.needSetup ? '/api/auth/setup' : '/api/auth/login';
    const { res, data } = await api(path, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok || !data.success) {
      showToast(data.error || '失败');
      return;
    }
    state.user = data.user;
    state.needSetup = false;
    els.authPassword.value = '';
    updateAuthUi();
    showToast(path.includes('setup') ? '管理员已创建' : '登录成功');
  });

  els.btnLogout.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null;
    state.galleryLoaded = false;
    state.usersLoaded = false;
    state.view = 'upload';
    closeAccountSheet();
    showToast('已退出');
    await refreshMe();
  });

  els.formCreateUser.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = els.newUsername.value.trim();
    const password = els.newPassword.value;
    const role = els.newRole.value;
    const { res, data } = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
    if (!res.ok || !data.success) {
      showToast(data.error || '创建失败');
      return;
    }
    els.newUsername.value = '';
    els.newPassword.value = '';
    showToast('用户已创建');
    loadUsers();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.authOverlay.hidden) closeAccountSheet();
  });
}

bindEvents();
refreshMe().catch(() => {
  document.body.classList.remove('is-booting');
  showLoginScreen();
});
