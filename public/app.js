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
  uploadFolder: document.getElementById('upload-folder'),
  galleryKind: document.getElementById('gallery-kind'),
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
  btnBatchMove: document.getElementById('btn-batch-move'),
  btnBatchDelete: document.getElementById('btn-batch-delete'),
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
  folderStatsLoaded: false,
  selectedKeys: new Set(),
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

function folderOptionLabel(path) {
  const parts = String(path).split('/');
  const depth = parts.length - 1;
  const leaf = parts[parts.length - 1];
  const pad = depth > 0 ? `${'··'.repeat(depth)} ` : '';
  return `${pad}${leaf}`;
}

function fillFolderSelects(preferredUpload) {
  const folders = state.folders || [];
  const uploadVal = preferredUpload ?? els.uploadFolder?.value ?? state.uploadFolder ?? '';

  const optionsHtml = folders
    .map(
      (f) =>
        `<option value="${escapeAttr(f)}">${escapeHtml(folderOptionLabel(f))}</option>`,
    )
    .join('');

  if (els.uploadFolder) {
    els.uploadFolder.innerHTML = `<option value="">根目录</option>${optionsHtml}`;
    if (uploadVal && [...els.uploadFolder.options].some((o) => o.value === uploadVal)) {
      els.uploadFolder.value = uploadVal;
    }
    state.uploadFolder = els.uploadFolder.value;
  }

  renderGalleryFolderButton();
  renderGalleryCrumbs();
  renderGalleryFolderList();
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

function renderGalleryFolderList() {
  if (!els.galleryFolderList) return;
  const q = (els.galleryFolderSearch?.value || '').trim().toLowerCase();
  const items = (state.folderItems || []).filter((item) => {
    if (!q) return true;
    return String(item.path || '').toLowerCase().includes(q);
  });
  const current = state.galleryFolder || '';
  const allRow = `
    <button type="button" class="folder-opt${current ? '' : ' is-current'}" role="option" data-folder="" aria-selected="${!current}">
      <span class="folder-opt-leaf">全部文件夹</span>
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
  els.galleryFolderList.innerHTML = allRow + rows;
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
    if (els.uploadFolder) els.uploadFolder.value = path;
    state.uploadFolder = path;
    await createFolder({ asSub: true });
    await loadFolders({ withStats: true });
    return;
  }
  if (act === 'rename') {
    const leaf = path.split('/').pop();
    const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const nextLeaf = prompt('新名称（仅本级目录名）', leaf);
    if (nextLeaf == null) return;
    const trimmed = nextLeaf.trim().replace(/\//g, '');
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
    name = prompt(`在「${current}」下新建子目录名称`);
  } else {
    name = prompt('新文件夹路径（可多级，如 产品/春季）');
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
  if (!(await ensureAuthed())) return;

  const form = new FormData();
  form.append('file', file, file.name || 'file');
  const folder = getSelectedUploadFolder();
  if (folder) form.append('folder', folder);
  setProgress(true, 15, `正在上传 ${file.name || '文件'}${folder ? ` → ${folder}` : ''}…`);
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
    if (folder) {
      rememberFolder(folder);
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

function updateBatchBar() {
  const n = state.selectedKeys.size;
  if (els.batchBar) els.batchBar.classList.toggle('hidden', false);
  if (els.batchCount) els.batchCount.textContent = `已选 ${n}`;
  if (els.btnBatchMove) els.btnBatchMove.disabled = n === 0;
  if (els.btnBatchDelete) els.btnBatchDelete.disabled = n === 0;
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
  }

  for (const img of images) {
    const el = document.createElement('figure');
    el.className = 'gallery-item';
    el.dataset.key = img.key;
    const isImage = (img.kind || 'image') === 'image';
    const title = img.originalName || img.key.split('/').pop() || img.key;
    const preview = isImage
      ? `<a href="${escapeAttr(img.url)}" target="_blank" rel="noopener noreferrer">
           <img src="${escapeAttr(img.url)}" alt="" loading="lazy" />
         </a>`
      : `<a class="file-card" href="${escapeAttr(img.url)}" target="_blank" rel="noopener noreferrer">
           <span class="file-card-kind">${escapeHtml(img.kindLabel || img.kind || '文件')}</span>
           <span class="file-card-name">${escapeHtml(title)}</span>
         </a>`;

    el.innerHTML = `
      <input type="checkbox" class="gallery-check" data-key="${escapeAttr(img.key)}" aria-label="选择" />
      ${preview}
      <div class="gallery-actions">
        <button type="button" class="copy-btn" data-url="${escapeAttr(img.url)}">复制链接</button>
        <button type="button" class="btn-ghost btn-move" data-key="${escapeAttr(img.key)}">移动</button>
        <button type="button" class="delete-btn" data-key="${escapeAttr(img.key)}">删除</button>
      </div>
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

    el.querySelector('.copy-btn').addEventListener('click', (ev) => {
      copyText(ev.currentTarget.dataset.url, ev.currentTarget);
    });

    el.querySelector('.btn-move').addEventListener('click', async () => {
      await moveKeys([img.key]);
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
        state.selectedKeys.delete(key);
        el.remove();
        updateBatchBar();
        showToast('已删除');
      } catch (err) {
        showToast(err.message || '删除失败');
      }
    });

    els.galleryGrid.appendChild(el);
  }
  updateBatchBar();
}

async function moveKeys(keys) {
  if (!keys.length) return;
  if (!(await ensureAuthed())) return;
  const choice = prompt(
    `移动 ${keys.length} 个文件到文件夹：\n填写路径（留空=根目录）\n已有：${(state.folders || []).slice(0, 12).join(' · ') || '无'}`,
    state.galleryFolder || state.uploadFolder || '',
  );
  if (choice == null) return;
  const folder = choice.trim();
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
    state.galleryFolder = folder;
    state.galleryKind = kind;
    if (folder) params.set('folder', folder);
    if (kind) params.set('kind', kind);

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
  els.uploadFolder?.addEventListener('change', () => {
    state.uploadFolder = els.uploadFolder.value;
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
    if (!state.galleryFolderOpen) return;
    if (els.galleryFolderPicker?.contains(e.target)) return;
    closeGalleryFolderMenu();
  });
  els.galleryKind?.addEventListener('change', () => {
    state.galleryKind = els.galleryKind.value;
    state.galleryLoaded = false;
    loadGallery(true);
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
    if (state.galleryFolderOpen) {
      closeGalleryFolderMenu();
      return;
    }
    if (!els.authOverlay.hidden) closeAccountSheet();
  });
}

bindEvents();
renderGalleryCrumbs();
refreshMe().catch(() => {
  document.body.classList.remove('is-booting');
  showLoginScreen();
});
