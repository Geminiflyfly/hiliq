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
  tabFolders: document.getElementById('tab-folders'),
  tabUsers: document.getElementById('tab-users'),
  viewUpload: document.getElementById('view-upload'),
  viewGallery: document.getElementById('view-gallery'),
  viewFolders: document.getElementById('view-folders'),
  viewUsers: document.getElementById('view-users'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  uploadTarget: document.getElementById('upload-target'),
  uploadFolderPicker: document.getElementById('upload-folder-picker'),
  uploadFolderBtn: document.getElementById('upload-folder-btn'),
  uploadFolderLabel: document.getElementById('upload-folder-label'),
  uploadFolderMenu: document.getElementById('upload-folder-menu'),
  uploadFolderSearch: document.getElementById('upload-folder-search'),
  uploadFolderList: document.getElementById('upload-folder-list'),
  uploadQueue: document.getElementById('upload-queue'),
  btnClearResults: document.getElementById('btn-clear-results'),
  galleryKind: document.getElementById('gallery-kind'),
  galleryQuery: document.getElementById('gallery-query'),
  galleryFolderPicker: document.getElementById('gallery-folder-picker'),
  galleryFolderBtn: document.getElementById('gallery-folder-btn'),
  galleryFolderLabel: document.getElementById('gallery-folder-label'),
  galleryFolderMenu: document.getElementById('gallery-folder-menu'),
  galleryFolderSearch: document.getElementById('gallery-folder-search'),
  galleryFolderList: document.getElementById('gallery-folder-list'),
  galleryCrumbs: document.getElementById('gallery-crumbs'),
  btnNewFolder: document.getElementById('btn-new-folder'),
  btnNewSubfolder: document.getElementById('btn-new-subfolder'),
  btnRefreshFolders: document.getElementById('btn-refresh-folders'),
  formCreateFolder: document.getElementById('form-create-folder'),
  manageFolderName: document.getElementById('manage-folder-name'),
  foldersStatus: document.getElementById('folders-status'),
  foldersTree: document.getElementById('folders-tree'),
  progress: document.getElementById('upload-progress'),
  results: document.getElementById('upload-results'),
  galleryGrid: document.getElementById('gallery-grid'),
  galleryStatus: document.getElementById('gallery-status'),
  batchBar: document.getElementById('batch-bar'),
  batchSelectAll: document.getElementById('batch-select-all'),
  batchCount: document.getElementById('batch-count'),
  btnBatchCopy: document.getElementById('btn-batch-copy'),
  btnBatchMd: document.getElementById('btn-batch-md'),
  btnBatchHtml: document.getElementById('btn-batch-html'),
  btnBatchMove: document.getElementById('btn-batch-move'),
  btnBatchDelete: document.getElementById('btn-batch-delete'),
  btnManageUsers: document.getElementById('btn-manage-users'),
  dialogOverlay: document.getElementById('dialog-overlay'),
  dialogTitle: document.getElementById('dialog-title'),
  dialogBody: document.getElementById('dialog-body'),
  dialogConfirm: document.getElementById('dialog-confirm'),
  dialogCancel: document.getElementById('dialog-cancel'),
  lightbox: document.getElementById('lightbox'),
  lightboxClose: document.getElementById('lightbox-close'),
  lightboxStage: document.getElementById('lightbox-stage'),
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
  folderItems: [],
  uploadFolder: '',
  galleryFolder: '',
  galleryKind: '',
  galleryFolderOpen: false,
  uploadFolderOpen: false,
  folderStatsLoaded: false,
  galleryQuery: '',
  selectedKeys: new Set(),
  filesByKey: new Map(),
  queue: [],
  uploading: false,
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
  els.btnManageUsers?.classList.toggle('hidden', !isAdmin);
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

function folderOptionLabel(path) {
  const parts = String(path).split('/');
  const depth = parts.length - 1;
  const leaf = parts[parts.length - 1];
  const pad = depth > 0 ? `${'··'.repeat(depth)} ` : '';
  return `${pad}${leaf}`;
}

function fillFolderSelects(preferredUpload) {
  if (preferredUpload != null) state.uploadFolder = preferredUpload;
  renderUploadFolderButton();
  renderUploadFolderList();
  renderUploadTarget();
  renderGalleryFolderButton();
  renderGalleryCrumbs();
  renderGalleryFolderList();
}

function renderUploadTarget() {
  if (!els.uploadTarget) return;
  const path = state.uploadFolder || '';
  els.uploadTarget.textContent = path
    ? `将上传到 ${path.split('/').join(' / ')}`
    : '将上传到根目录';
}

function renderUploadFolderButton() {
  if (!els.uploadFolderLabel) return;
  els.uploadFolderLabel.textContent = state.uploadFolder || '根目录';
  els.uploadFolderBtn?.setAttribute('aria-expanded', String(state.uploadFolderOpen));
}

function renderUploadFolderList() {
  if (!els.uploadFolderList) return;
  renderFolderChoices(els.uploadFolderList, {
    query: els.uploadFolderSearch?.value || '',
    current: state.uploadFolder || '',
    emptyLabel: '根目录',
  });
}

function folderMeta(item) {
  const parts = String(item.path || '').split('/');
  const parent = parts.length > 1 ? parts.slice(0, -1).join(' / ') : '';
  const count = item.files != null ? `${item.files}` : '';
  return [parent, count].filter(Boolean).join(' · ');
}

function renderGalleryFolderButton() {
  if (!els.galleryFolderLabel) return;
  const path = state.galleryFolder || '';
  els.galleryFolderLabel.textContent = path || '全部文件夹';
  els.galleryFolderBtn?.setAttribute('aria-expanded', String(state.galleryFolderOpen));
}

function renderGalleryCrumbs() {
  if (!els.galleryCrumbs) return;
  const path = state.galleryFolder || '';
  const parts = path ? path.split('/') : [];
  const bits = [
    `<button type="button" class="crumb${path ? '' : ' is-current'}" data-folder="">全部</button>`,
  ];
  let acc = '';
  parts.forEach((part, i) => {
    acc = acc ? `${acc}/${part}` : part;
    const last = i === parts.length - 1;
    bits.push('<span class="crumb-sep" aria-hidden="true">/</span>');
    bits.push(
      `<button type="button" class="crumb${last ? ' is-current' : ''}" data-folder="${escapeAttr(acc)}">${escapeHtml(part)}</button>`,
    );
  });
  if (path) bits.push('<span class="crumb-note">含下级</span>');
  els.galleryCrumbs.innerHTML = bits.join('');
}

function renderFolderChoices(container, { query = '', current = '', emptyLabel = '全部文件夹' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const items = (state.folderItems || []).filter((item) => {
    if (!q) return true;
    return String(item.path || '').toLowerCase().includes(q);
  });
  const allRow = `
    <button type="button" class="folder-opt${current ? '' : ' is-current'}" role="option" data-folder="" aria-selected="${!current}">
      <span class="folder-opt-leaf">${escapeHtml(emptyLabel)}</span>
    </button>
    <div class="folder-picker-sep"></div>`;
  const rows = items.length
    ? items
        .map((item) => {
          const parts = String(item.path).split('/');
          const leaf = parts[parts.length - 1];
          const depth = item.depth || Math.max(0, parts.length - 1);
          const on = item.path === current;
          return `
        <button type="button" class="folder-opt${on ? ' is-current' : ''}" role="option" data-folder="${escapeAttr(item.path)}" aria-selected="${on}" style="padding-left:${0.55 + depth * 1.05}rem">
          <span class="folder-opt-icon" aria-hidden="true"></span>
          <span class="folder-opt-main"><span class="folder-opt-leaf">${escapeHtml(leaf)}</span></span>
          <span class="folder-opt-meta">${escapeHtml(folderMeta(item))}</span>
        </button>`;
        })
        .join('')
    : `<p class="folder-opt-empty">${q ? '没有匹配的文件夹' : '还没有文件夹'}</p>`;
  container.innerHTML = allRow + rows;
}

function renderGalleryFolderList() {
  if (!els.galleryFolderList) return;
  renderFolderChoices(els.galleryFolderList, {
    query: els.galleryFolderSearch?.value || '',
    current: state.galleryFolder || '',
    emptyLabel: '全部文件夹',
  });
}

function openGalleryFolderMenu() {
  if (!els.galleryFolderMenu) return;
  state.galleryFolderOpen = true;
  els.galleryFolderMenu.hidden = false;
  renderGalleryFolderButton();
  if (els.galleryFolderSearch) els.galleryFolderSearch.value = '';
  renderGalleryFolderList();
  els.galleryFolderSearch?.focus();
  if (!state.folderStatsLoaded) loadFolders({ withStats: true });
}

function closeGalleryFolderMenu() {
  state.galleryFolderOpen = false;
  if (els.galleryFolderMenu) els.galleryFolderMenu.hidden = true;
  renderGalleryFolderButton();
}

function openUploadFolderMenu() {
  if (!els.uploadFolderMenu) return;
  state.uploadFolderOpen = true;
  els.uploadFolderMenu.hidden = false;
  renderUploadFolderButton();
  if (els.uploadFolderSearch) els.uploadFolderSearch.value = '';
  renderUploadFolderList();
  els.uploadFolderSearch?.focus();
  if (!state.folderStatsLoaded) loadFolders({ withStats: true });
}

function closeUploadFolderMenu() {
  state.uploadFolderOpen = false;
  if (els.uploadFolderMenu) els.uploadFolderMenu.hidden = true;
  renderUploadFolderButton();
}

function setUploadFolder(path) {
  state.uploadFolder = String(path || '');
  closeUploadFolderMenu();
  renderUploadFolderList();
  renderUploadTarget();
}

function setGalleryFolder(path) {
  const next = String(path || '');
  const changed = next !== (state.galleryFolder || '');
  state.galleryFolder = next;
  closeGalleryFolderMenu();
  renderGalleryCrumbs();
  renderGalleryFolderList();
  if (!changed) return;
  state.galleryLoaded = false;
  if (state.view === 'gallery') loadGallery(true);
}

async function loadFolders({ withStats = false } = {}) {
  try {
    const q = withStats ? '?stats=1' : '';
    const { res, data } = await api(`/api/folders${q}`);
    if (!res.ok || !data.success) {
      throw new Error(data.error || '加载文件夹失败');
    }
    state.folders = data.folders || [];
    state.folderItems = data.items || state.folders.map((path) => ({
      path,
      depth: path.split('/').length - 1,
      childCount: 0,
    }));
    state.foldersLoaded = true;
    if (withStats) state.folderStatsLoaded = true;
    fillFolderSelects();
    if (state.view === 'folders') renderFoldersTree();
  } catch (err) {
    console.warn(err);
    state.folders = state.folders || [];
    fillFolderSelects();
    if (els.foldersStatus) {
      els.foldersStatus.textContent = err.message || '加载失败';
    }
  }
}

function renderFoldersTree() {
  if (!els.foldersTree) return;
  const items = state.folderItems || [];
  if (!items.length) {
    els.foldersStatus.textContent = '还没有文件夹，可在上方创建。';
    els.foldersTree.innerHTML = '';
    return;
  }
  els.foldersStatus.textContent = `共 ${items.length} 个文件夹`;
  els.foldersTree.innerHTML = items
    .map((item) => {
      const path = item.path;
      const pad = '··'.repeat(item.depth || 0);
      const files = item.files != null ? `${item.files} 张图` : '';
      const kids = item.childCount ? `${item.childCount} 子目录` : '';
      const meta = [files, kids].filter(Boolean).join(' · ') || '空目录';
      return `
      <div class="folder-row" data-path="${escapeAttr(path)}">
        <div class="folder-row-main">
          <p class="folder-row-path">${pad ? `<span class="text-ink-200">${escapeHtml(pad)} </span>` : ''}${escapeHtml(path)}</p>
          <p class="folder-row-meta">${escapeHtml(meta)}</p>
        </div>
        <div class="folder-row-actions">
          <button type="button" class="btn-ghost" data-act="upload">上传</button>
          <button type="button" class="btn-ghost" data-act="gallery">画廊</button>
          <button type="button" class="btn-ghost" data-act="sub">子目录</button>
          <button type="button" class="btn-ghost" data-act="rename">重命名</button>
          <button type="button" class="delete-btn" data-act="delete">删除</button>
        </div>
      </div>`;
    })
    .join('');

  els.foldersTree.querySelectorAll('.folder-row').forEach((row) => {
    const path = row.dataset.path;
    row.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => handleFolderAction(btn.dataset.act, path));
    });
  });
}

