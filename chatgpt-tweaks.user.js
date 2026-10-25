// ==UserScript==
// @name         ChatGPT 개선 스크립트
// @namespace    naegyein.local
// @version      0.14.1
// @description  ChatGPT 대화 폭 조절, 새 채팅·사이드바/탐색 메뉴 링크 복원. 2026 UI 대응 및 진단 강화.
// @homepageURL  https://github.com/NAEGYEIN/chatgpt-tweaks
// @supportURL   https://github.com/NAEGYEIN/chatgpt-tweaks/issues
// @updateURL    https://raw.githubusercontent.com/NAEGYEIN/chatgpt-tweaks/main/chatgpt-tweaks.meta.js
// @downloadURL  https://raw.githubusercontent.com/NAEGYEIN/chatgpt-tweaks/main/chatgpt-tweaks.user.js
// @match        https://chatgpt.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  // Keep existing CSS and setting keys compatible with in-place upgrades.
  const APP = 'cgpui';
  const VERSION = '0.14.1';
  const STORE_KEYS = {
    settings: 'cgpui.settings.v1',
    bindings: 'cgpui.bindings.v1',
  };
  const DEFAULTS = {
    settings: {
      newChatLink: true, menuLinks: true, wideChat: true,
      chatMaxWidth: 1400, userBubbleMaxWidth: 760,
    },
    bindings: {newChat: null},
  };
  let persistedShadow = null;
  let state = loadState();
  let panelOpen = false;
  let activeTab = 'settings';
  let overlayTarget = null;
  let picker = null;
  let previousFocus = null;
  const diag = {newChatTarget: false, newChatOverlay: false};
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
  const diagMenus = Object.create(null);

  // ChatGPT changes its generated utility classes frequently. Prefer semantic
  // attributes and only use class fragments as a secondary signal.
  const TURN_SELECTOR = [
    '[data-turn]',
    'article[data-testid^="conversation-turn-"]',
    '[data-message-author-role]',
    '[data-turn-key]',
    '[data-chatgpt-search-unit-key]'
  ].join(',');
  const USER_TURN_SELECTOR = [
    '[data-message-author-role="user"]',
    '[data-turn="user"]',
    '[data-turn-key$=":user"]',
    '[data-chatgpt-search-unit-key$=":user"]'
  ].join(',');
  const WIDTH_CLASS_SELECTOR = [
    '[class*="thread-content-max-width"]',
    '[class*="thread-body-max-width"]',
    '[class*="max-w-(--thread-content-max-width)"]',
    '[class*="max-w-(--thread-body-max-width)"]'
  ].join(',');

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
      } else if (Number.isFinite(Number(value[key]))) {
        result[key] = Number(value[key]);
      }
    }
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
    state[name] = normalizeSlice(name, value);
    persistedShadow[name] = clone(state[name]);
    applyAll();
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
    el = normalizeInteractive(el, type);
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
    const pool = candidatePool(type);
    let best = null, bestScore = 0;
    for (const el of pool) {
      const score = scoreFingerprint(el, fp);
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return bestScore >= 30 ? normalizeInteractive(best, type) : null;
  }

  function semanticBlob(el) {
    return [
      el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-testid'),
      el.getAttribute('href'), textOf(el)
    ].filter(Boolean).join(' | ').toLowerCase();
  }

  function findNewChatAuto() {
    let best = null, bestScore = 0;
    for (const el of candidatePool('button')) {
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
    if (!state.settings.wideChat) {
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
        /* Modern ChatGPT (2026): widen both legacy #thread layouts and newer
           data-turn based layouts. Attribute-fragment selectors survive most
           generated Tailwind class renames. */
        main,
        #thread,
        #thread-bottom-container {
          --thread-content-max-width: ${maxWidth}px !important;
          --thread-body-max-width: ${maxWidth}px !important;
          --thread-content-width: ${maxWidth}px !important;
        }

        #thread article > div > [class*="thread-content-max-width"],
        #thread [class*="thread-body-max-width"],
        #thread-bottom-container [class*="thread-content-max-width"],
        #thread-bottom-container [class*="thread-body-max-width"],
        main > div[role="presentation"] > section > div > div > [class*="thread-content-max-width"],
        main [class*="thread-body-max-width"],
        [data-turn] > div > [class*="thread-content-max-width"],
        [data-turn] [class*="max-w-(--thread-content-max-width)"],
        article[data-testid^="conversation-turn-"] > div > [class*="thread-content-max-width"],
        article[data-testid^="conversation-turn-"] [class*="max-w-(--thread-content-max-width)"],
        [data-message-author-role] [class*="thread-content-max-width"],
        [data-turn-key] [class*="thread-content-max-width"],
        [data-chatgpt-search-unit-key] [class*="thread-content-max-width"] {
          --thread-content-max-width: ${maxWidth}px !important;
          --thread-body-max-width: ${maxWidth}px !important;
          --thread-content-width: ${maxWidth}px !important;
          width: min(100%, ${maxWidth}px) !important;
          max-width: ${maxWidth}px !important;
          margin-inline-start: auto !important;
          margin-inline-end: auto !important;
        }

        #thread > div,
        #thread-bottom-container > div,
        #thread-bottom-container #thread-bottom > div {
          --thread-content-max-width: ${maxWidth}px !important;
          --thread-body-max-width: ${maxWidth}px !important;
        }

        /* User turns stay chat-like instead of becoming full-width banners. */
        #thread [data-message-author-role="user"],
        [data-message-author-role="user"],
        [data-turn="user"],
        [data-turn-key$=":user"],
        [data-chatgpt-search-unit-key$=":user"] {
          max-width: min(${userBubbleMax}px, 100%) !important;
          margin-inline-start: auto !important;
        }

        #thread table,
        #thread [class*="tableContainer"],
        #thread [class*="tableWrapper"],
        [data-turn] table,
        [data-turn] [class*="tableContainer"],
        [data-turn] [class*="tableWrapper"] {
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
      #${APP}-newchat-overlay,.${APP}-menu-overlay{position:fixed;z-index:2147482996;display:none;background:transparent;text-decoration:none;cursor:pointer}
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
    let overlay = document.getElementById(`${APP}-newchat-overlay`);
    if (!overlay) {
      overlay = document.createElement('a');
      overlay.id = `${APP}-newchat-overlay`;
      overlay.href = 'https://chatgpt.com/';
      overlay.setAttribute('aria-label', 'New chat');
      overlay.title = 'New chat';
      // Plain left click keeps ChatGPT's own SPA action. Modified/middle/context
      // interactions remain a real link so opening a new tab still works.
      overlay.addEventListener('click', e => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        if (!overlayTarget?.isConnected) return;
        e.preventDefault();
        overlayTarget.click();
      });
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
    if (!overlay || !state.settings.newChatLink || !overlayTarget || !visible(overlayTarget) || (overlayTarget.tagName === 'A' && overlayTarget.href)) {
      if (overlay) overlay.style.display = 'none';
      return;
    }
    const r = overlayTarget.getBoundingClientRect();
    Object.assign(overlay.style, {display:'block', left:`${r.left}px`, top:`${r.top}px`, width:`${r.width}px`, height:`${r.height}px`});
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
   if (!state.settings.menuLinks) {
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
      state.bindings[name] = fp; saveState(); cancelPicker(); applyAll(); toast(`${label} 지정 완료`);
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
  }

  function onPanelEscape(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); }
  }

  // Tampermonkey command opens a temporary modal; nothing is inserted into the sidebar.
  function openPanel() {
    if (!document.body) return;
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
      settingRow('newChatLink','새 채팅 표준 링크 복원','기존 새 채팅의 휠 클릭·Ctrl+클릭·우클릭 새 탭을 유지합니다.'),
       settingRow('menuLinks','사이드바·탐색 메뉴 새 탭','예약·라이브러리·플러그인·지도·이미지·GPT·사이트·Canva의 휠 클릭·제스처·Ctrl+클릭을 지원합니다.'),
      bindRow('newChat','새 채팅 버튼 직접 지정','bind-newchat','자동 탐지가 깨질 때 실제 새 채팅 버튼을 한 번 클릭해 위치를 기억시킵니다.'),
      `<div class="${APP}-item"><div class="${APP}-row"><div class="${APP}-grow"><b>대화 폭 반응형</b><div class="${APP}-muted">창에 따라 늘어나고, 최대폭에 도달하면 대화 영역 전체가 가운데에 고정됩니다. 현재 대화 최대 ${normalizedChatMaxWidth()}px · 내 말풍선 최대 ${normalizedUserBubbleMaxWidth()}px.</div></div><button class="${APP}-btn" data-action="toggle-setting" data-key="wideChat">${state.settings.wideChat?'ON':'OFF'}</button></div><div class="${APP}-row" style="flex-wrap:wrap;margin-top:8px"><button class="${APP}-btn" data-action="set-chat-max" data-width="1200">대화 1200</button><button class="${APP}-btn" data-action="set-chat-max" data-width="1400">대화 1400</button><button class="${APP}-btn" data-action="set-chat-max" data-width="1600">대화 1600</button></div><div class="${APP}-row" style="flex-wrap:wrap;margin-top:8px"><button class="${APP}-btn" data-action="set-user-bubble-max" data-width="640">말풍선 640</button><button class="${APP}-btn" data-action="set-user-bubble-max" data-width="760">말풍선 760</button><button class="${APP}-btn" data-action="set-user-bubble-max" data-width="900">말풍선 900</button></div></div>`,
      `<div class="${APP}-item"><b>설정 백업</b><div class="${APP}-muted" style="margin:4px 0 8px">내보내기·가져오기·초기화는 화면 개선 설정에만 적용됩니다. 구버전 백업도 설정만 가져옵니다.</div><div class="${APP}-row"><button class="${APP}-btn" data-action="export">내보내기</button><button class="${APP}-btn" data-action="import">가져오기</button><button class="${APP}-btn ${APP}-danger" data-action="reset">초기화</button></div><input id="${APP}-import-file" type="file" accept="application/json,.json" hidden></div>`
    ].join('');
  }

  function buildDomReport() {
    const clickables = candidatePool().filter(el => {
      const r = el.getBoundingClientRect();
      return r.left < 650 && r.top < 260;
    }).slice(0, 40).map(el => ({fp: fingerprint(el, 'button'), blob: semanticBlob(el)}));
    const widthTargets = [...document.querySelectorAll(WIDTH_CLASS_SELECTOR)].filter(visible);
    return {
      version: VERSION,
      url: location.href,
      dom: {
        turns: document.querySelectorAll(TURN_SELECTOR).length,
        userTurns: document.querySelectorAll(USER_TURN_SELECTOR).length,
        widthTargets: widthTargets.length,
        prompt: !!document.querySelector('#prompt-textarea,[contenteditable="true"][data-virtualkeyboard]'),
        thread: !!document.querySelector('#thread'),
        bottomContainer: !!document.querySelector('#thread-bottom-container')
      },
      wideStyle: {enabled: state.settings.wideChat, attached: !!document.getElementById(`${APP}-wide-style`), chatMaxWidth: normalizedChatMaxWidth(), userBubbleMaxWidth: normalizedUserBubbleMaxWidth()},
      keyboard: {globalInterception: false, handledKeys: ['Escape (settings/picker only)'], hangulModeHandled: false},
      newChatAuto: fingerprint(findNewChatAuto(), 'button'),
      menuLinks: MENU_LINKS.map(item => ({label:item.label, status:diagMenus[item.id], href:menuOverlays.get(item.id)?.overlay.href || null})),
      bindings: state.bindings,
      topLeftClickables: clickables
    };
  }

  function renderDiagnostics() {
    const report = buildDomReport();
    return `<div class="${APP}-item"><b>대화 폭</b><div>스타일 주입: ${report.wideStyle.attached ? 'PASS' : '미적용'}</div><div>대화 요소: ${report.dom.turns} · 폭 대상: ${report.dom.widthTargets}</div><div class="${APP}-muted">대화가 열린 상태에서 폭 대상이 0이면 ChatGPT DOM이 다시 바뀐 것입니다.</div></div><div class="${APP}-item"><b>키보드 간섭</b><div>한/영(HangulMode): 미처리</div><div class="${APP}-muted">설정창·직접 지정 모드의 Esc 외 키는 가로채지 않습니다.</div></div><div class="${APP}-item"><b>새 채팅 링크</b><div>버튼 탐지: ${diag.newChatTarget ? 'PASS' : '미검출'}</div><div>표준 링크: ${diag.newChatOverlay ? 'PASS' : '미적용'}</div></div><div class="${APP}-item"><b>추가 메뉴 링크</b><div class="${APP}-muted">탐색 항목은 탐색 메뉴를 펼친 상태에서 검사합니다.</div>${MENU_LINKS.map(item => `<div>${esc(item.label)}: ${esc(diagMenus[item.id] || '미검사')}</div>`).join('')}</div><div class="${APP}-row"><button class="${APP}-btn" data-action="rescan">재검사</button><button class="${APP}-btn" data-action="copy-dom-report">DOM 보고서 복사</button></div>`;
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
    } else if (a === 'bind-newchat') startPicker('newChat', 'button', '새 채팅 버튼');
    else if (a === 'clear-binding') {state.bindings.newChat = null; saveState(); applyAll(); renderPanel();}
    else if (a === 'rescan') {applyAll(); renderPanel();}
    else if (a === 'copy-dom-report') navigator.clipboard.writeText(JSON.stringify(buildDomReport(), null, 2)).then(() => toast('DOM 보고서 복사 완료')).catch(() => toast('복사 실패'));
    else if (a === 'export') exportState();
    else if (a === 'import') {
      const input = document.getElementById(`${APP}-import-file`);
      input.onchange = importState; input.click();
    } else if (a === 'reset' && confirm('ChatGPT 개선 스크립트의 화면 개선 설정만 초기화할까요?')) {
      state = clone(DEFAULTS); saveState(); applyAll(); renderPanel();
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
      state = normalizeState(value);
      saveState(); applyAll(); renderPanel(); toast('설정 가져오기 완료');
    } catch (err) {toast(`가져오기 실패: ${err.message}`, 3500);}
    finally {e.target.value = '';}
  }

  function applyAll() {
    if (!document.body) return;
    applyWideLayout();
    ensureNewChatOverlay();
    ensureMenuOverlays();
   }

  function isOwnedNode(node) {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    return !!el?.closest?.(`[id^="${APP}-"]`);
  }

  const NAV_SELECTOR = 'nav,aside,header,#stage-slideover-sidebar,[data-testid*="sidebar" i],[data-testid*="navigation" i],[aria-label*="navigation" i],[aria-label*="탐색" i]';
  const EXPLORE_SELECTOR = '[role="menu"],[role="menuitem"],[data-radix-popper-content-wrapper],[data-testid*="popover" i],[data-side]';
  const scheduleOverlay = debounce(() => { ensureNewChatOverlay(); ensureMenuOverlays(); }, 110);

  // Watch navigation only. Streaming messages need no processing.
  function processMutations(mutations) {
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

  function start() {
    injectStyles();
    setupCrossTabSync();
    applyAll();
    const observer = new MutationObserver(processMutations);
    observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-state', 'aria-hidden', 'aria-expanded', 'href', 'open']});
    const syncOverlayPositions = () => { syncNewChatOverlay(); syncMenuOverlays(); };
   addEventListener('resize', syncOverlayPositions, {passive: true});
   addEventListener('scroll', syncOverlayPositions, {capture: true, passive: true});
    addEventListener('popstate', scheduleOverlay);
    addEventListener('pageshow', scheduleOverlay);
    addEventListener('hashchange', scheduleOverlay);
    if (window.navigation?.addEventListener) window.navigation.addEventListener('navigate', scheduleOverlay);
    // Sidebar expansion uses transitions that do not necessarily resize the window.
    document.addEventListener('click', e => {
      if (e.target?.closest?.(NAV_SELECTOR) || e.target?.closest?.(EXPLORE_SELECTOR)) {
       requestAnimationFrame(() => { syncNewChatOverlay(); ensureMenuOverlays(); });
       setTimeout(ensureMenuOverlays, 260);
      }
    }, true);
    console.info(`[ChatGPT 개선 스크립트] v${VERSION} started`);
  }

  registerMenu();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true}); else start();
})();
