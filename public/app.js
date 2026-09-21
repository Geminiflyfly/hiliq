/**
 * Hiliq frontend — upload, paste, gallery, multi-format links.
 */

const TOKEN_KEY = 'hiliq_upload_token';

const els = {
  tabUpload: document.getElementById('tab-upload'),
  tabGallery: document.getElementById('tab-gallery'),
  viewUpload: document.getElementById('view-upload'),
  viewGallery: document.getElementById('view-gallery'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  progress: document.getElementById('upload-progress'),
  results: document.getElementById('upload-results'),
  galleryGrid: document.getElementById('gallery-grid'),
  galleryStatus: document.getElementById('gallery-status'),
  btnMore: document.getElementById('btn-more'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnSettings: document.getElementById('btn-settings'),
  overlay: document.getElementById('settings-overlay'),
  tokenInput: document.getElementById('token-input'),
  btnSaveToken: document.getElementById('btn-save-token'),
  btnClearToken: document.getElementById('btn-clear-token'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  toast: document.getElementById('toast'),
};

const state = {
  view: 'upload',
  cursor: null,
  loadingGallery: false,
  galleryLoaded: false,
};

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(value) {
  const v = (value || '').trim();
  if (v) localStorage.setItem(TOKEN_KEY, v);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra = {}) {
  const token = getToken();
  const headers = { ...extra };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Upload-Token'] = token;
  }
  return headers;
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

function switchView(view) {
  state.view = view;
  const isUpload = view === 'upload';

  els.viewUpload.hidden = !isUpload;
  els.viewGallery.hidden = isUpload;
  els.viewUpload.classList.toggle('is-visible', isUpload);
  els.viewGallery.classList.toggle('is-visible', !isUpload);

  els.tabUpload.classList.toggle('is-active', isUpload);
  els.tabGallery.classList.toggle('is-active', !isUpload);
  els.tabUpload.setAttribute('aria-selected', String(isUpload));
  els.tabGallery.setAttribute('aria-selected', String(!isUpload));

  if (!isUpload && !state.galleryLoaded) {
    loadGallery(true);
  }
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
    <img class="result-thumb" src="${formats.url}" alt="" loading="lazy" />
    <div>
      <p class="text-sm text-ink-600 mb-3">
        <span class="font-medium text-ink-950">${escapeHtml(data.key || '')}</span>
        ${data.size != null ? ` · ${formatSize(data.size)}` : ''}
      </p>
      <div class="result-links">
        ${rows
          .map(
            ([label, value], i) => `
          <div class="link-row">
            <label>${label}</label>
            <input type="text" readonly value="${escapeAttr(value)}" data-copy-index="${i}" />
            <button type="button" class="copy-btn" data-copy="${escapeAttr(value)}">复制</button>
          </div>`
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

  const form = new FormData();
  form.append('file', file, file.name || 'image');

  setProgress(true, 15, `正在上传 ${file.name || '图片'}…`);
  els.dropzone.classList.add('is-busy');

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });

    setProgress(true, 85, `处理响应…`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      throw new Error(data.error || `上传失败 (${res.status})`);
    }

    setProgress(true, 100, '完成');
    renderResult(data);
    showToast('上传成功');
    state.galleryLoaded = false;
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
      if (!key) return;
      if (!confirm(`确认删除？\n${key}`)) return;

      try {
        const res = await fetch('/api/delete', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ key }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || '删除失败');
        }
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
  state.loadingGallery = true;

  if (reset) {
    state.cursor = null;
    els.galleryStatus.textContent = '加载中…';
    els.btnMore.classList.add('hidden');
  }

  try {
    const params = new URLSearchParams({ limit: '24' });
    if (!reset && state.cursor) params.set('cursor', state.cursor);

    const res = await fetch(`/api/list?${params}`, {
      headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      throw new Error(data.error || `加载失败 (${res.status})`);
    }

    renderGalleryItems(data.images || [], !reset);
    state.cursor = data.cursor || null;
    state.galleryLoaded = true;

    const totalShown = els.galleryGrid.children.length;
    if (!totalShown) {
      els.galleryStatus.textContent = '还没有图片，先去上传一张吧。';
    } else {
      els.galleryStatus.textContent = `已显示 ${totalShown} 张${data.truncated ? '（还有更多）' : ''}`;
    }

    els.btnMore.classList.toggle('hidden', !data.truncated);
  } catch (err) {
    els.galleryStatus.textContent = err.message || '加载失败';
  } finally {
    state.loadingGallery = false;
  }
}

function openSettings() {
  els.tokenInput.value = getToken();
  els.overlay.hidden = false;
  els.tokenInput.focus();
}

function closeSettings() {
  els.overlay.hidden = true;
}

function bindEvents() {
  els.tabUpload.addEventListener('click', () => switchView('upload'));
  els.tabGallery.addEventListener('click', () => switchView('gallery'));

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
  els.btnRefresh.addEventListener('click', () => loadGallery(true));

  els.btnSettings.addEventListener('click', openSettings);
  els.btnCloseSettings.addEventListener('click', closeSettings);
  els.overlay.addEventListener('click', (e) => {
    if (e.target === els.overlay) closeSettings();
  });
  els.btnSaveToken.addEventListener('click', () => {
    setToken(els.tokenInput.value);
    showToast(getToken() ? '令牌已保存' : '已清除令牌');
    closeSettings();
  });
  els.btnClearToken.addEventListener('click', () => {
    els.tokenInput.value = '';
    setToken('');
    showToast('已清除令牌');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.overlay.hidden) closeSettings();
  });
}

bindEvents();