async function handleFolderAction(act, path) {
  if (!path) return;
  if (act === 'upload') {
    rememberFolder(path);
    fillFolderSelects(path);
    switchView('upload');
    showToast(`上传目标：${path}`);
    return;
  }
  if (act === 'gallery') {
    rememberFolder(path);
    state.galleryFolder = path;
    state.galleryLoaded = false;
    fillFolderSelects();
    switchView('gallery');
    return;
  }
  if (act === 'sub') {
    state.uploadFolder = path;
    renderUploadTarget();
    await createFolder({ asSub: true });
    await loadFolders({ withStats: true });
    return;
  }
  if (act === 'rename') {
    const leaf = path.split('/').pop();
    const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const nextLeaf = await openDialog({
      title: '重命名文件夹',
      html: `<label class="field-label" for="dialog-input">新名称</label><input id="dialog-input" class="field" value="${escapeAttr(leaf)}" />`,
      confirmText: '重命名',
      getValue: () => document.getElementById('dialog-input')?.value ?? '',
    });
    if (nextLeaf == null) return;
    const trimmed = String(nextLeaf).trim().replace(/\//g, '');
    if (!trimmed) {
      showToast('名称不能为空');
      return;
    }
    const to = parent ? `${parent}/${trimmed}` : trimmed;
    if (to === path) return;
    if (!confirm(`将「${path}」重命名为「${to}」？\n会移动该目录下全部文件。`)) return;
    const { res, data } = await api('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ action: 'rename', from: path, to }),
    });
    if (!res.ok || !data.success) {
      showToast(data.error || '重命名失败');
      return;
    }
    showToast(`已重命名（移动 ${data.moved || 0} 个对象）`);
    state.foldersLoaded = false;
    await loadFolders({ withStats: true });
    return;
  }
  if (act === 'delete') {
    if (!confirm(`确认删除文件夹「${path}」及其下全部图片？此操作不可恢复。`)) return;
    const { res, data } = await api(`/api/folders?folder=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
    if (!res.ok || !data.success) {
      showToast(data.error || '删除失败');
      return;
    }
    showToast(data.message || '已删除');
    if (state.uploadFolder === path || state.uploadFolder.startsWith(`${path}/`)) {
      state.uploadFolder = '';
    }
    const galleryHit = state.galleryFolder === path || state.galleryFolder.startsWith(`${path}/`);
    if (galleryHit) state.galleryFolder = '';
    await loadFolders({ withStats: true });
    if (galleryHit && state.view === 'gallery') {
      state.galleryLoaded = false;
      loadGallery(true);
    }
  }
}

function rememberFolder(folder) {
  if (!folder) return;
  if (!state.folders.includes(folder)) {
    state.folders.push(folder);
  }
  // Also remember ancestors
  const parts = folder.split('/');
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    if (!state.folders.includes(acc)) state.folders.push(acc);
  }
  state.folders.sort((a, b) => a.localeCompare(b, 'zh'));
}

async function createFolder({ asSub = false } = {}) {
  const current = getSelectedUploadFolder();
  let name;

  if (asSub) {
    if (!current) {
      showToast('请先选择父文件夹，再新建子目录');
      return;
    }
    name = await openDialog({
      title: `在「${current}」下新建子目录`,
      html: `<label class="field-label" for="dialog-input">子目录名称</label><input id="dialog-input" class="field" placeholder="春季" />`,
      confirmText: '创建',
      getValue: () => document.getElementById('dialog-input')?.value ?? '',
    });
  } else {
    name = await openDialog({
      title: '新建文件夹',
      html: `<label class="field-label" for="dialog-input">路径</label><input id="dialog-input" class="field" placeholder="产品/春季" />`,
      confirmText: '创建',
      getValue: () => document.getElementById('dialog-input')?.value ?? '',
    });
  }

  if (name == null) return;
  const trimmed = name.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    showToast('名称不能为空');
    return;
  }

  const body = asSub
    ? { parent: current, name: trimmed }
    : { name: trimmed };

  const { res, data } = await api('/api/folders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok || !data.success) {
    showToast(data.error || '创建失败');
    return;
  }
  const folder = data.folder || (asSub ? `${current}/${trimmed}` : trimmed);
  rememberFolder(folder);
  fillFolderSelects(folder);
  showToast(`已选择：${folder}`);
  if (state.view === 'folders') {
    await loadFolders({ withStats: true });
  }
}

function getSelectedUploadFolder() {
  return (state.uploadFolder || '').trim();
}

function openDialog({ title, html, confirmText = '确定', getValue, onMount }) {
  return new Promise((resolve) => {
    if (!els.dialogOverlay) {
      resolve(null);
      return;
    }
    els.dialogTitle.textContent = title;
    els.dialogBody.innerHTML = html;
    els.dialogConfirm.textContent = confirmText;
    els.dialogOverlay.hidden = false;
    const input = els.dialogBody.querySelector('input, textarea');
    onMount?.();
    input?.focus();

    const finish = (value) => {
      els.dialogOverlay.hidden = true;
      els.dialogConfirm.onclick = null;
      els.dialogCancel.onclick = null;
      resolve(value);
    };
    els.dialogConfirm.onclick = () => finish(getValue ? getValue() : true);
    els.dialogCancel.onclick = () => finish(null);
    els.dialogOverlay.onclick = (e) => {
      if (e.target === els.dialogOverlay) finish(null);
    };
  });
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
    folders: els.viewFolders,
    users: els.viewUsers,
  };

  Object.entries(map).forEach(([name, el]) => {
    if (!el) return;
    const on = name === view;
    el.hidden = !on;
    el.classList.toggle('is-visible', on);
  });

  els.tabUpload.classList.toggle('is-active', view === 'upload');
  els.tabGallery.classList.toggle('is-active', view === 'gallery');
  els.tabFolders?.classList.toggle('is-active', view === 'folders');
  els.tabUsers.classList.toggle('is-active', view === 'users');
  els.tabUpload.setAttribute('aria-selected', String(view === 'upload'));
  els.tabGallery.setAttribute('aria-selected', String(view === 'gallery'));
  els.tabFolders?.setAttribute('aria-selected', String(view === 'folders'));
  els.tabUsers.setAttribute('aria-selected', String(view === 'users'));

  if (view === 'gallery' && !state.galleryLoaded) loadGallery(true);
  if (view === 'gallery' && !state.folderStatsLoaded) loadFolders({ withStats: true });
  if (view === 'folders') loadFolders({ withStats: true });
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
  const isImage = (data.kind || 'image') === 'image';
  const thumb = isImage
    ? `<img class="result-thumb" src="${escapeAttr(formats.url)}" alt="" loading="lazy" />`
    : `<div class="result-thumb file-card result-file-card">
         <span class="file-card-kind">${escapeHtml(data.kindLabel || data.kind || '文件')}</span>
         <span class="file-card-name">${escapeHtml(data.originalName || data.key || '')}</span>
       </div>`;

  item.innerHTML = `
    ${thumb}
    <div>
      <p class="text-sm text-ink-600 mb-3">
        <span class="font-medium text-ink-950">${escapeHtml(data.key || '')}</span>
        ${data.folder ? ` · <span class="text-tide-500">${escapeHtml(data.folder)}</span>` : ''}
        ${data.kindLabel ? `<span class="kind-pill">${escapeHtml(data.kindLabel)}</span>` : ''}
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

function renderQueue() {
  if (!els.uploadQueue) return;
  els.uploadQueue.innerHTML = state.queue
    .map((item) => {
      const status = item.status === 'done'
        ? '完成'
        : item.status === 'error'
          ? (item.error || '失败')
          : item.status === 'cancelled'
            ? '已取消'
            : item.status === 'uploading'
              ? `${item.progress}%`
              : '等待';
      return `
      <li class="upload-row" data-id="${escapeAttr(item.id)}">
        <span class="upload-row-name">${escapeHtml(item.file.name || '文件')}</span>
        <span class="upload-row-meta">${escapeHtml(status)}</span>
        <div class="progress-bar"><span style="width:${item.progress || 0}%"></span></div>
        ${item.status === 'queued' || item.status === 'uploading'
          ? `<button type="button" class="btn-ghost queue-cancel" data-id="${escapeAttr(item.id)}">取消</button>`
          : ''}
      </li>`;
    })
    .join('');
  els.uploadQueue.querySelectorAll('.queue-cancel').forEach((btn) => {
    btn.addEventListener('click', () => cancelQueueItem(btn.dataset.id));
  });
}

function cancelQueueItem(id) {
  const item = state.queue.find((row) => row.id === id);
  if (!item) return;
  item.cancelled = true;
  if (item.status === 'uploading' && item.xhr) item.xhr.abort();
  if (item.status === 'queued') {
    item.status = 'cancelled';
    renderQueue();
  }
}

function uploadOne(item) {
  const form = new FormData();
  form.append('file', item.file, item.file.name || 'file');
  const folder = getSelectedUploadFolder();
  if (folder) form.append('folder', folder);
  item.folder = folder;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    item.xhr = xhr;
    xhr.open('POST', '/api/upload');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      item.progress = Math.round((ev.loaded / ev.total) * 100);
      renderQueue();
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch { data = {}; }
      if (xhr.status === 401) showLoginScreen();
      if (xhr.status >= 200 && xhr.status < 300 && data.success) {
        item.status = 'done';
        item.progress = 100;
        item.result = data;
        resolve(data);
      } else {
        item.status = 'error';
        item.error = data.error || `失败 (${xhr.status})`;
        resolve(null);
      }
    };
    xhr.onerror = () => {
      item.status = 'error';
      item.error = '网络错误';
      resolve(null);
    };
    xhr.onabort = () => {
      item.status = 'cancelled';
      resolve(null);
    };
    xhr.send(form);
  });
}

