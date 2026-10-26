// ==UserScript==
// @name         ChatGPT 개선 스크립트
// @namespace    naegyein.local
// @version      0.18.2
// @description  ChatGPT Chat 전용 UI 개선: 대화 폭, 안전 모델 고정, 링크 보완, 클립보드 이미지·파일 ZIP 첨부. Work에서는 비활성화됩니다.
// @homepageURL  https://github.com/NAEGYEIN/Personal-Scripts
// @supportURL   https://github.com/NAEGYEIN/Personal-Scripts/issues
// @updateURL    https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/chatgpt-tweaks/chatgpt-tweaks.meta.js
// @downloadURL  https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/chatgpt-tweaks/chatgpt-tweaks.user.js
// @match        https://chatgpt.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  // Keep existing CSS and setting keys compatible with in-place upgrades.
  const APP = 'cgpui';
  const VERSION = '0.18.2';
  const STORE_KEYS = {
    settings: 'cgpui.settings.v1',
    bindings: 'cgpui.bindings.v1',
  };
  const MODEL_LOCK_VALUES = ['off', 'GPT-6', 'GPT-5.6 Sol'];
  const DEFAULTS = {
    settings: {
      newChatLink: true, menuLinks: true, wideChat: true,
      chatMaxWidth: 1400, userBubbleMaxWidth: 760,
      modelLock: 'off',
    },
    bindings: {newChat: null, modelButton: null},
  };
  let persistedShadow = null;
  let state = loadState();
  let panelOpen = false;
  let activeTab = 'settings';
  let overlayTarget = null;
  let picker = null;
  let previousFocus = null;
  const diag = {
    surface: 'unknown',
    newChatTarget: false,
    newChatOverlay: false,
    projectChatTargets: 0,
    modelLock: 'OFF',
    modelTrigger: '미검사',
    modelLastApplied: null,
  };
  // Validated public ChatGPT destinations. Prefer an existing real href when available.
  // Canva's official "Try Canva in ChatGPT" destination uses ?hints=canva.
  const MENU_LINKS = [
   {id: 'scheduled', label: '예약', names: ['예약', '예약됨', 'Scheduled', 'Tasks'], path: '/scheduled'},
   {id: 'library', label: '라이브러리', names: ['라이브러리', 'Library'], path: '/library'},
   {id: 'plugins', label: '플러그인', names: ['플러그인', 'Plugins'], path: '/plugins'},
   {id: 'maps', label: '지도', names: ['지도', 'Maps'], path: '/maps', explore: true},
   {id: 'images', label: '이미지', names: ['이미지', 'Images'], path: '/images', explore: true},
   {id: 'gpts', label: 'GPT', names: ['GPT', 'GPTs', 'Explore GPTs'], path: '/gpts', explore: true},
   {id: 'sites', label: '사이트', names: ['사이트', 'Sites'], path: '/sites', explore: true},
   {id: 'canva', label: 'Canva', names: ['Canva'], path: '/?hints=canva', explore: true},
 ];
  const menuOverlays = new Map();
  const projectChatOverlays = new Map();
  const diagMenus = Object.create(null);
  let currentSurface = 'unknown';
  let surfaceSettleTimer = 0;

  // ChatGPT Conversation Exporter (MIT) uses the real page window for its
  // capture-phase paste listener when GM_* grants put the userscript in a
  // sandbox. Keep this listener in the page realm as well.
  const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  pageWindow.addEventListener('paste', handleClipboardZipPaste, true);

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function storeGet(key, fallback = undefined) {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('[ChatGPT 개선 스크립트] store get failed', key, e);
      return fallback;
    }
  }

  function storeSet(key, value) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(key, value);
      else localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[ChatGPT 개선 스크립트] store set failed', key, e);
      return false;
    }
  }

  function normalizeSlice(name, value) {
     const result = clone(DEFAULTS[name]);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const key of Object.keys(result)) {
      if (name === 'bindings') {
        if (value[key] && typeof value[key] === 'object' && !Array.isArray(value[key])) result[key] = value[key];
      } else if (typeof result[key] === 'boolean') {
        if (typeof value[key] === 'boolean') result[key] = value[key];
      } else if (typeof result[key] === 'string') {
        if (typeof value[key] === 'string') result[key] = value[key];
      } else if (Number.isFinite(Number(value[key]))) {
        result[key] = Number(value[key]);
      }
    }
    if (name === 'settings' && !MODEL_LOCK_VALUES.includes(result.modelLock)) result.modelLock = 'off';
    return result;
  }

  function normalizeState(value) {
    return Object.fromEntries(Object.keys(STORE_KEYS).map(name => [name, normalizeSlice(name, value?.[name])]));
  }

  function loadState() {
    const next = clone(DEFAULTS);
    let legacy = null;
    try {
      const raw = localStorage.getItem('cgpui.state.v2') || localStorage.getItem('cgpui.state.v1');
      if (raw) legacy = JSON.parse(raw);
    } catch {}
    for (const [name, key] of Object.entries(STORE_KEYS)) {
      next[name] = normalizeSlice(name, storeGet(key, legacy?.[name]));
    }
    persistedShadow = clone(next);
    return next;
  }

  function saveState() {
    try {
      if (!persistedShadow) persistedShadow = clone(DEFAULTS);
      for (const [name, key] of Object.entries(STORE_KEYS)) {
        const current = normalizeSlice(name, state[name]);
        const previous = normalizeSlice(name, persistedShadow[name]);
        if (JSON.stringify(current) === JSON.stringify(previous)) continue;
        if (storeSet(key, current)) persistedShadow[name] = clone(current);
      }
    } catch (e) { console.warn('[ChatGPT 개선 스크립트] state save failed', e); }
  }

  function applyRemoteSlice(name, value) {
    const previousModel = state.settings?.modelLock;
    state[name] = normalizeSlice(name, value);
    persistedShadow[name] = clone(state[name]);
    applyAll();
    if (name === 'settings' && previousModel !== state.settings.modelLock) {
      modelLockController?.onSettingChange(previousModel, state.settings.modelLock, 'cross-tab-setting');
    }
    if (panelOpen) renderPanel();
  }

  function setupCrossTabSync() {
    if (typeof GM_addValueChangeListener === 'function') {
      for (const [name, key] of Object.entries(STORE_KEYS)) {
        GM_addValueChangeListener(key, (_k, _oldValue, newValue, remote) => {
          if (remote) applyRemoteSlice(name, newValue);
        });
      }
      return;
    }
    window.addEventListener('storage', e => {
      const pair = Object.entries(STORE_KEYS).find(([, key]) => key === e.key);
      if (!pair || e.newValue == null) return;
      try { applyRemoteSlice(pair[0], JSON.parse(e.newValue)); } catch {}
    });
  }

  function textOf(el) {
    return (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function debounce(fn, ms) {
    let t = 0;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function normalizeInteractive(el) {
    return el?.closest('a, button, [role="button"]') || el || null;
  }

  function fingerprint(el, type) {
    el = normalizeInteractive(el);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      testid: el.getAttribute('data-testid') || '',
      aria: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      role: el.getAttribute('role') || '',
      href: el.getAttribute('href') || '',
      text: textOf(el).slice(0, 120),
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
    };
  }

  function candidatePool() {
    return [...document.querySelectorAll('a, button, [role="button"]')]
      .filter(el => !isOwnedNode(el) && visible(el));
  }

  function scoreFingerprint(el, fp) {
    let s = 0;
    const r = el.getBoundingClientRect();
    if (fp.tag && el.tagName.toLowerCase() === fp.tag) s += 6;
    if (fp.id && el.id === fp.id) s += 100;
    if (fp.testid && el.getAttribute('data-testid') === fp.testid) s += 90;
    if (fp.aria && el.getAttribute('aria-label') === fp.aria) s += 75;
    if (fp.title && el.getAttribute('title') === fp.title) s += 60;
    if (fp.role && el.getAttribute('role') === fp.role) s += 12;
    if (fp.href && el.getAttribute('href') === fp.href) s += 50;
    if (fp.text && textOf(el).slice(0,120) === fp.text) s += 35;
    const dist = Math.hypot(r.left - (fp.x || 0), r.top - (fp.y || 0));
    if (dist < 40) s += 18; else if (dist < 120) s += 8;
    return s;
  }

  function resolveBinding(name, type) {
    const fp = state.bindings[name];
    if (!fp) return null;
    const pool = candidatePool();
    let best = null, bestScore = 0;
    for (const el of pool) {
      const score = scoreFingerprint(el, fp);
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return bestScore >= 30 ? normalizeInteractive(best) : null;
  }

  function semanticBlob(el) {
    return [
      el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-testid'),
      el.getAttribute('href'), textOf(el)
    ].filter(Boolean).join(' | ').toLowerCase();
  }

  const SURFACE_CONTROL_SELECTOR = 'button,[role="tab"],[role="radio"],[role="menuitemradio"],[aria-pressed],[aria-selected],[aria-checked],[data-state]';
  const SURFACE_LABELS = {
    chat: new Set(['chat', '채팅', '챗']),
    work: new Set(['work', '워크', '작업']),
  };

  function normalizedSurfaceLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function surfaceFromLabel(value) {
    const label = normalizedSurfaceLabel(value);
    if (!label) return null;
    if (SURFACE_LABELS.chat.has(label)) return 'chat';
    if (SURFACE_LABELS.work.has(label)) return 'work';
    return null;
  }

  function surfaceFromControl(el) {
    if (!el) return null;
    for (const value of [el.getAttribute('aria-label'), el.getAttribute('title'), textOf(el)]) {
      const surface = surfaceFromLabel(value);
      if (surface) return surface;
    }
    return null;
  }

  function controlHasSelectedState(el) {
    const state = String(el?.getAttribute?.('data-state') || '').toLowerCase();
    return el?.getAttribute?.('aria-selected') === 'true'
      || el?.getAttribute?.('aria-pressed') === 'true'
      || el?.getAttribute?.('aria-checked') === 'true'
      || el?.getAttribute?.('data-active') === 'true'
      || ['active', 'on', 'checked', 'selected'].includes(state);
  }

  function isLikelySurfaceSwitcherControl(el) {
    if (!el) return false;
    const meta = [
      el.id || '',
      el.getAttribute('data-testid') || '',
      el.getAttribute('data-slot') || '',
      el.getAttribute('name') || '',
      el.getAttribute('role') || '',
    ].join(' ').toLowerCase();
    if (/(?:mode|experience|surface|chat[-_ ]?work|work[-_ ]?chat)/i.test(meta)) return true;

    let host = el.parentElement;
    for (let depth = 0; host && depth < 4; depth++, host = host.parentElement) {
      const r = host.getBoundingClientRect?.();
      if (r && (r.width > 560 || r.height > 220)) break;
      let hasChat = false, hasWork = false, labeledControls = 0;
      for (const control of host.querySelectorAll?.(SURFACE_CONTROL_SELECTOR) || []) {
        const surface = surfaceFromControl(control);
        if (!surface) continue;
        labeledControls++;
        if (surface === 'chat') hasChat = true;
        else if (surface === 'work') hasWork = true;
        if (hasChat && hasWork && labeledControls <= 6) return true;
      }
    }
    return false;
  }

  function activeSurfaceFromDom() {
    for (const el of document.querySelectorAll(SURFACE_CONTROL_SELECTOR)) {
      if (!visible(el) || isOwnedNode(el)) continue;
      const surface = surfaceFromControl(el);
      if (!surface || !isLikelySurfaceSwitcherControl(el)) continue;
      if (controlHasSelectedState(el)) return surface;
      if (el.tagName === 'BUTTON' && el.hasAttribute('aria-haspopup') && !el.closest('[role="menu"],[role="listbox"]')) {
        return surface;
      }
    }
    return null;
  }

  function surfaceFromRoute() {
    try {
      const url = new URL(location.href);
      if (/^\/work(?:\/|$)/i.test(url.pathname)) return 'work';
      for (const key of ['mode', 'experience', 'surface']) {
        const value = surfaceFromLabel(url.searchParams.get(key));
        if (value) return value;
      }
    } catch {}
    return null;
  }

  function detectSurface({allowDefault = false} = {}) {
    return surfaceFromRoute() || activeSurfaceFromDom() || (allowDefault ? 'chat' : currentSurface);
  }

  function isChatSurface() {
    return currentSurface === 'chat';
  }

  function clickedSurfaceControl(node) {
    const el = node?.closest?.(SURFACE_CONTROL_SELECTOR);
    if (!el || !isLikelySurfaceSwitcherControl(el)) return null;
    return surfaceFromControl(el);
  }

  function findNewChatAuto() {
    let best = null, bestScore = 0;
    for (const el of candidatePool()) {
      const b = semanticBlob(el);
      const r = el.getBoundingClientRect();
      let s = 0;
      if (/new\s*chat|새\s*채팅|新しいチャット|新規チャット/i.test(b)) s += 120;
      if (/create.*chat|chat.*create/i.test(b)) s += 70;
      if ((el.getAttribute('href') || '') === '/') s += 45;
      if (/new-chat|create-new-chat/i.test(el.getAttribute('data-testid') || '')) s += 100;
      if (r.left < 520 && r.top < 220) s += 16;
      if (el.tagName === 'BUTTON' || el.tagName === 'A') s += 4;
      if (s > bestScore) { best = el; bestScore = s; }
    }
    return bestScore >= 60 ? best : null;
  }

  function findByBindingOrAuto(name, type, autoFn) {
    return resolveBinding(name, type) || autoFn();
  }

  function normalizedModelLock() {
    return MODEL_LOCK_VALUES.includes(state.settings.modelLock) ? state.settings.modelLock : 'off';
  }


  // Clipboard file/image paste -> in-memory ZIP attachment.
  // Plain text copied from a page stays a normal paste; actual .txt files are ZIP-packed like other files.
  //
  // Proven patterns adapted from MIT-licensed projects:
  // - Soluna-Angelito/chatgpt-conversation-exporter: page-window capture listener,
  //   composedPath-based ProseMirror composer detection.
  // - skranz/chatgpt_clipboard: direct unified-composer file-input injection
  //   with DataTransfer + change event.
  // Full notices: chatgpt-tweaks/THIRD-PARTY.md
  const CLIPBOARD_ZIP_MAX_BYTES = 500 * 1024 * 1024;
  const CLIPBOARD_COMPOSER_SELECTORS = [
    '#prompt-textarea.ProseMirror[contenteditable="true"]',
    '#prompt-textarea[contenteditable="true"]',
    'form[data-type="unified-composer"] div.ProseMirror[contenteditable="true"]',
  ];
  const CLIPBOARD_UPLOAD_SELECTORS = [
    '#upload-files',
    'form[data-type="unified-composer"] input[type="file"]',
  ];
  const MIME_EXTENSION = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'text/plain': '.txt',
    'text/html': '.html',
    'application/pdf': '.pdf',
  };
  const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function matchClipboardComposer(node) {
    if (!node || node.nodeType !== 1 || typeof node.matches !== 'function') return null;
    for (const selector of CLIPBOARD_COMPOSER_SELECTORS) {
      try { if (node.matches(selector)) return node; } catch {}
    }
    return null;
  }

  function findClipboardComposer(event) {
    let path = [];
    try { path = typeof event.composedPath === 'function' ? event.composedPath() : []; } catch {}
    if (!path.length && event.target) path = [event.target];

    for (const node of path) {
      if (!node || node.nodeType !== 1) continue;
      const tag = node.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return null;
      if (tag === 'BODY' || tag === 'HTML') break;
      const hit = matchClipboardComposer(node);
      if (hit) return hit;
    }

    const active = document.activeElement;
    if (active && active.tagName !== 'TEXTAREA' && active.tagName !== 'INPUT') {
      const direct = matchClipboardComposer(active);
      if (direct) return direct;
      if (typeof active.closest === 'function') {
        for (const selector of CLIPBOARD_COMPOSER_SELECTORS) {
          try {
            const hit = active.closest(selector);
            if (hit) return hit;
          } catch {}
        }
      }
    }
    return null;
  }

  function clipboardFiles(data) {
    if (!data) return [];
    const files = [];
    const seen = new Set();
    const add = file => {
      if (!file || typeof file.arrayBuffer !== 'function') return;
      const key = [file.name || '', file.type || '', file.size || 0, file.lastModified || 0].join('\u0000');
      if (seen.has(key)) return;
      seen.add(key);
      files.push(file);
    };
    try {
      for (const item of data.items || []) {
        if (item.kind !== 'file') continue;
        try { add(item.getAsFile()); } catch {}
      }
    } catch {}
    try { for (const file of data.files || []) add(file); } catch {}
    return files;
  }

  function zipSafeName(name, index, type, used) {
    const inferred = MIME_EXTENSION[String(type || '').toLowerCase()] || '';
    let base = String(name || '').trim() || ('clipboard-' + (index + 1) + inferred);
    base = base.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').replace(/[. ]+$/g, '');
    if (!base) base = 'clipboard-' + (index + 1) + inferred;
    if (!/\.[a-z0-9]{1,10}$/i.test(base) && inferred) base += inferred;
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) candidate = stem + '-' + suffix++ + ext;
    used.add(candidate.toLowerCase());
    return candidate;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipDosDateTime(ms) {
    const d = new Date(ms || Date.now());
    const year = Math.min(2107, Math.max(1980, d.getFullYear()));
    return {
      time: ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f),
      date: (((year - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f),
    };
  }

  function setU16(view, offset, value) { view.setUint16(offset, value & 0xffff, true); }
  function setU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

  async function buildClipboardZip(files) {
    const encoder = new TextEncoder();
    const usedNames = new Set();
    const entries = [];
    let totalBytes = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalBytes += Number(file.size) || 0;
      if (totalBytes > CLIPBOARD_ZIP_MAX_BYTES) throw new Error('클립보드 파일 합계가 500MB를 초과합니다.');
      const data = new Uint8Array(await file.arrayBuffer());
      entries.push({
        name: zipSafeName(file.name, i, file.type, usedNames),
        nameBytes: null,
        data,
        crc: crc32(data),
        modified: zipDosDateTime(file.lastModified),
        offset: 0,
      });
    }
    if (!entries.length) throw new Error('ZIP으로 묶을 파일이 없습니다.');

    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    for (const entry of entries) {
      entry.nameBytes = encoder.encode(entry.name);
      entry.offset = localOffset;

      const local = new Uint8Array(30);
      const lv = new DataView(local.buffer);
      setU32(lv, 0, 0x04034b50);
      setU16(lv, 4, 20);
      setU16(lv, 6, 0x0800);
      setU16(lv, 8, 0);
      setU16(lv, 10, entry.modified.time);
      setU16(lv, 12, entry.modified.date);
      setU32(lv, 14, entry.crc);
      setU32(lv, 18, entry.data.length);
      setU32(lv, 22, entry.data.length);
      setU16(lv, 26, entry.nameBytes.length);
      setU16(lv, 28, 0);
      localParts.push(local, entry.nameBytes, entry.data);
      localOffset += local.length + entry.nameBytes.length + entry.data.length;

      const central = new Uint8Array(46);
      const cv = new DataView(central.buffer);
      setU32(cv, 0, 0x02014b50);
      setU16(cv, 4, 20);
      setU16(cv, 6, 20);
      setU16(cv, 8, 0x0800);
      setU16(cv, 10, 0);
      setU16(cv, 12, entry.modified.time);
      setU16(cv, 14, entry.modified.date);
      setU32(cv, 16, entry.crc);
      setU32(cv, 20, entry.data.length);
      setU32(cv, 24, entry.data.length);
      setU16(cv, 28, entry.nameBytes.length);
      setU16(cv, 30, 0);
      setU16(cv, 32, 0);
      setU16(cv, 34, 0);
      setU16(cv, 36, 0);
      setU32(cv, 38, 0);
      setU32(cv, 42, entry.offset);
      centralParts.push(central, entry.nameBytes);
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    setU32(ev, 0, 0x06054b50);
    setU16(ev, 4, 0);
    setU16(ev, 6, 0);
    setU16(ev, 8, entries.length);
    setU16(ev, 10, entries.length);
    setU32(ev, 12, centralSize);
    setU32(ev, 16, localOffset);
    setU16(ev, 20, 0);

    const stamp = (() => {
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    })();

    const PageBlob = pageWindow.Blob || Blob;
    const PageFile = pageWindow.File || File;
    const blob = new PageBlob([...localParts, ...centralParts, end], {type: 'application/zip'});
    return new PageFile([blob], 'clipboard-' + stamp + '.zip', {type: 'application/zip', lastModified: Date.now()});
  }

  function findChatUploadInput() {
    for (const selector of CLIPBOARD_UPLOAD_SELECTORS) {
      const input = document.querySelector(selector);
      if (input && input.type === 'file' && !input.disabled) return input;
    }
    return null;
  }

  function injectClipboardZip(input, file) {
    const PageDataTransfer = pageWindow.DataTransfer || DataTransfer;
    const PageEvent = pageWindow.Event || Event;
    const transfer = new PageDataTransfer();
    transfer.items.add(file);
    try { input.value = ''; } catch {}
    input.files = transfer.files;

    input.dispatchEvent(new PageEvent('input', {bubbles: true, composed: true}));
    input.dispatchEvent(new PageEvent('change', {bubbles: true, composed: true}));
    return input.files?.length === 1 && input.files[0]?.name === file.name;
  }

  async function handleClipboardZipPaste(event) {
    if (location.protocol !== 'https:' || location.hostname !== 'chatgpt.com') return;
    if (surfaceFromRoute() === 'work' || currentSurface === 'work') return;

    const clip = event.clipboardData;
    if (!clip) return;

    const files = clipboardFiles(clip);
    if (!files.length) return;

    const composer = findClipboardComposer(event);
    if (!composer) return;

    const input = findChatUploadInput();
    if (!input) return;

    const totalBytes = files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
    if (totalBytes > CLIPBOARD_ZIP_MAX_BYTES) {
      toast('클립보드 파일 합계가 500MB를 넘어 ZIP 변환을 건너뜁니다.', 3500);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      const zipFile = await buildClipboardZip(files);
      if (!injectClipboardZip(input, zipFile)) throw new Error('file input did not retain the generated ZIP');
      console.info('[ChatGPT 개선 스크립트] clipboard ZIP injected', {
        zip: zipFile.name,
        sourceCount: files.length,
        sourceBytes: totalBytes,
        inputId: input.id || null,
      });
      toast('클립보드 원본을 ZIP 첨부로 변환했습니다.', 2200);
    } catch (error) {
      console.warn('[ChatGPT 개선 스크립트] clipboard ZIP injection failed', error);
      toast('클립보드 ZIP 첨부에 실패했습니다. 다시 Ctrl+V 하면 기본 붙여넣기가 동작합니다.', 4000);
    }
  }
  const EDITOR_SELECTOR = '#prompt-textarea,textarea,input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),[contenteditable="true"],[role="textbox"]';
  const MODEL_POPUP_SELECTOR = '[role="menu"],[role="listbox"],[role="dialog"],[data-radix-popper-content-wrapper],[data-state="open"][data-side],[data-slot*="popover" i],[data-slot*="menu-content" i]';
  const THINKING_LEVEL_RE = /(?:^|\s)(?:auto|instant|medium|high|extra\s*high|자동|빠름|중간|높음)(?:\s|$)|추론\s*(?:수준|레벨)|thinking\s*(?:level|effort)/i;
  const MODEL_SELECTOR_HINT_RE = /chatgpt\s*모델\s*선택|모델\s*(?:선택|변경|고르기)|model\s*(?:selector|selection|picker|choose|switch)|select\s+(?:a\s+)?model|choose\s+(?:a\s+)?model/i;
  const MODEL_SURFACE_RE = /(?:gpt[- ]?6|(?:^|\s)6(?:\s|$)|gpt[- ]?5\.6|(?:^|\s)5\.6(?:\s|$)|모델\s*(?:선택|변경)|model\s*(?:selector|selection|picker|choose|switch)|추론\s*(?:수준|레벨)|thinking\s*(?:level|effort)|\b(?:auto|instant|medium|high|extra\s*high)\b)/i;
  const MODEL_CHOICE_ALIASES = {
    'GPT-6': ['GPT-6', 'GPT 6', '6'],
    'GPT-5.6 Sol': ['GPT-5.6 Sol', 'GPT 5.6 Sol', '5.6 Sol', 'GPT-5.6', 'GPT 5.6', '5.6'],
  };

  function editorFrom(node) {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    return el?.closest?.(EDITOR_SELECTOR) || null;
  }

  function modelChoiceText(el) {
    return textOf(el).replace(/\s+/g, ' ').trim();
  }

  function currentModelFromText(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    if (/(?:^|\s)(?:gpt[- ]*)?5\.6(?:\s|$)/i.test(text)) return 'GPT-5.6 Sol';
    const withoutChatGpt = text.replace(/chatgpt/ig, ' ');
    if (/(?:^|\s)(?:gpt[- ]*)?6(?:\s|$)/i.test(withoutChatGpt)) return 'GPT-6';
    return null;
  }

  function currentModelFromTrigger(el) {
    if (!el) return null;
    return currentModelFromText([
      textOf(el), el.getAttribute('aria-label') || '', el.getAttribute('title') || '', el.getAttribute('data-testid') || ''
    ].join(' | '));
  }

  function targetChoiceMatchesText(target, value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    const aliases = (MODEL_CHOICE_ALIASES[target] || [target]).slice().sort((a, b) => b.length - a.length);
    const lower = text.toLowerCase();
    for (const alias of aliases) {
      const a = alias.toLowerCase();
      if (lower === a) return true;
      if (!lower.startsWith(`${a} `)) continue;
      const rest = lower.slice(a.length).trim();
      // A row such as "5.6 Medium" is the thinking-effort gateway, not a model choice.
      if (/^(?:auto|instant|medium|high|extra\s*high|자동|빠름|중간|높음)(?:\s|$)/i.test(rest)) continue;
      return true;
    }
    return false;
  }

  function modelChoiceCandidates(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    return [...root.querySelectorAll('button,[role="menuitem"],[role="menuitemradio"],[role="option"],[data-radix-collection-item],[data-slot*="menu-item" i]')]
      .filter(el => !isOwnedNode(el) && visible(el));
  }

  function popupLayers() {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll(MODEL_POPUP_SELECTOR)) {
      if (seen.has(el) || !visible(el) || isOwnedNode(el)) continue;
      seen.add(el);
      out.push(el);
    }
    return out;
  }

  function modelPopupLayers() {
    return popupLayers().filter(el => {
      const blob = [textOf(el), el.getAttribute('aria-label') || '', el.getAttribute('data-testid') || ''].join(' ');
      return MODEL_SURFACE_RE.test(blob);
    });
  }

  function popupForElement(el) {
    return el?.closest?.(MODEL_POPUP_SELECTOR) || null;
  }

  function popupLinkedToTrigger(trigger) {
    if (!trigger) return null;
    const id = trigger.getAttribute('aria-controls');
    if (id) {
      const linked = document.getElementById(id);
      if (linked && visible(linked)) return linked.closest(MODEL_POPUP_SELECTOR) || linked;
    }
    return null;
  }

  function findPopupOpenedAfter(before, trigger) {
    const linked = popupLinkedToTrigger(trigger);
    if (linked) return linked;
    const now = popupLayers();
    for (let i = now.length - 1; i >= 0; i--) if (!before.has(now[i])) return now[i];
    return null;
  }

  function inOpenPopup(el) {
    return !!popupForElement(el);
  }

  function findVisibleModelChoice(target, scope = null) {
    let best = null, bestScore = -1;
    for (const el of modelChoiceCandidates(scope || document)) {
      const txt = modelChoiceText(el);
      if (!targetChoiceMatchesText(target, txt)) continue;
      let score = 0;
      if (inOpenPopup(el)) score += 100;
      const role = el.getAttribute('role') || '';
      if (/menuitemradio|option/i.test(role)) score += 35;
      else if (/menuitem/i.test(role)) score += 20;
      if (el.hasAttribute('data-radix-collection-item')) score += 15;
      if (txt.toLowerCase().includes('sol')) score += 12;
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return bestScore >= 20 ? best : null;
  }

  function findModelGateway(scope) {
    if (!scope) return null;
    let best = null, bestScore = -1;
    for (const el of modelChoiceCandidates(scope)) {
      const txt = modelChoiceText(el);
      const family = currentModelFromText(txt);
      if (!family || !THINKING_LEVEL_RE.test(txt)) continue;
      if (targetChoiceMatchesText(family, txt)) continue;
      let score = 50;
      const role = el.getAttribute('role') || '';
      if (/menuitem|button/i.test(role) || el.tagName === 'BUTTON') score += 20;
      if ((el.getAttribute('aria-haspopup') || '').match(/menu|listbox|dialog/i)) score += 20;
      if (/›|>|chevron|다음|more/i.test([txt, el.getAttribute('aria-label') || '', el.getAttribute('data-testid') || ''].join(' '))) score += 10;
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return bestScore >= 50 ? best : null;
  }

  function composerAnchor() {
    const selectors = ['#prompt-textarea', 'textarea', '[contenteditable="true"][data-lexical-editor="true"]', '[contenteditable="true"]'];
    for (const selector of selectors) {
      const el = [...document.querySelectorAll(selector)].find(node => visible(node) && !isOwnedNode(node));
      if (el) return el;
    }
    return null;
  }

  function describeModelTrigger(el) {
    if (!el || !visible(el) || el.closest(MODEL_POPUP_SELECTOR)) return {score: -Infinity, model: null, thinkingOnly: false};
    const b = semanticBlob(el);
    const t = textOf(el);
    const r = el.getBoundingClientRect();
    const model = currentModelFromTrigger(el);
    const metaBlob = [el.getAttribute('aria-label') || '', el.getAttribute('title') || '', el.getAttribute('data-testid') || ''].join(' ');
    const selectorHint = MODEL_SELECTOR_HINT_RE.test(b);
    const thinkingHint = THINKING_LEVEL_RE.test(b);
    const thinkingMetaHint = THINKING_LEVEL_RE.test(metaBlob);
    // A dedicated thinking-effort control can include the current model name in
    // its visible text (e.g. "5.6 High"). Metadata that explicitly says
    // thinking/effort wins unless the same control is also identified as a
    // model selector.
    const thinkingOnly = thinkingMetaHint && !selectorHint;
    let score = 0;
    if (selectorHint) score += 180;
    if (model) score += 115;
    if ((el.getAttribute('aria-haspopup') || '').match(/menu|listbox|dialog/i)) score += 24;
    if (thinkingHint && model) score += 8; // combined model + effort control, e.g. "5.6 High"
    if (thinkingOnly) score -= 240;
    const anchor = composerAnchor();
    const ar = anchor?.getBoundingClientRect();
    if (ar) {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ax = ar.left + ar.width / 2, ay = ar.top + ar.height / 2;
      const dx = Math.abs(cx - ax), dy = Math.abs(cy - ay);
      if (dy < 150 && dx < Math.max(620, ar.width)) score += 22;
      else if (dy < 260) score += 6;
    }
    if (r.width >= 50 && r.width <= 360 && r.height >= 22 && r.height <= 90) score += 5;
    return {score, model, thinkingOnly, selectorHint, thinkingHint, text: t};
  }

  function findModelButtonAuto() {
    let best = null, bestScore = -Infinity;
    for (const el of candidatePool()) {
      if (el.tagName !== 'BUTTON' && el.getAttribute('role') !== 'button') continue;
      const info = describeModelTrigger(el);
      if (info.thinkingOnly) continue;
      if (info.score > bestScore) { best = el; bestScore = info.score; }
    }
    return bestScore >= 100 ? best : null;
  }

  function findModelButton() {
    const bound = resolveBinding('modelButton', 'button');
    if (bound) {
      const info = describeModelTrigger(bound);
      if (!info.thinkingOnly && info.score >= 70) return bound;
    }
    return findModelButtonAuto();
  }

  function modelRouteKey(href = location.href) {
    try {
      const url = new URL(href, location.origin);
      if (url.pathname === '/' || url.pathname === '') return 'new';
      const m = url.pathname.match(/^\/c\/([^/?#]+)/);
      if (m) return `conversation:${m[1]}`;
      return `path:${url.pathname}`;
    } catch {
      return String(href || 'unknown').split(/[?#]/, 1)[0];
    }
  }

  function isNewConversationPromotion(previous, next) {
    return previous === 'new' && /^conversation:/.test(next);
  }

  class ModelLockController {
    constructor() {
      this.phase = 'boot';
      this.busy = false;
      this.requested = false;
      this.superseded = false;
      this.epoch = 1;
      this.routeUrl = location.href;
      this.routeKey = modelRouteKey(location.href);
      this.routeStartedAt = performance.now();
      this.sessionTouched = false;
      this.composing = false;
      this.retryCount = 0;
      this.repairCount = 0;
      this.retryTimer = 0;
      this.verifyTimer = 0;
      this.blockedUntilLifecycle = false;
      this.lastReason = 'boot';
      this.lastAppliedAt = 0;
      this.lastTrigger = null;
      this.lastResult = '미검사';
      this.lastAction = 'none';
      this.currentModel = null;
      this.popupStatus = '미검사';
      this.ownedPopup = null;
      this.ownedTrigger = null;
      this.earlyObserver = null;
      this.domObserver = null;
      this.startedEarly = false;
      this.startedDom = false;
      this.routeHooksInstalled = false;
      this.safetyHooksInstalled = false;
      this.retryDelays = [80, 160, 320, 650, 1200];
      this.events = [];
      this.record('init', {routeKey: this.routeKey});
    }

    enabled() { return isChatSurface() && normalizedModelLock() !== 'off'; }

    record(event, detail = {}) {
      const clean = {};
      for (const [key, value] of Object.entries(detail || {})) {
        if (value == null || ['string','number','boolean'].includes(typeof value)) clean[key] = value;
      }
      this.events.push({t: Date.now(), event, phase: this.phase, ...clean});
      if (this.events.length > 48) this.events.splice(0, this.events.length - 48);
    }

    snapshot() {
      const trigger = findModelButton();
      return {
        target: normalizedModelLock(), phase: this.phase, busy: this.busy,
        sessionTouched: this.sessionTouched, composing: this.composing,
        retryCount: this.retryCount, repairCount: this.repairCount,
        blockedUntilLifecycle: this.blockedUntilLifecycle,
        lastReason: this.lastReason, lastAction: this.lastAction,
        lastResult: this.lastResult, lastAppliedAt: this.lastAppliedAt || null,
        currentModel: currentModelFromTrigger(trigger),
        popupStatus: this.popupStatus, popupCount: modelPopupLayers().length,
        visibility: document.visibilityState, readyState: document.readyState,
        routeKey: this.routeKey,
        trigger: fingerprint(trigger, 'button'),
        recentEvents: this.events.slice(-24),
      };
    }

    setDiag(status, triggerStatus = null) {
      this.lastResult = status;
      diag.modelLock = status;
      if (triggerStatus != null) diag.modelTrigger = triggerStatus;
      if (panelOpen) renderPanel();
    }

    clearTimers() {
      clearTimeout(this.retryTimer); this.retryTimer = 0;
      clearTimeout(this.verifyTimer); this.verifyTimer = 0;
    }

    clearOwnership() {
      this.ownedPopup = null;
      this.ownedTrigger = null;
    }

    cancel(reason, {keepRequested = false} = {}) {
      this.epoch++;
      if (this.busy) this.superseded = true;
      if (!keepRequested) this.requested = false;
      this.clearTimers();
      this.lastReason = reason;
      this.record('cancel', {reason, keepRequested});
    }

    markComposerTouched(reason, composing = null) {
      if (composing != null) this.composing = composing;
      this.sessionTouched = true;
      this.cancel(`composer:${reason}`);
      this.phase = 'suspended-input';
      this.lastAction = 'input-protect';
      this.setDiag(`대기 · 입력 보호 (${normalizedModelLock()})`);
      this.record('input-protect', {reason, composing: this.composing, popupOwned: !!this.ownedPopup});
    }

    resetLifecycle(reason, {resetInput = true} = {}) {
      this.cancel(reason);
      if (resetInput) {
        this.sessionTouched = false;
        this.composing = false;
      }
      this.retryCount = 0;
      this.repairCount = 0;
      this.blockedUntilLifecycle = false;
      this.routeStartedAt = performance.now();
      this.lastTrigger = null;
      this.clearOwnership();
      this.phase = 'waiting';
      this.record('lifecycle-reset', {reason, resetInput});
      if (this.enabled()) this.request(reason, 0);
    }

    safeToManipulate() {
      if (!this.enabled() || panelOpen || picker) return false;
      if (this.sessionTouched || this.composing) return false;
      if (document.visibilityState !== 'visible') return false;
      return true;
    }

    tokenValid(token) {
      return token === this.epoch && this.safeToManipulate();
    }

    request(reason = 'auto', delay = 0, {force = false} = {}) {
      if (!this.enabled()) {
        this.phase = 'off';
        this.setDiag('OFF', '미검사');
        return;
      }
      this.lastReason = reason;
      if (this.blockedUntilLifecycle && !force) {
        this.record('request-blocked', {reason});
        return;
      }
      if (this.busy) {
        if (this.superseded) this.requested = true;
        return;
      }
      this.requested = true;
      if (!this.safeToManipulate()) {
        if (this.sessionTouched || this.composing) {
          this.phase = 'suspended-input';
          this.setDiag(`대기 · 입력 보호 (${normalizedModelLock()})`);
        } else if (document.visibilityState !== 'visible') {
          this.phase = 'suspended-hidden';
          this.setDiag(`대기 · 비활성 탭 (${normalizedModelLock()})`);
        } else {
          this.phase = 'waiting-ui';
          this.setDiag(`대기 · 설정 UI (${normalizedModelLock()})`);
        }
        return;
      }
      clearTimeout(this.retryTimer);
      if (delay <= 0) queueMicrotask(() => this.drain());
      else this.retryTimer = setTimeout(() => { this.retryTimer = 0; this.drain(); }, delay);
      this.record('request', {reason, delay});
    }

    scheduleRetry(reason) {
      if (!this.enabled() || this.sessionTouched || this.composing || this.blockedUntilLifecycle) return;
      if (this.retryCount >= this.retryDelays.length) {
        this.phase = 'waiting-dom';
        this.setDiag(`대기 · 모델 버튼 미검출 (${normalizedModelLock()})`);
        this.record('retry-exhausted', {reason});
        return;
      }
      const delay = this.retryDelays[this.retryCount++];
      this.request(reason, delay);
    }

    schedulePassiveVerify(token) {
      clearTimeout(this.verifyTimer);
      this.verifyTimer = setTimeout(() => {
        this.verifyTimer = 0;
        if (token !== this.epoch || !this.enabled() || this.sessionTouched || this.composing) return;
        const trigger = findModelButton();
        const observed = currentModelFromTrigger(trigger);
        this.currentModel = observed;
        this.record('passive-verify', {observed: observed || 'unknown', target: normalizedModelLock()});
        if (observed === normalizedModelLock()) {
          this.phase = 'stable';
          this.setDiag(`PASS · ${normalizedModelLock()}`);
          return;
        }
        if (observed && observed !== normalizedModelLock() && this.repairCount < 1 && this.safeToManipulate()) {
          this.repairCount++;
          this.phase = 'waiting';
          this.request('passive-drift-repair', 0);
          return;
        }
        if (observed && observed !== normalizedModelLock()) {
          this.phase = 'drift';
          this.setDiag(`주의 · 모델 변경 감지 (${observed})`);
        } else {
          this.phase = 'stable-unverified';
          this.setDiag(`적용됨 · 상태 판독 불가 (${normalizedModelLock()})`);
        }
      }, 800);
    }

    async drain() {
      if (this.busy || !this.requested || !this.enabled()) return;
      if (!this.safeToManipulate()) return;
      this.requested = false;
      const token = this.epoch;
      this.busy = true;
      this.phase = 'checking';
      this.setDiag(`상태 확인 · ${normalizedModelLock()}`);
      let result = 'missing-trigger';
      try {
        result = await this.applyOnce(token);
      } catch (e) {
        console.warn('[ChatGPT 개선 스크립트] model lock failed', this.lastReason, e);
        result = 'blocked-ui';
        this.record('exception', {message: String(e?.message || e)});
        this.setDiag(`오류 · ${normalizedModelLock()}`);
      } finally {
        this.busy = false;
      }

      if (token !== this.epoch) {
        const rerun = this.requested && this.safeToManipulate();
        this.superseded = false;
        if (rerun) this.request('superseded', 0);
        return;
      }
      this.superseded = false;
      if (result === 'already' || result === 'selected' || result === 'selected-unverified') {
        this.retryCount = 0;
        this.lastAppliedAt = Date.now();
        diag.modelLastApplied = normalizedModelLock();
        this.phase = result === 'selected-unverified' ? 'stable-unverified' : 'stable';
        this.setDiag(result === 'selected-unverified' ? `적용됨 · 상태 판독 불가 (${normalizedModelLock()})` : `PASS · ${normalizedModelLock()}`);
        this.schedulePassiveVerify(token);
      } else if (result === 'interrupted') {
        this.phase = 'suspended-input';
      } else if (result === 'blocked-ui') {
        this.blockedUntilLifecycle = true;
        this.phase = 'blocked-ui';
        this.setDiag(`중단 · 모델 UI 구조 미확인 (${normalizedModelLock()})`);
      } else {
        this.scheduleRetry(`retry:${this.lastReason}`);
      }
      if (this.requested && !this.busy) this.request('coalesced', 0);
    }

    waitFor(getter, token, timeout = 700) {
      return new Promise(resolve => {
        let done = false;
        let observer = null;
        let timer = 0;
        const finish = value => {
          if (done) return;
          done = true;
          observer?.disconnect();
          clearTimeout(timer);
          resolve(value);
        };
        const probe = () => {
          if (!this.tokenValid(token)) return finish(null);
          let value = null;
          try { value = getter(); } catch {}
          if (value) finish(value);
        };
        probe();
        if (done) return;
        observer = new MutationObserver(probe);
        try { observer.observe(document, {childList:true, subtree:true, attributes:true, attributeFilter:['class','data-state','aria-hidden','aria-checked','aria-selected','aria-controls','open']}); }
        catch { return finish(null); }
        timer = setTimeout(() => {
          let value = null;
          try { value = getter(); } catch {}
          finish(value || null);
        }, timeout);
      });
    }

    async closeOwnedPopup(token) {
      if (!this.tokenValid(token)) {
        this.popupStatus = this.ownedPopup?.isConnected ? '잔류 · 입력 보호 우선' : '없음';
        return false;
      }
      const trigger = this.ownedTrigger;
      const popup = this.ownedPopup;
      if (!trigger || !popup || !popup.isConnected || !visible(popup)) {
        this.popupStatus = '없음';
        this.clearOwnership();
        return true;
      }
      if (!trigger.isConnected || !visible(trigger)) {
        this.popupStatus = '잔류 · 트리거 소실';
        return false;
      }
      this.lastAction = 'close-owned-popup';
      this.record('click-trigger-close', {text: textOf(trigger).slice(0, 80)});
      trigger.click();
      const closed = await this.waitFor(() => (!popup.isConnected || !visible(popup)) ? true : null, token, 360);
      this.popupStatus = closed ? '닫힘' : '잔류';
      if (closed) this.clearOwnership();
      return !!closed;
    }

    async applyOnce(token) {
      const target = normalizedModelLock();
      if (!this.tokenValid(token)) return 'interrupted';

      const trigger = findModelButton();
      diag.modelTrigger = trigger ? (state.bindings.modelButton && trigger === resolveBinding('modelButton', 'button') ? '직접 지정' : '자동 탐지') : '미검출';
      if (!trigger) {
        this.lastAction = 'missing-trigger';
        this.record('missing-trigger');
        return 'missing-trigger';
      }
      this.lastTrigger = trigger;
      const triggerInfo = describeModelTrigger(trigger);
      if (triggerInfo.thinkingOnly) {
        this.lastAction = 'reject-thinking-trigger';
        this.record('reject-thinking-trigger', {text: triggerInfo.text?.slice(0, 80)});
        return 'blocked-ui';
      }

      const observed = currentModelFromTrigger(trigger);
      this.currentModel = observed;
      this.record('read-current', {observed: observed || 'unknown', target, triggerText: textOf(trigger).slice(0, 80)});
      if (observed === target) {
        this.lastAction = 'already-target';
        this.popupStatus = modelPopupLayers().length ? '기존 팝업 감지 · 미조작' : '없음';
        return 'already';
      }

      // Never seize an already-open model/thinking popup. It may belong to the user.
      if (modelPopupLayers().length) {
        this.lastAction = 'existing-popup-no-touch';
        this.record('existing-popup-no-touch');
        return 'blocked-ui';
      }

      if (!this.tokenValid(token)) return 'interrupted';
      const before = new Set(popupLayers());
      this.lastAction = 'open-model-ui';
      this.record('click-trigger-open', {observed: observed || 'unknown'});
      trigger.click();

      const surface = await this.waitFor(() => {
        const direct = findVisibleModelChoice(target);
        if (direct) return {choice: direct, popup: popupForElement(direct)};
        const popup = findPopupOpenedAfter(before, trigger);
        if (popup) return {popup};
        return null;
      }, token, 750);
      if (!this.tokenValid(token)) return 'interrupted';
      if (!surface?.popup && !surface?.choice) {
        this.lastAction = 'unsupported-no-popup';
        this.record('unsupported-no-popup');
        return 'blocked-ui';
      }

      this.ownedTrigger = trigger;
      this.ownedPopup = surface.popup || popupForElement(surface.choice);
      let choice = surface.choice || findVisibleModelChoice(target, this.ownedPopup);

      if (!choice) {
        const gatewayResult = await this.waitFor(() => {
          const direct = findVisibleModelChoice(target, this.ownedPopup);
          if (direct) return {choice: direct};
          const gateway = findModelGateway(this.ownedPopup);
          if (gateway) return {gateway};
          return null;
        }, token, 420);
        if (!this.tokenValid(token)) return 'interrupted';
        if (gatewayResult?.choice) choice = gatewayResult.choice;
        else if (gatewayResult?.gateway) {
          const gateway = gatewayResult.gateway;
          const gatewayModel = currentModelFromText(modelChoiceText(gateway));
          if (gatewayModel === target) {
            this.lastAction = 'gateway-confirms-target';
            this.currentModel = target;
            await this.closeOwnedPopup(token);
            return this.tokenValid(token) ? 'already' : 'interrupted';
          }
          this.lastAction = 'open-model-list';
          this.record('click-gateway', {text: modelChoiceText(gateway).slice(0, 80)});
          gateway.click();
          choice = await this.waitFor(() => findVisibleModelChoice(target), token, 650);
        }
      }

      if (!this.tokenValid(token)) return 'interrupted';
      if (!choice) {
        this.lastAction = 'unsupported-no-choice';
        this.record('unsupported-no-choice');
        await this.closeOwnedPopup(token);
        return this.tokenValid(token) ? 'blocked-ui' : 'interrupted';
      }

      this.lastAction = 'select-target';
      this.record('click-choice', {text: modelChoiceText(choice).slice(0, 80), target});
      choice.click();

      const confirmed = await this.waitFor(() => {
        const nowTrigger = findModelButton();
        return currentModelFromTrigger(nowTrigger) === target ? nowTrigger : null;
      }, token, 520);
      if (!this.tokenValid(token)) return 'interrupted';
      this.currentModel = confirmed ? target : currentModelFromTrigger(findModelButton());

      // A model choice may transition into the thinking-effort panel. Close only
      // the popup chain opened by this operation, once, and only while input is untouched.
      const residual = popupLinkedToTrigger(trigger) || modelPopupLayers().find(p => p === this.ownedPopup || !before.has(p));
      if (residual && visible(residual)) {
        this.ownedPopup = residual;
        await this.closeOwnedPopup(token);
        if (!this.tokenValid(token)) return 'interrupted';
      } else {
        this.popupStatus = '없음';
        this.clearOwnership();
      }

      return confirmed ? 'selected' : 'selected-unverified';
    }

    onSettingChange(previous, next, reason = 'setting-change') {
      this.cancel(reason);
      this.retryCount = 0;
      this.repairCount = 0;
      this.blockedUntilLifecycle = false;
      if (next === 'off') {
        this.phase = 'off';
        this.setDiag('OFF', '미검사');
        return;
      }
      this.request(reason, 0, {force:true});
    }

    onBindingChange() {
      this.cancel('binding-change');
      this.retryCount = 0;
      this.repairCount = 0;
      this.blockedUntilLifecycle = false;
      this.request('binding-change', 0, {force:true});
    }

    onRouteMaybe(reason) {
      refreshSurface(`route:${reason}`, false);
      const nextUrl = location.href;
      const nextKey = modelRouteKey(nextUrl);
      if (nextKey === this.routeKey) {
        this.routeUrl = nextUrl;
        return false;
      }
      const previousKey = this.routeKey;
      this.routeUrl = nextUrl;
      this.routeKey = nextKey;
      if (isNewConversationPromotion(previousKey, nextKey)) {
        // ChatGPT converts / -> /c/<id> after the first send. This is the same
        // writing session, not a new navigation lifecycle. Never clear input protection.
        this.record('route-promotion-preserved', {previousKey, nextKey, reason});
        return true;
      }
      this.resetLifecycle(reason, {resetInput:true});
      return true;
    }

    installRouteHooks() {
      if (this.routeHooksInstalled) return;
      this.routeHooksInstalled = true;
      for (const method of ['pushState', 'replaceState']) {
        const original = history[method];
        if (typeof original !== 'function') continue;
        try {
          const controller = this;
          history[method] = function(...args) {
            const result = original.apply(this, args);
            queueMicrotask(() => controller.onRouteMaybe(`history.${method}`));
            return result;
          };
        } catch {}
      }
      addEventListener('popstate', () => this.onRouteMaybe('popstate'));
      addEventListener('pageshow', () => {
        this.onRouteMaybe('pageshow-route');
        if (!this.sessionTouched && !this.composing) this.request('pageshow', 0);
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.sessionTouched && !this.composing) this.request('visible', 0);
        } else {
          this.cancel('hidden', {keepRequested:true});
          this.phase = 'suspended-hidden';
        }
      }, true);
    }

    installSafetyHooks() {
      if (this.safetyHooksInstalled) return;
      this.safetyHooksInstalled = true;
      document.addEventListener('pointerdown', e => {
        if (e.isTrusted && editorFrom(e.target)) this.markComposerTouched('pointerdown');
      }, true);
      document.addEventListener('keydown', e => {
        if (!editorFrom(e.target)) return;
        if (e.isTrusted || e.isComposing) this.markComposerTouched('keydown', !!e.isComposing || this.composing);
      }, true);
      document.addEventListener('compositionstart', e => {
        if (editorFrom(e.target)) this.markComposerTouched('compositionstart', true);
      }, true);
      document.addEventListener('compositionend', e => {
        if (!editorFrom(e.target)) return;
        this.composing = false;
        this.sessionTouched = true;
        this.cancel('composer:compositionend');
        this.phase = 'suspended-input';
        this.record('composition-end');
      }, true);
      for (const type of ['beforeinput','input','paste','drop']) {
        document.addEventListener(type, e => {
          if (editorFrom(e.target)) this.markComposerTouched(type, this.composing);
        }, true);
      }
      document.addEventListener('click', e => {
        if (!e.isTrusted) return;
        const clicked = e.target?.closest?.('button,[role="menuitem"],[role="menuitemradio"],[role="option"],[data-radix-collection-item],a');
        if (!clicked || isOwnedNode(clicked)) return;
        const blob = semanticBlob(clicked);
        const triggerLike = describeModelTrigger(clicked);
        const choiceLike = MODEL_LOCK_VALUES.some(v => v !== 'off' && targetChoiceMatchesText(v, modelChoiceText(clicked)));
        if ((triggerLike.score >= 100 || choiceLike) && this.enabled() && !this.sessionTouched) {
          this.blockedUntilLifecycle = false;
          this.request('trusted-model-change', 320, {force:true});
        }
        if (/new\s*chat|새\s*채팅|create.*chat|chat.*create/i.test(blob) || (clicked.getAttribute?.('href') || '') === '/') {
          // Do not apply against the old conversation. The route transition (or
          // a full-page new-chat load) starts the next model-lock lifecycle.
          this.record('trusted-new-chat', {routeKey: this.routeKey});
        }
      }, true);
    }

    onMutations(mutations) {
      if (!this.enabled()) return;
      this.onRouteMaybe('mutation-route');
      if (this.sessionTouched || this.composing || this.busy || this.blockedUntilLifecycle) return;
      if (!['waiting','waiting-ui','waiting-dom','suspended-hidden'].includes(this.phase)) return;

      for (const m of mutations) {
        if (isOwnedNode(m.target) || m.type !== 'childList') continue;
        const relevant = [...m.addedNodes].some(node => node.nodeType === 1 && (
          node.matches?.('button,[role="button"],#prompt-textarea,textarea,[contenteditable="true"]') ||
          node.querySelector?.('button,[role="button"],#prompt-textarea,textarea,[contenteditable="true"]')
        ));
        if (!relevant) continue;
        if (!findModelButton()) continue;
        clearTimeout(this.retryTimer);
        this.retryTimer = 0;
        this.request('model-ui-mounted', 40);
        break;
      }
    }

    startEarly() {
      if (this.startedEarly) return;
      this.startedEarly = true;
      this.installRouteHooks();
      this.installSafetyHooks();
      this.earlyObserver = new MutationObserver(mutations => this.onMutations(mutations));
      try { this.earlyObserver.observe(document, {childList:true, subtree:true}); } catch {}
      if (this.enabled()) this.request('document-start', 0);
      else this.setDiag('OFF', '미검사');
    }

    startDom() {
      if (this.startedDom) return;
      this.startedDom = true;
      this.earlyObserver?.disconnect();
      this.earlyObserver = null;
      this.domObserver = new MutationObserver(mutations => this.onMutations(mutations));
      try { this.domObserver.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['class','data-state','aria-hidden','open']}); } catch {}
      if (!this.sessionTouched && !this.composing) this.request('dom-ready', 0);
    }
  }

  const modelLockController = new ModelLockController();

  function setSurface(next, reason = 'surface') {
    if (!['chat', 'work', 'unknown'].includes(next)) return false;
    if (next === currentSurface) {
      diag.surface = next;
      return false;
    }
    const previous = currentSurface;
    currentSurface = next;
    diag.surface = next;

    if (next === 'work') {
      modelLockController.cancel(`surface:${reason}`);
      modelLockController.phase = 'surface-work';
      modelLockController.setDiag('비활성 · Work', '비활성');
      deactivateChatFeatures();
    } else if (next === 'chat') {
      injectStyles();
      if (modelLockController.startedEarly) {
        modelLockController.resetLifecycle(`surface:${reason}`, {resetInput:true});
      }
      if (document.body) applyAll();
    } else {
      modelLockController.cancel(`surface:${reason}`);
      deactivateChatFeatures();
    }
    modelLockController.record('surface-change', {previous, next, reason});
    return true;
  }

  function refreshSurface(reason = 'surface', allowDefault = false) {
    return setSurface(detectSurface({allowDefault}), reason);
  }

  function scheduleSurfaceSettle(reason, fallback = 'chat', delay = 160) {
    clearTimeout(surfaceSettleTimer);
    surfaceSettleTimer = setTimeout(() => {
      surfaceSettleTimer = 0;
      const detected = detectSurface({allowDefault:false});
      setSurface(detected === 'unknown' ? fallback : detected, reason);
    }, delay);
  }

  function normalizedChatMaxWidth() {
    const raw = Number(state.settings.chatMaxWidth);
    if (!Number.isFinite(raw)) return 1400;
    return Math.max(960, Math.min(2400, Math.round(raw)));
  }

  function normalizedUserBubbleMaxWidth() {
    const raw = Number(state.settings.userBubbleMaxWidth);
    if (!Number.isFinite(raw)) return 760;
    return Math.max(480, Math.min(1200, Math.round(raw)));
  }

  function applyWideLayout() {
    let s = document.getElementById(`${APP}-wide-style`);
    if (!isChatSurface() || !state.settings.wideChat) {
      s?.remove();
      return;
    }
    if (!s) {
      s = document.createElement('style');
      s.id = `${APP}-wide-style`;
      (document.head || document.documentElement).appendChild(s);
    }

    const maxWidth = normalizedChatMaxWidth();
    const userBubbleMax = normalizedUserBubbleMaxWidth();
    state.settings.chatMaxWidth = maxWidth;
    state.settings.userBubbleMaxWidth = userBubbleMax;

    const css = `
      @media (min-width: 768px) {
        /* Responsive layout with a ceiling.
           ChatGPT's own inner padding/margins are preserved; this script no longer
           forces a separate left gutter. The column grows fluidly until the
           configured ceiling, then the capped column stays centered. */

        #thread article > div > [class*="thread-content-max-width"],
        #thread [class*="thread-body-max-width"],
        #thread-bottom-container [class*="thread-content-max-width"],
        #thread-bottom-container [class*="thread-body-max-width"],
        main > div[role="presentation"] > section > div > div > [class*="thread-content-max-width"],
        main [class*="thread-body-max-width"] {
          --thread-content-max-width: min(100cqi, ${maxWidth}px) !important;
          --thread-body-max-width: min(100cqi, ${maxWidth}px) !important;
          --thread-content-width: min(100cqi, ${maxWidth}px) !important;
          width: min(100%, ${maxWidth}px) !important;
          max-width: ${maxWidth}px !important;
          /* Fill the available main pane while narrow; once the ceiling is
             reached, center the whole conversation column instead of pinning
             it to the left. */
          margin-inline-start: auto !important;
          margin-inline-end: auto !important;
        }

        #thread > div,
        #thread-bottom-container > div,
        #thread-bottom-container #thread-bottom > div {
          --thread-content-max-width: min(100cqi, ${maxWidth}px) !important;
          --thread-body-max-width: min(100cqi, ${maxWidth}px) !important;
        }

        /* User turns stay chat-like without becoming ultrawide banners. */
        #thread [data-message-author-role="user"] {
          max-width: min(${userBubbleMax}px, 100%) !important;
          margin-inline-start: auto !important;
        }

        #thread table,
        #thread [class*="tableContainer"],
        #thread [class*="tableWrapper"] {
          max-width: 100% !important;
        }
      }
    `;
    if (s.textContent !== css) s.textContent = css;
  }

  function injectStyles() {
    if (document.getElementById(`${APP}-style`)) return;
    const s = document.createElement('style');
    s.id = `${APP}-style`;
    s.textContent = `
      #${APP}-newchat-overlay,.${APP}-menu-overlay,.${APP}-project-chat-overlay{position:fixed;z-index:2147482996;display:none;background:transparent;text-decoration:none;cursor:pointer}
      #${APP}-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.3)}
      #${APP}-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483001;width:min(440px,calc(100vw - 28px));max-height:min(80vh,780px);display:flex;flex-direction:column;overflow:hidden;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:14px;background:Canvas;color:CanvasText;box-shadow:0 16px 52px rgba(0,0,0,.25);font:13px/1.45 system-ui,sans-serif}
      .${APP}-head,.${APP}-row{display:flex;align-items:center;gap:8px}
      .${APP}-head{padding:10px 12px;border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent)}.${APP}-head strong{flex:1}
      .${APP}-tabs{display:flex;gap:4px;overflow-x:auto;padding:7px 8px;border-bottom:1px solid color-mix(in srgb,currentColor 10%,transparent)}
      .${APP}-body{padding:10px;overflow:auto}.${APP}-grow{flex:1;min-width:0}
      .${APP}-muted{opacity:.68;font-size:12px}
      .${APP}-item{margin:7px 0;padding:9px;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:9px}
      .${APP}-tab,.${APP}-btn{border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:8px;padding:6px 8px;background:color-mix(in srgb,Canvas 94%,CanvasText 6%);color:inherit;cursor:pointer;white-space:nowrap}
      .${APP}-tab[data-active="1"]{font-weight:700;outline:2px solid color-mix(in srgb,currentColor 20%,transparent)}
      .${APP}-danger{color:#c43}
      #${APP}-toast{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:2147483646;padding:9px 12px;border-radius:9px;background:#111;color:#fff;font:13px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.28);display:none;max-width:min(680px,90vw)}
      #${APP}-picker-banner{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:10px 14px;border-radius:10px;background:#111;color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function toast(msg, ms = 2200) {
    let el = document.getElementById(`${APP}-toast`);
    if (!el) { el = document.createElement('div'); el.id = `${APP}-toast`; document.body.appendChild(el); }
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(el._timer); el._timer = setTimeout(() => { el.style.display = 'none'; }, ms);
  }

  function ensureNewChatOverlay() {
    if (!isChatSurface()) {
      document.getElementById(`${APP}-newchat-overlay`)?.remove();
      overlayTarget = null;
      diag.newChatTarget = diag.newChatOverlay = false;
      return;
    }
    let overlay = document.getElementById(`${APP}-newchat-overlay`);
    if (!overlay) {
      overlay = document.createElement('a');
      overlay.id = `${APP}-newchat-overlay`;
      overlay.href = 'https://chatgpt.com/';
      overlay.setAttribute('aria-label', 'New chat');
      overlay.title = 'New chat';
      document.body.appendChild(overlay);
    }
    if (!state.settings.newChatLink) { overlay.style.display = 'none'; diag.newChatTarget = diag.newChatOverlay = false; return; }

    const target = findByBindingOrAuto('newChat', 'button', findNewChatAuto);
    overlayTarget = target;
    diag.newChatTarget = !!target;
    if (!target) { overlay.style.display = 'none'; diag.newChatOverlay = false; return; }

    if (target.tagName === 'A' && target.href) {
      overlay.style.display = 'none'; diag.newChatOverlay = true; return;
    }
    syncNewChatOverlay();
    diag.newChatOverlay = true;
  }

  function syncNewChatOverlay() {
    const overlay = document.getElementById(`${APP}-newchat-overlay`);
    if (!overlay || !isChatSurface() || !state.settings.newChatLink || !overlayTarget || !visible(overlayTarget) || (overlayTarget.tagName === 'A' && overlayTarget.href)) {
      if (overlay) overlay.style.display = 'none';
      return;
    }
    const r = overlayTarget.getBoundingClientRect();
    Object.assign(overlay.style, {display:'block', left:`${r.left}px`, top:`${r.top}px`, width:`${r.width}px`, height:`${r.height}px`});
  }

  function projectHrefFromAnchor(anchor) {
    if (!anchor) return null;
    const raw = anchor.getAttribute('href');
    if (!raw) return null;
    try {
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin) return null;
      if (!/^\/g\/g-p-[^/]+\/project\/?$/i.test(url.pathname)) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function projectHrefForTarget(target) {
    const direct = projectHrefFromAnchor(target?.matches?.('a[href]') ? target : target?.closest?.('a[href]'));
    if (direct) return direct;

    let host = target?.parentElement;
    for (let depth = 0; host && depth < 5; depth++, host = host.parentElement) {
      const r = host.getBoundingClientRect?.();
      if (r && (r.width > Math.min(720, innerWidth * 0.9) || r.height > 180)) break;
      for (const anchor of host.querySelectorAll?.('a[href*="/g/g-p-"][href*="/project"]') || []) {
        const href = projectHrefFromAnchor(anchor);
        if (href) return href;
      }
    }
    return null;
  }

  function isProjectChatTarget(el) {
    if (!el || !visible(el) || isOwnedNode(el) || el.closest('#thread,#thread-bottom-container')) return false;
    if (!projectHrefForTarget(el)) return false;
    const blob = semanticBlob(el);
    return /(?:대화\s*(?:시작|시작하기|만들기|추가)|새\s*(?:대화|채팅)|프로젝트.*(?:대화|채팅)|start\s+(?:a\s+)?chat|new\s+chat|create.*chat|project.*chat|チャットを開始)/i.test(blob);
  }

  function findProjectChatTargets() {
    const out = [];
    const seen = new Set();
    for (const raw of document.querySelectorAll('a,button,[role="button"],[role="link"]')) {
      const target = normalizeInteractive(raw);
      if (!target || seen.has(target) || !isProjectChatTarget(target)) continue;
      seen.add(target);
      out.push(target);
    }
    return out;
  }

  function positionProjectChatOverlay(item) {
    const {overlay, target} = item;
    const href = projectHrefForTarget(target);
    if (!isChatSurface() || !state.settings.newChatLink || !target?.isConnected || !visible(target) || !href) {
      overlay.style.display = 'none';
      return;
    }
    item.href = href;
    overlay.href = href;
    const r = target.getBoundingClientRect();
    Object.assign(overlay.style, {display:'block', left:`${r.left}px`, top:`${r.top}px`, width:`${r.width}px`, height:`${r.height}px`});
  }

  function cleanupProjectChatOverlays(removeAll = false, liveTargets = null) {
    for (const [target, item] of projectChatOverlays) {
      if (!removeAll && target.isConnected && liveTargets?.has(target)) continue;
      item.overlay.remove();
      projectChatOverlays.delete(target);
    }
    if (removeAll) diag.projectChatTargets = 0;
  }

  function ensureProjectChatOverlays() {
    if (!isChatSurface() || !state.settings.newChatLink) {
      cleanupProjectChatOverlays(true);
      return;
    }
    const targets = findProjectChatTargets();
    const liveTargets = new Set(targets);
    for (const target of targets) {
      let item = projectChatOverlays.get(target);
      if (!item) {
        const overlay = document.createElement('a');
        overlay.className = `${APP}-project-chat-overlay`;
        overlay.setAttribute('aria-label', '프로젝트에서 대화 시작 (새 탭 열기 지원)');
        overlay.title = '프로젝트에서 대화 시작 (새 탭 열기 지원)';
        item = {overlay, target, href: null};
        overlay.addEventListener('click', e => {
          if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
          const current = item.target;
          if (!current?.isConnected) return;
          e.preventDefault();
          current.click();
        });
        document.body.appendChild(overlay);
        projectChatOverlays.set(target, item);
      }
      positionProjectChatOverlay(item);
    }
    cleanupProjectChatOverlays(false, liveTargets);
    diag.projectChatTargets = targets.length;
  }

  function syncProjectChatOverlays() {
    for (const item of projectChatOverlays.values()) positionProjectChatOverlay(item);
  }

 function menuText(el) {
   // Exact menu item text, not the text of an entire sidebar or popover.
   return textOf(el).replace(/\s*(?:신규|NEW)\s*$/i, '').trim();
 }

 function menuCandidates() {
   return [...document.querySelectorAll('a, button, [role="button"], [role="link"], [role="menuitem"], [data-radix-collection-item], [data-slot="dropdown-menu-item"]')]
     .filter(el => !isOwnedNode(el) && visible(el) && !el.closest('#thread,#thread-bottom-container'));
 }

 function isMenuLocation(el, entry) {
   const r = el.getBoundingClientRect();
   if (r.left < 0 || r.right > innerWidth + 2 || r.top < 0 || r.bottom > innerHeight + 2 || r.left > Math.min(900, innerWidth * 0.8)) return false;
   if (el.closest(NAV_SELECTOR)) return true;
   if (!entry.explore) return r.left < 420 && r.top < 550;
   if (el.closest('[role="menu"],[role="menuitem"],[data-radix-popper-content-wrapper],[data-testid*="popover" i],[data-side],[data-state="open"]')) return true;
   // Portalled explore flyouts may not advertise a menu role. Require other
   // named explore entries within the same small container before matching.
   let p = el.parentElement;
   for (let depth = 0; p && depth < 5; p = p.parentElement, depth++) {
     const r2 = p.getBoundingClientRect();
     if (r2.width > 680 || r2.height > 700) break;
     const labels = [...p.querySelectorAll('a,button,[role="menuitem"],[role="button"],[data-radix-collection-item]')]
       .filter(visible).map(menuText);
     if (MENU_LINKS.filter(item => item.explore && item.names.some(name => labels.includes(name))).length >= 3) return true;
   }
   return false;
 }

 function findMenuTarget(entry, pool) {
   let best = null, score = -1;
   for (const el of pool) {
     const aria = el.getAttribute('aria-label') || '';
     const title = el.getAttribute('title') || '';
     if (![menuText(el), aria.trim(), title.trim()].some(label => entry.names.includes(label))) continue;
     if (!isMenuLocation(el, entry)) continue;
     const r = el.getBoundingClientRect();
     const s = (el.closest(NAV_SELECTOR) ? 20 : 0) + (el.matches('a,button,[role="menuitem"]') ? 10 : 0) + Math.min(15, r.width / 30);
     if (s > score) { best = el; score = s; }
   }
   return best;
 }

 function usableMenuHref(target) {
   const a = target?.matches('a[href]') ? target : target?.closest('a[href]');
   if (!a) return null;
   const raw = a.getAttribute('href');
   if (!raw || raw === '#' || /^javascript:/i.test(raw)) return null;
   try {
     const url = new URL(raw, location.href);
     return /^https?:$/.test(url.protocol) ? url.href : null;
   } catch { return null; }
 }

 function positionMenuOverlay(entry) {
   const item = menuOverlays.get(entry.id);
   if (!item) return;
   const {overlay, target} = item;
   if (!state.settings.menuLinks || !target?.isConnected || !visible(target) || !isMenuLocation(target, entry) || usableMenuHref(target)) {
     overlay.style.display = 'none';
     return;
   }
   const r = target.getBoundingClientRect();
   Object.assign(overlay.style, {display:'block', left:`${r.left}px`, top:`${r.top}px`, width:`${r.width}px`, height:`${r.height}px`});
 }

 function syncMenuOverlays() {
   for (const entry of MENU_LINKS) positionMenuOverlay(entry);
 }

 function ensureMenuOverlays() {
   if (!isChatSurface() || !state.settings.menuLinks) {
     for (const {overlay} of menuOverlays.values()) overlay.style.display = 'none';
     for (const entry of MENU_LINKS) diagMenus[entry.id] = 'OFF';
     return;
   }
   const pool = menuCandidates();
   for (const entry of MENU_LINKS) {
     const target = findMenuTarget(entry, pool);
     diagMenus[entry.id] = target ? 'PASS' : '미검출';
     let item = menuOverlays.get(entry.id);
     if (!item) {
       const overlay = document.createElement('a');
       overlay.className = `${APP}-menu-overlay`;
       overlay.id = `${APP}-menu-overlay-${entry.id}`;
       overlay.setAttribute('aria-label', `${entry.label} (새 탭 열기 지원)`);
       overlay.title = `${entry.label} (새 탭 열기 지원)`;
       // Ordinary left click continues to use ChatGPT's own action. Ctrl+click,
       // middle click, context menu, and link-based gestures use the real href.
       overlay.addEventListener('click', e => {
         if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
         const current = menuOverlays.get(entry.id)?.target;
         if (!current?.isConnected) return;
         e.preventDefault();
         current.click();
       });
       document.body.appendChild(overlay);
       item = {overlay, target: null};
       menuOverlays.set(entry.id, item);
     }
     item.target = target;
     item.overlay.href = usableMenuHref(target) || new URL(entry.path, location.origin).href;
     positionMenuOverlay(entry);
   }
 }

  function startPicker(name, type, label) {
    cancelPicker();
    closePanel();
    const banner = document.createElement('div'); banner.id = `${APP}-picker-banner`; banner.textContent = `${label}을(를) 직접 클릭하십시오. Esc = 취소`;
    document.body.appendChild(banner);
    const click = e => {
      if (e.target.closest(`#${APP}-picker-banner, #${APP}-panel`)) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const target = normalizeInteractive(e.target, type);
      const fp = fingerprint(target, type);
      if (!fp) { toast('지정 실패'); return cancelPicker(); }
      state.bindings[name] = fp; saveState(); cancelPicker(); applyAll(); if (name === 'modelButton') modelLockController?.onBindingChange(); toast(`${label} 지정 완료`);
    };
    const key = e => { if (e.key === 'Escape') cancelPicker(); };
    picker = {click,key};
    document.addEventListener('click', click, true); document.addEventListener('keydown', key, true);
  }

  function cancelPicker() {
    if (picker) { document.removeEventListener('click', picker.click, true); document.removeEventListener('keydown', picker.key, true); picker = null; }
    document.getElementById(`${APP}-picker-banner`)?.remove();
  }

  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    document.getElementById(`${APP}-panel`)?.remove();
    document.getElementById(`${APP}-backdrop`)?.remove();
    document.removeEventListener('keydown', onPanelEscape, true);
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
    modelLockController?.request('panel-close', 80);
  }

  function onPanelEscape(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); }
  }

  // Tampermonkey command opens a temporary modal; nothing is inserted into the sidebar.
  function openPanel() {
    if (!document.body || !isChatSurface()) return;
    injectStyles();
    if (panelOpen) { document.getElementById(`${APP}-panel`)?.focus(); return; }
    previousFocus = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.id = `${APP}-backdrop`;
    backdrop.addEventListener('click', closePanel);
    const panel = document.createElement('section');
    panel.id = `${APP}-panel`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'ChatGPT 개선 스크립트 설정');
    panel.setAttribute('tabindex', '-1');
    panel.innerHTML = `<div class="${APP}-head"><strong>ChatGPT 개선 스크립트</strong><span class="${APP}-muted">v${VERSION}</span><button type="button" class="${APP}-btn" data-action="close" aria-label="닫기">×</button></div><div class="${APP}-tabs"></div><div class="${APP}-body"></div>`;
    panel.addEventListener('click', handlePanelClick);
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) panel.addEventListener(type, e => e.stopPropagation());
    document.body.append(backdrop, panel);
    panelOpen = true;
    renderPanel();
    panel.focus();
    document.addEventListener('keydown', onPanelEscape, true);
  }

  function registerMenu() {
    if (typeof GM_registerMenuCommand !== 'function') {
      console.warn('[ChatGPT 개선 스크립트] Tampermonkey 설정 메뉴 API를 사용할 수 없습니다.');
      return;
    }
    GM_registerMenuCommand('ChatGPT 개선 스크립트 · 설정 열기', openPanel);
  }

  function renderPanel() {
    const panel = document.getElementById(`${APP}-panel`);
    if (!panel) return;
    const tabs = [['settings', '설정'], ['diag', '진단']];
    panel.querySelector(`.${APP}-tabs`).innerHTML = tabs.map(([id, label]) => `<button type="button" class="${APP}-tab" data-tab="${id}" data-active="${activeTab === id ? '1' : '0'}">${label}</button>`).join('');
    panel.querySelector(`.${APP}-body`).innerHTML = activeTab === 'diag' ? renderDiagnostics() : renderSettings();
  }

  function settingRow(key,label,note='') { return `<div class="${APP}-item"><div class="${APP}-row"><div class="${APP}-grow"><b>${esc(label)}</b>${note?`<div class="${APP}-muted">${esc(note)}</div>`:''}</div><button class="${APP}-btn" data-action="toggle-setting" data-key="${key}">${state.settings[key]?'ON':'OFF'}</button></div></div>`; }

  function bindRow(name,label,action,note='') { return `<div class="${APP}-item"><div class="${APP}-row"><div class="${APP}-grow"><b>${esc(label)}</b><div class="${APP}-muted">${state.bindings[name]?'직접 지정됨':'자동 탐지 사용 중'}</div>${note?`<div class="${APP}-muted">${esc(note)}</div>`:''}</div><button class="${APP}-btn" data-action="${action}">직접 지정</button>${state.bindings[name]?`<button class="${APP}-btn" data-action="clear-binding" data-binding="${name}">해제</button>`:''}</div></div>`; }

  function renderSettings() {
    return [
      settingRow('newChatLink','새 채팅·프로젝트 대화 링크 복원','기존 새 채팅과 프로젝트 우측 대화 시작 아이콘의 휠 클릭·Ctrl+클릭·우클릭 새 탭을 지원합니다.'),
       settingRow('menuLinks','사이드바·탐색 메뉴 새 탭','예약·라이브러리·플러그인·지도·이미지·GPT·사이트·Canva의 휠 클릭·제스처·Ctrl+클릭을 지원합니다.'),
      bindRow('newChat','새 채팅 버튼 직접 지정','bind-newchat','자동 탐지가 깨질 때 실제 새 채팅 버튼을 한 번 클릭해 위치를 기억시킵니다.'),
      `<div class="${APP}-item"><div class="${APP}-grow"><b>추론 모델 고정</b><div class="${APP}-muted">v0.16 상태 머신은 현재 모델을 먼저 읽어 목표 모델이면 0-click으로 종료합니다. 모델 변경이 필요한 경우에만 모델 UI를 한 번 열며, 5.6 High/Medium 같은 추론 수준 표시와 모델 선택을 구분합니다. / → /c 전환은 첫 전송 뒤 같은 작성 세션으로 취급해 입력 보호를 해제하지 않습니다. 입력/IME 시작 즉시 후속 조작을 중단하며, 키보드 이벤트·포커스·작성창은 조작하지 않습니다.</div></div><div class="${APP}-row" style="flex-wrap:wrap;margin-top:8px">${MODEL_LOCK_VALUES.map(value => `<button class="${APP}-btn" data-action="set-model-lock" data-model="${esc(value)}"${normalizedModelLock()===value?' style="font-weight:700;outline:2px solid color-mix(in srgb,currentColor 20%,transparent)"':''}>${value==='off'?'OFF':esc(value)}</button>`).join('')}<button class="${APP}-btn" data-action="apply-model-lock">지금 적용</button></div><div class="${APP}-muted" style="margin-top:6px">상태: ${esc(diag.modelLock)}</div></div>`,
      bindRow('modelButton','추론 모델 선택 버튼 직접 지정','bind-model-button','자동 탐지가 실패할 때 ChatGPT의 모델 선택 버튼을 지정합니다. 추론 수준 전용 버튼은 지정하지 마십시오.'),
      `<div class="${APP}-item"><div class="${APP}-row"><div class="${APP}-grow"><b>대화 폭 반응형</b><div class="${APP}-muted">창에 따라 늘어나고, 최대폭에 도달하면 대화 영역 전체가 가운데에 고정됩니다. 현재 대화 최대 ${normalizedChatMaxWidth()}px · 내 말풍선 최대 ${normalizedUserBubbleMaxWidth()}px.</div></div><button class="${APP}-btn" data-action="toggle-setting" data-key="wideChat">${state.settings.wideChat?'ON':'OFF'}</button></div><div class="${APP}-row" style="flex-wrap:wrap;margin-top:8px"><button class="${APP}-btn" data-action="set-chat-max" data-width="1200">대화 1200</button><button class="${APP}-btn" data-action="set-chat-max" data-width="1400">대화 1400</button><button class="${APP}-btn" data-action="set-chat-max" data-width="1600">대화 1600</button></div><div class="${APP}-row" style="flex-wrap:wrap;margin-top:8px"><button class="${APP}-btn" data-action="set-user-bubble-max" data-width="640">말풍선 640</button><button class="${APP}-btn" data-action="set-user-bubble-max" data-width="760">말풍선 760</button><button class="${APP}-btn" data-action="set-user-bubble-max" data-width="900">말풍선 900</button></div></div>`,
      `<div class="${APP}-item"><b>설정 백업</b><div class="${APP}-muted" style="margin:4px 0 8px">내보내기·가져오기·초기화는 화면 개선 설정에만 적용됩니다. 구버전 백업도 설정만 가져옵니다.</div><div class="${APP}-row"><button class="${APP}-btn" data-action="export">내보내기</button><button class="${APP}-btn" data-action="import">가져오기</button><button class="${APP}-btn ${APP}-danger" data-action="reset">초기화</button></div><input id="${APP}-import-file" type="file" accept="application/json,.json" hidden></div>`
    ].join('');
  }

  function buildDomReport() {
    const clickables = candidatePool().filter(el => {
      const r = el.getBoundingClientRect();
      return r.left < 650 && r.top < 260;
    }).slice(0, 40).map(el => ({fp: fingerprint(el, 'button'), blob: semanticBlob(el)}));
    return {version: VERSION, url: location.href, surface: currentSurface, lifecycle: {visibility: document.visibilityState, readyState: document.readyState}, modelLock: modelLockController.snapshot(), newChatAuto: fingerprint(findNewChatAuto(), 'button'), projectChatTargets: findProjectChatTargets().map(el => ({target:fingerprint(el, 'button'), href:projectHrefForTarget(el)})), menuLinks: MENU_LINKS.map(item => ({label:item.label, status:diagMenus[item.id], href:menuOverlays.get(item.id)?.overlay.href || null})), bindings: state.bindings, topLeftClickables: clickables};
  }

  function renderDiagnostics() {
    return `<div class="${APP}-item"><b>현재 적용 모드</b><div>${esc(currentSurface === 'chat' ? 'Chat · 활성' : currentSurface === 'work' ? 'Work · 비활성' : '판별 대기')}</div></div><div class="${APP}-item"><b>추론 모델 고정</b><div>대상: ${esc(normalizedModelLock())}</div><div>현재 판독: ${esc(modelLockController.currentModel || '미확인')}</div><div>선택 버튼: ${esc(diag.modelTrigger)}</div><div>상태: ${esc(diag.modelLock)}</div><div>마지막 동작: ${esc(modelLockController.lastAction)}</div><div>상태 머신: ${esc(modelLockController.phase)} · ${esc(document.visibilityState)} · ${esc(document.readyState)}</div><div>입력 보호: ${modelLockController.sessionTouched ? 'ON' : 'OFF'} · IME ${modelLockController.composing ? '조합 중' : '대기'} · 로그 ${modelLockController.events.length}</div></div><div class="${APP}-item"><b>새 채팅 링크</b><div>버튼 탐지: ${diag.newChatTarget ? 'PASS' : '미검출'}</div><div>표준 링크: ${diag.newChatOverlay ? 'PASS' : '미적용'}</div><div>프로젝트 대화 시작: ${diag.projectChatTargets}개</div></div><div class="${APP}-item"><b>추가 메뉴 링크</b><div class="${APP}-muted">탐색 항목은 탐색 메뉴를 펼친 상태에서 검사합니다.</div>${MENU_LINKS.map(item => `<div>${esc(item.label)}: ${esc(diagMenus[item.id] || '미검사')}</div>`).join('')}</div><div class="${APP}-row"><button class="${APP}-btn" data-action="rescan">재검사</button><button class="${APP}-btn" data-action="copy-dom-report">DOM 보고서 복사</button></div>`;
  }

  function handlePanelClick(e) {
    e.stopPropagation();
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tab) {activeTab = b.dataset.tab; renderPanel(); return;}
    const a = b.dataset.action;
    if (a === 'close') closePanel();
    else if (a === 'toggle-setting' && typeof DEFAULTS.settings[b.dataset.key] === 'boolean') {
      state.settings[b.dataset.key] = !state.settings[b.dataset.key];
      saveState(); applyAll(); renderPanel();
    } else if (a === 'set-chat-max') {
      state.settings.chatMaxWidth = Math.max(960, Math.min(2400, Number(b.dataset.width) || 1400));
      state.settings.wideChat = true; saveState(); applyWideLayout(); renderPanel();
    } else if (a === 'set-user-bubble-max') {
      state.settings.userBubbleMaxWidth = Math.max(480, Math.min(1200, Number(b.dataset.width) || 760));
      state.settings.wideChat = true; saveState(); applyWideLayout(); renderPanel();
    } else if (a === 'set-model-lock' && MODEL_LOCK_VALUES.includes(b.dataset.model)) {
      const previousModel = state.settings.modelLock;
      state.settings.modelLock = b.dataset.model;
      saveState(); renderPanel();
      modelLockController.onSettingChange(previousModel, b.dataset.model, 'setting-change');
    } else if (a === 'apply-model-lock') {
      closePanel();
      modelLockController.retryCount = 0;
      modelLockController.repairCount = 0;
      modelLockController.blockedUntilLifecycle = false;
      modelLockController.request('manual', 0, {force:true});
    } else if (a === 'bind-newchat') startPicker('newChat', 'button', '새 채팅 버튼');
    else if (a === 'bind-model-button') startPicker('modelButton', 'button', '추론 모델 선택 버튼');
    else if (a === 'clear-binding') {const which=b.dataset.binding; state.bindings[which] = null; saveState(); applyAll(); if (which==='modelButton') modelLockController.onBindingChange(); renderPanel();}
    else if (a === 'rescan') {applyAll(); renderPanel();}
    else if (a === 'copy-dom-report') navigator.clipboard.writeText(JSON.stringify(buildDomReport(), null, 2)).then(() => toast('DOM 보고서 복사 완료')).catch(() => toast('복사 실패'));
    else if (a === 'export') exportState();
    else if (a === 'import') {
      const input = document.getElementById(`${APP}-import-file`);
      input.onchange = importState; input.click();
    } else if (a === 'reset' && confirm('ChatGPT 개선 스크립트의 화면 개선 설정만 초기화할까요?')) {
      const previousModel = state.settings.modelLock; state = clone(DEFAULTS); saveState(); applyAll(); modelLockController.onSettingChange(previousModel, state.settings.modelLock, 'reset'); renderPanel();
    }
  }

  function exportState() {
    const blob = new Blob([JSON.stringify({app: 'ChatGPT 개선 스크립트', version: VERSION, exportedAt: new Date().toISOString(), state: normalizeState(state)}, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chatgpt-improvement-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importState(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const value = data.state || data;
      if (!value || typeof value !== 'object' || Array.isArray(value) || !value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings)) throw new Error('설정 백업 파일이 아닙니다.');
      const previousModel = state.settings.modelLock;
      state = normalizeState(value);
      saveState(); applyAll(); modelLockController.onSettingChange(previousModel, state.settings.modelLock, 'import'); renderPanel(); toast('설정 가져오기 완료');
    } catch (err) {toast(`가져오기 실패: ${err.message}`, 3500);}
    finally {e.target.value = '';}
  }

  function deactivateChatFeatures() {
    document.getElementById(`${APP}-wide-style`)?.remove();
    document.getElementById(`${APP}-style`)?.remove();
    document.getElementById(`${APP}-newchat-overlay`)?.remove();
    overlayTarget = null;
    for (const {overlay} of menuOverlays.values()) overlay.remove();
    menuOverlays.clear();
    cleanupProjectChatOverlays(true);
    if (panelOpen) {
      panelOpen = false;
      document.getElementById(`${APP}-panel`)?.remove();
      document.getElementById(`${APP}-backdrop`)?.remove();
      document.removeEventListener('keydown', onPanelEscape, true);
      previousFocus = null;
    }
    cancelPicker();
  }

  function ensureLinkOverlays() {
    if (!isChatSurface()) return;
    ensureNewChatOverlay();
    ensureProjectChatOverlays();
    ensureMenuOverlays();
  }

  function applyAll() {
    if (!document.body) return;
    if (!isChatSurface()) {
      deactivateChatFeatures();
      return;
    }
    injectStyles();
    applyWideLayout();
    ensureLinkOverlays();
   }

  function isOwnedNode(node) {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    return !!el?.closest?.(`[id^="${APP}-"]`);
  }

  const NAV_SELECTOR = 'nav,aside,header,[data-testid*="sidebar" i],[data-testid*="navigation" i]';
  const EXPLORE_SELECTOR = '[role="menu"],[role="menuitem"],[data-radix-popper-content-wrapper],[data-testid*="popover" i],[data-side]';
  const SURFACE_HOST_SELECTOR = 'header,[role="tablist"],[role="radiogroup"],[data-testid*="mode" i],[data-testid*="experience" i],[data-testid*="surface" i]';
  const scheduleOverlay = debounce(() => { if (isChatSurface()) ensureLinkOverlays(); }, 110);

  function mutationsMayChangeSurface(mutations) {
    for (const m of mutations) {
      const host = m.target?.nodeType === 1 ? m.target : m.target?.parentElement;
      if (host?.closest?.(SURFACE_HOST_SELECTOR)) return true;
      if (m.type !== 'childList' || host?.closest?.('#thread,#thread-bottom-container')) continue;
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1 || isOwnedNode(node)) continue;
        if (node.matches?.(SURFACE_CONTROL_SELECTOR) && surfaceFromControl(node)) return true;
        for (const control of node.querySelectorAll?.(SURFACE_CONTROL_SELECTOR) || []) {
          if (surfaceFromControl(control) && isLikelySurfaceSwitcherControl(control)) return true;
        }
      }
    }
    return false;
  }

  // Watch navigation and the Chat/Work switcher only. Streaming messages need no processing.
  function processMutations(mutations) {
    if (mutationsMayChangeSurface(mutations)) refreshSurface('surface-mutation', false);
    if (!isChatSurface()) return;
    for (const m of mutations) {
      if (isOwnedNode(m.target)) continue;
      const host = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (m.type === 'attributes') {
        if (host?.closest?.(NAV_SELECTOR) || host?.closest?.(EXPLORE_SELECTOR) || host?.matches?.(EXPLORE_SELECTOR)) {
          scheduleOverlay();
          return;
        }
        continue;
      }
      const inConversation = !!host?.closest?.('#thread, #thread-bottom-container');
      if (inConversation) continue;
      if (host === document.body || host === document.documentElement || host?.closest?.(NAV_SELECTOR)) {
        scheduleOverlay();
        return;
      }
      for (const node of [...m.addedNodes, ...m.removedNodes]) {
        if (node.nodeType !== 1 || isOwnedNode(node)) continue;
        if (node.matches(NAV_SELECTOR) || node.querySelector(NAV_SELECTOR) || node.matches(EXPLORE_SELECTOR) || node.querySelector(EXPLORE_SELECTOR)) {
          scheduleOverlay();
          return;
        }
      }
    }
  }

  function startEarly() {
    refreshSurface('document-start', false);
    modelLockController.startEarly();
  }

  function start() {
    setupCrossTabSync();
    refreshSurface('dom-ready', false);
    if (currentSurface === 'unknown') scheduleSurfaceSettle('dom-ready-fallback', 'chat', 180);
    applyAll();
    const observer = new MutationObserver(processMutations);
    observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-state', 'data-active', 'aria-selected', 'aria-pressed', 'aria-checked', 'aria-hidden', 'open']});
    modelLockController.startDom();
    const syncOverlayPositions = () => { if (!isChatSurface()) return; syncNewChatOverlay(); syncProjectChatOverlays(); syncMenuOverlays(); };
    addEventListener('resize', syncOverlayPositions, {passive: true});
    addEventListener('scroll', syncOverlayPositions, {capture: true, passive: true});
    addEventListener('popstate', () => { refreshSurface('popstate', false); scheduleOverlay(); });
    addEventListener('pageshow', () => {
      refreshSurface('pageshow', false);
      if (currentSurface === 'unknown') scheduleSurfaceSettle('pageshow-fallback', 'chat', 180);
      scheduleOverlay();
    });
    // Sidebar expansion uses transitions that do not necessarily resize the window.
    document.addEventListener('click', e => {
      const requestedSurface = clickedSurfaceControl(e.target);
      if (requestedSurface === 'work') {
        clearTimeout(surfaceSettleTimer);
        surfaceSettleTimer = 0;
        setSurface('work', 'trusted-mode-click');
      } else if (requestedSurface === 'chat') {
        // Fail closed while React replaces the Work surface. Model lock and
        // overlays only resume after the Chat switcher/DOM has settled.
        setSurface('unknown', 'trusted-mode-click-pending');
        scheduleSurfaceSettle('trusted-mode-click-settled', 'chat', 140);
      }
      if (!isChatSurface()) return;
      if (e.target?.closest?.(NAV_SELECTOR) || e.target?.closest?.(EXPLORE_SELECTOR)) {
        requestAnimationFrame(() => { syncNewChatOverlay(); syncProjectChatOverlays(); ensureProjectChatOverlays(); ensureMenuOverlays(); });
        setTimeout(ensureLinkOverlays, 260);
      }
    }, true);
    console.info(`[ChatGPT 개선 스크립트] v${VERSION} started`);
  }

  registerMenu();
  startEarly();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true}); else start();
})();