async function drainQueue() {
  if (state.uploading) return;
  state.uploading = true;
  els.dropzone.classList.add('is-busy');
  try {
    while (state.queue.some((item) => item.status === 'queued')) {
      const item = state.queue.find((row) => row.status === 'queued');
      if (!item || item.cancelled) {
        if (item) item.status = 'cancelled';
        continue;
      }
      item.status = 'uploading';
      item.progress = 0;
      renderQueue();
      const data = await uploadOne(item);
      renderQueue();
      if (data) {
        renderResult(data);
        els.btnClearResults?.classList.remove('hidden');
        state.galleryLoaded = false;
        if (item.folder) {
          rememberFolder(item.folder);
          fillFolderSelects(item.folder);
        }
      }
    }
  } finally {
    state.uploading = false;
    els.dropzone.classList.remove('is-busy');
    const done = state.queue.filter((item) => item.status === 'done').length;
    const failed = state.queue.filter((item) => item.status === 'error').length;
    if (done || failed) showToast(`完成 ${done} 个${failed ? `，失败 ${failed} 个` : ''}`);
  }
}

async function uploadFiles(fileList) {
  if (!(await ensureAuthed())) return;
  const files = [...fileList].filter(Boolean);
  if (!files.length) return;
  for (const file of files) {
    state.queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      status: 'queued',
      progress: 0,
    });
  }
  renderQueue();
  drainQueue();
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
  const files = [];
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (!files.length) return;
  e.preventDefault();
  await uploadFiles(files);
}

function updateBatchBar() {
  const n = state.selectedKeys.size;
  if (els.batchBar) els.batchBar.classList.toggle('hidden', false);
  if (els.batchCount) els.batchCount.textContent = `已选 ${n}`;
  const off = n === 0;
  if (els.btnBatchCopy) els.btnBatchCopy.disabled = off;
  if (els.btnBatchMd) els.btnBatchMd.disabled = off;
  if (els.btnBatchHtml) els.btnBatchHtml.disabled = off;
  if (els.btnBatchMove) els.btnBatchMove.disabled = off;
  if (els.btnBatchDelete) els.btnBatchDelete.disabled = off;
  if (els.batchSelectAll && els.galleryGrid) {
    const boxes = [...els.galleryGrid.querySelectorAll('.gallery-check')];
    els.batchSelectAll.checked = boxes.length > 0 && boxes.every((b) => b.checked);
    els.batchSelectAll.indeterminate = n > 0 && !els.batchSelectAll.checked;
  }
}

function clearSelection() {
  state.selectedKeys.clear();
  els.galleryGrid?.querySelectorAll('.gallery-item').forEach((el) => {
    el.classList.remove('is-selected');
    const cb = el.querySelector('.gallery-check');
    if (cb) cb.checked = false;
  });
  updateBatchBar();
}

function renderGalleryItems(images, append) {
  if (!append) {
    els.galleryGrid.innerHTML = '';
    state.selectedKeys.clear();
    state.filesByKey = new Map();
  }

  for (const img of images) {
    state.filesByKey.set(img.key, img);
    const el = document.createElement('figure');
    el.className = 'gallery-item';
    el.dataset.key = img.key;
    const isImage = (img.kind || 'image') === 'image';
    const title = img.originalName || img.key.split('/').pop() || img.key;
    const when = img.uploaded ? String(img.uploaded).slice(0, 10) : '';
    const meta = [img.size != null ? formatSize(img.size) : '', when].filter(Boolean).join(' · ');
    const preview = isImage
      ? `<img src="${escapeAttr(img.url)}" alt="" loading="lazy" />`
      : `<span class="file-card">
           <span class="file-card-kind">${escapeHtml(img.kindLabel || img.kind || '文件')}</span>
           <span class="file-card-name">${escapeHtml(title)}</span>
         </span>`;

    el.innerHTML = `
      <input type="checkbox" class="gallery-check" data-key="${escapeAttr(img.key)}" aria-label="选择" />
      <button type="button" class="gallery-open" data-key="${escapeAttr(img.key)}">
        ${preview}
        <span class="gallery-kind">${escapeHtml(img.kindLabel || '文件')}</span>
      </button>
      <figcaption class="gallery-meta">${escapeHtml(meta || title)}</figcaption>
    `;

    el.querySelector('.gallery-check').addEventListener('change', (ev) => {
      const key = ev.currentTarget.dataset.key;
      if (ev.currentTarget.checked) {
        state.selectedKeys.add(key);
        el.classList.add('is-selected');
      } else {
        state.selectedKeys.delete(key);
        el.classList.remove('is-selected');
      }
      updateBatchBar();
    });

    el.querySelector('.gallery-open').addEventListener('click', () => openLightbox(img));
    els.galleryGrid.appendChild(el);
  }
  updateBatchBar();
}

function openLightbox(file) {
  if (!els.lightbox || !file) return;
  const kind = file.kind || 'image';
  const title = file.originalName || file.key;
  let inner = '';
  if (kind === 'image') {
    inner = `<img src="${escapeAttr(file.url)}" alt="${escapeAttr(title)}" />`;
  } else if (kind === 'video') {
    inner = `<video src="${escapeAttr(file.url)}" controls autoplay></video>`;
  } else if (kind === 'audio') {
    inner = `<audio src="${escapeAttr(file.url)}" controls autoplay></audio><p class="mt-3 text-sm text-white">${escapeHtml(title)}</p>`;
  } else {
    inner = `<a class="btn-primary" href="${escapeAttr(file.url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`;
  }
  els.lightboxStage.innerHTML = inner;
  els.lightbox.hidden = false;
}

function closeLightbox() {
  if (!els.lightbox) return;
  els.lightbox.hidden = true;
  els.lightboxStage.innerHTML = '';
}

function selectedLinkText(format) {
  const files = [...state.selectedKeys].map((key) => state.filesByKey.get(key)).filter(Boolean);
  return files.map((file) => {
    const name = file.originalName || file.key.split('/').pop() || 'file';
    if (format === 'md') {
      return file.kind === 'image' ? `![${name}](${file.url})` : `[${name}](${file.url})`;
    }
    if (format === 'html') {
      return file.kind === 'image'
        ? `<img src="${file.url}" alt="${name}" />`
        : `<a href="${file.url}">${name}</a>`;
    }
    return file.url;
  }).join('\n');
}

async function moveKeys(keys) {
  if (!keys.length) return;
  if (!(await ensureAuthed())) return;
  const preset = state.galleryFolder || state.uploadFolder || '';
  const choice = await openDialog({
    title: `移动 ${keys.length} 个文件`,
    html: `
      <label class="field-label" for="dialog-folder-input">目标文件夹（留空为根目录）</label>
      <input id="dialog-folder-input" class="field" value="${escapeAttr(preset)}" placeholder="产品/春季" />
      <div id="dialog-folder-list" class="dialog-folder-list"></div>`,
    confirmText: '移动',
    getValue: () => document.getElementById('dialog-folder-input')?.value ?? '',
    onMount: () => {
      const list = document.getElementById('dialog-folder-list');
      const input = document.getElementById('dialog-folder-input');
      const paint = () => renderFolderChoices(list, {
        current: input?.value || '',
        emptyLabel: '根目录',
      });
      paint();
      list?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-folder]');
        if (!btn || !list.contains(btn)) return;
        if (input) input.value = btn.dataset.folder || '';
        paint();
      });
    },
  });
  if (choice == null) return;
  const folder = String(choice).trim();
  const { res, data } = await api('/api/move', {
    method: 'POST',
    body: JSON.stringify({ keys, folder }),
  });
  if (!res.ok && !data.moved?.length) {
    if (res.status === 401) showLoginScreen();
    showToast(data.error || '移动失败');
    return;
  }
  showToast(data.message || '已移动');
  if (folder) rememberFolder(folder);
  fillFolderSelects();
  clearSelection();
  state.galleryLoaded = false;
  await loadGallery(true);
}

async function loadGallery(reset = false) {
  if (state.loadingGallery) return;
  if (!(await ensureAuthed())) {
    els.galleryStatus.textContent = '请先登录后查看文件库';
    return;
  }

  state.loadingGallery = true;
  if (reset) {
    state.cursor = null;
    els.galleryStatus.textContent = '加载中…';
    els.btnMore.classList.add('hidden');
    clearSelection();
  }

  try {
    const params = new URLSearchParams({ limit: '24' });
    if (!reset && state.cursor) params.set('cursor', state.cursor);
    const folder = (state.galleryFolder || '').trim();
    const kind = (els.galleryKind?.value || state.galleryKind || '').trim();
    const query = (els.galleryQuery?.value || state.galleryQuery || '').trim();
    state.galleryFolder = folder;
    state.galleryKind = kind;
    state.galleryQuery = query;
    if (folder) params.set('folder', folder);
    if (kind) params.set('kind', kind);
    if (query) params.set('q', query);

    const { res, data } = await api(`/api/list?${params}`);
    if (!res.ok || !data.success) {
      if (res.status === 401) showLoginScreen();
      throw new Error(data.error || `加载失败 (${res.status})`);
    }

    renderGalleryItems(data.files || data.images || [], !reset);
    state.cursor = data.cursor || null;
    state.galleryLoaded = true;

    const totalShown = els.galleryGrid.children.length;
    els.galleryStatus.textContent = totalShown
      ? `已显示 ${totalShown} 个${data.truncated ? '（还有更多）' : ''}`
      : '还没有文件，先去上传吧。';
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
  els.tabFolders?.addEventListener('click', () => switchView('folders'));
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
  els.btnNewFolder?.addEventListener('click', () => createFolder({ asSub: false }));
  els.btnNewSubfolder?.addEventListener('click', () => createFolder({ asSub: true }));
  els.btnRefreshFolders?.addEventListener('click', () => loadFolders({ withStats: true }));
  els.formCreateFolder?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (els.manageFolderName?.value || '').trim();
    if (!name) return;
    const { res, data } = await api('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    if (!res.ok || !data.success) {
      showToast(data.error || '创建失败');
      return;
    }
    els.manageFolderName.value = '';
    rememberFolder(data.folder || name);
    fillFolderSelects(data.folder || name);
    showToast(`已创建：${data.folder || name}`);
    await loadFolders({ withStats: true });
  });
  els.uploadFolderBtn?.addEventListener('click', () => {
    if (state.uploadFolderOpen) closeUploadFolderMenu();
    else openUploadFolderMenu();
  });
  els.uploadFolderSearch?.addEventListener('input', () => renderUploadFolderList());
  els.uploadFolderList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-folder]');
    if (!btn || !els.uploadFolderList.contains(btn)) return;
    setUploadFolder(btn.dataset.folder || '');
  });
  els.btnClearResults?.addEventListener('click', () => {
    els.results.innerHTML = '';
    els.btnClearResults.classList.add('hidden');
  });
  els.galleryFolderBtn?.addEventListener('click', () => {
    if (state.galleryFolderOpen) closeGalleryFolderMenu();
    else openGalleryFolderMenu();
  });
  els.galleryFolderSearch?.addEventListener('input', () => renderGalleryFolderList());
  els.galleryFolderList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-folder]');
    if (!btn || !els.galleryFolderList.contains(btn)) return;
    setGalleryFolder(btn.dataset.folder || '');
  });
  els.galleryCrumbs?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-folder]');
    if (!btn || !els.galleryCrumbs.contains(btn)) return;
    setGalleryFolder(btn.dataset.folder || '');
  });
  document.addEventListener('click', (e) => {
    if (state.galleryFolderOpen && !els.galleryFolderPicker?.contains(e.target)) {
      closeGalleryFolderMenu();
    }
    if (state.uploadFolderOpen && !els.uploadFolderPicker?.contains(e.target)) {
      closeUploadFolderMenu();
    }
  });
  els.galleryKind?.addEventListener('change', () => {
    state.galleryKind = els.galleryKind.value;
    state.galleryLoaded = false;
    loadGallery(true);
  });
  let queryTimer;
  els.galleryQuery?.addEventListener('input', () => {
    clearTimeout(queryTimer);
    queryTimer = setTimeout(() => {
      state.galleryQuery = els.galleryQuery.value.trim();
      state.galleryLoaded = false;
      loadGallery(true);
    }, 250);
  });
  els.btnBatchCopy?.addEventListener('click', () => copyText(selectedLinkText('url')));
  els.btnBatchMd?.addEventListener('click', () => copyText(selectedLinkText('md')));
  els.btnBatchHtml?.addEventListener('click', () => copyText(selectedLinkText('html')));
  els.btnManageUsers?.addEventListener('click', () => {
    closeAccountSheet();
    switchView('users');
  });
  els.lightboxClose?.addEventListener('click', closeLightbox);
  els.lightbox?.addEventListener('click', (e) => {
    if (e.target === els.lightbox) closeLightbox();
  });
  els.batchSelectAll?.addEventListener('change', () => {
    const on = els.batchSelectAll.checked;
    els.galleryGrid?.querySelectorAll('.gallery-check').forEach((cb) => {
      cb.checked = on;
      const key = cb.dataset.key;
      const item = cb.closest('.gallery-item');
      if (on) {
        state.selectedKeys.add(key);
        item?.classList.add('is-selected');
      } else {
        state.selectedKeys.delete(key);
        item?.classList.remove('is-selected');
      }
    });
    updateBatchBar();
  });
  els.btnBatchMove?.addEventListener('click', async () => {
    await moveKeys([...state.selectedKeys]);
  });
  els.btnBatchDelete?.addEventListener('click', async () => {
    const keys = [...state.selectedKeys];
    if (!keys.length) return;
    if (!confirm(`确认删除选中的 ${keys.length} 个文件？`)) return;
    const { res, data } = await api('/api/delete', {
      method: 'POST',
      body: JSON.stringify({ keys }),
    });
    if (!res.ok && !data.deleted?.length) {
      showToast(data.error || '删除失败');
      return;
    }
    showToast(data.message || '已删除');
    clearSelection();
    state.galleryLoaded = false;
    await loadGallery(true);
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
    if (e.key !== 'Escape') return;
    if (els.lightbox && !els.lightbox.hidden) {
      closeLightbox();
      return;
    }
    if (els.dialogOverlay && !els.dialogOverlay.hidden) {
      els.dialogCancel?.click();
      return;
    }
    if (state.galleryFolderOpen) {
      closeGalleryFolderMenu();
      return;
    }
    if (state.uploadFolderOpen) {
      closeUploadFolderMenu();
      return;
    }
    if (!els.authOverlay.hidden) closeAccountSheet();
  });
}

bindEvents();
renderGalleryCrumbs();
renderUploadTarget();
refreshMe().catch(() => {
  document.body.classList.remove('is-booting');
  showLoginScreen();
});
