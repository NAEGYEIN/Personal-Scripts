// ==UserScript==
// @name         Instagram Tweaks - Controls & Diagnostics
// @name:ko      인스타그램 트윅 - 영상 제어 및 진단
// @namespace    https://local.userscripts.invalid/instagram-web-plus
// @version      1.1.2
// @description  User-controlled video playback, offscreen pause, video controls, remembered media, no loop, saved shortcut, inline copy button and privacy-preserving diagnostics.
// @description:ko 자동재생 차단, 화면 밖 정지, 영상 컨트롤, 음량·속도 기억, 반복 해제, 컬렉션 바로가기, 게시물 링크 복사 및 진단.
// @homepageURL  https://github.com/NAEGYEIN/Personal-Scripts/tree/main/instagram-tweaks
// @supportURL   https://github.com/NAEGYEIN/Personal-Scripts/issues
// @updateURL    https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/instagram-tweaks/instagram-tweaks.meta.js
// @downloadURL  https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/instagram-tweaks/instagram-tweaks.user.js
// @match        https://www.instagram.com/*
// @match        https://instagram.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==
(() => {
  'use strict';
  const GUARD = '__IG_WEB_PLUS_RUNNING__';
  if (window[GUARD]) return;
  Object.defineProperty(window, GUARD, { value: true, configurable: true });
  const VERSION = '1.1.2';
  const STORE = 'ig-web-plus:v1:settings'; // preserve v1 preferences
  const MEDIA_STORE = 'ig-web-plus:v1:media';
  const FEATURES = {
    offscreenPause: ['화면 밖 영상 자동 정지', true],
    disableAutoplay: ['영상 자동재생 차단', true],
    videoControls: ['영상 컨트롤 UI', true],
    rememberMedia: ['음량·재생속도 기억', true],
    disableLoop: ['반복재생 해제', true],
    savedShortcut: ['컬렉션 바로가기', true],
    copyPostLink: ['게시물 링크 복사', true],
    diagnostics: ['상세 진단 기록', false]
  };
  const defaults = Object.fromEntries(Object.entries(FEATURES).map(([k, v]) => [k, v[1]]));
  const read = (key, otherwise) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? otherwise; } catch (_) { return otherwise; } };
  const prefs = read(STORE, {});
  const settings = Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, typeof prefs[k] === 'boolean' ? prefs[k] : v]));
  const oldMedia = read(MEDIA_STORE, {});
  const media = {
    muted: typeof oldMedia.muted === 'boolean' ? oldMedia.muted : null,
    volume: Number.isFinite(oldMedia.volume) ? Math.max(0, Math.min(1, oldMedia.volume)) : null,
    rate: Number.isFinite(oldMedia.rate) ? Math.max(.25, Math.min(3, oldMedia.rate)) : null
  };
  const start = Date.now();
  const counts = Object.create(null), messages = [];
  const inc = (key) => { counts[key] = (counts[key] || 0) + 1; };
  const log = (key, details = '', level = 'info') => {
    inc(`event_${key}`);
    if (!settings.diagnostics && level === 'info') return;
    // Do not record URLs, usernames, media content, DOM strings or clipboard values.
    messages.push({ time: new Date().toISOString(), level, event: key, detail: String(details).slice(0, 100) });
    if (messages.length > 180) messages.shift();
    if (panelVisible) drawStatus();
  };
  const safe = (key, fn) => { try { return fn(); } catch (e) { inc('errors'); log(key, e?.name || 'Error', 'error'); return null; } };
  const saveSettings = () => safe('save_settings', () => localStorage.setItem(STORE, JSON.stringify(settings)));
  const saveMedia = () => safe('save_media', () => localStorage.setItem(MEDIA_STORE, JSON.stringify(media)));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const tick = () => performance.now();
  const icons = {
    bookmark: '<path d="M5 3h14v18l-7-5-7 5z"/>',
    sliders: '<path d="M4 7h16M4 17h16M9 4v6M15 14v6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    pause: '<rect x="7" y="5" width="3" height="14"/><rect x="14" y="5" width="3" height="14"/>',
    close: '<path d="M5 5l14 14M19 5 5 19"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 18v3h14v-3"/>'
  };
  const ico = (type, size = 24) => `<svg aria-hidden="true" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[type]}</svg>`;
  let root, shadow, panel, bar, panelVisible = false, navSaved = null, navSettings = null, navTarget = null;
  let currentVideo = null, lastPointer = { x: -1, y: -1 }, mediaTimer = null;
  let observer, intersect, scanScheduled = false, mutationCandidates = new Set();
  let currentHref = location.href, currentProfile = null, lastScan = -Infinity, lastPostsScan = -Infinity, lastNavUpdate = 0;
  let lastBarUpdate = 0, busyBar = false, lastPointerUpdate = 0;
  const videos = new Set(), videoStates = new WeakMap();
  const postButtons = new Map();
  let originalPlay = null;
  const PROFILE_PATH_PATTERN = /^\/([A-Za-z0-9._]{1,30})\/?$/;
  const RESERVED_PROFILE_PATTERN = /^(explore|reels?|direct|p|stories|accounts|saved|about|privacy|legal|notifications|developer|web|api|threads)$/i;

  function isVideo(el) { return el instanceof HTMLVideoElement; }
  function partVisible(v) {
    if (!v?.isConnected || document.hidden) return 0;
    const rect = v.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return 0;
    const w = Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left));
    const h = Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top));
    return (w * h) / (rect.width * rect.height);
  }
  function isPictureSurface(v) {
    return document.pictureInPictureElement === v || document.fullscreenElement === v || !!document.fullscreenElement?.contains(v);
  }
  const isOffscreen = (v) => !isPictureSurface(v) && partVisible(v) < 0.28;
  function stateFor(v) {
    let s = videoStates.get(v);
    if (!s) {
      s = { originalControls: v.controls, originalLoop: v.loop, originalAutoplay: v.autoplay,
        manualUntil: 0, mediaGestureUntil: 0, lastPlayAt: -Infinity, authorizedPlayback: false, requireManualResume: false, justSet: null, lastRestore: 0,
        originalClean: [] };
      videoStates.set(v, s);
    }
    return s;
  }
  function manualIntent(v) {
    if (!isVideo(v)) return;
    const s = stateFor(v);
    s.manualUntil = tick() + 1600;
    s.requireManualResume = false;
    inc('manual_play_intents');
  }
  function canPlay(v, forStart = false) {
    if (settings.offscreenPause && isOffscreen(v)) return false;
    const s = stateFor(v);
    // Authorization persists for continuous manual playback, not just for the first 1.6s.
    if (s.authorizedPlayback && !v.paused && !forStart) return true;
    if ((settings.disableAutoplay || s.requireManualResume) && tick() > s.manualUntil) return false;
    return true;
  }
  // Intercept JS-driven play() even before Instagram mounts its React tree.
  // No direct Instagram APIs, network hooks, or internal state mutation.
  function installPlayGuard() {
    const prototype = HTMLMediaElement.prototype;
    originalPlay = prototype.play;
    if (typeof originalPlay !== 'function') return;
    const patched = function (...args) {
      if (isVideo(this) && !canPlay(this, this.paused)) {
        inc('play_calls_blocked');
        if (!this.paused) safe('blocked_pause', () => this.pause());
        return Promise.reject(new DOMException('Playback requires a direct play action', 'NotAllowedError'));
      }
      if (isVideo(this)) inc('play_calls_allowed');
      return originalPlay.apply(this, args);
    };
    safe('patch_play', () => { prototype.play = patched; inc('play_guard_installed'); });
  }
  installPlayGuard();

  function stop(v, reason) {
    if (!v || v.paused) return;
    const result = safe('pause', () => { v.pause(); return true; });
    if (!result) return;
    if (reason === 'offscreen') {
      stateFor(v).authorizedPlayback = false;
      stateFor(v).requireManualResume = true;
      stateFor(v).manualUntil = 0; // returning onscreen always requires a new explicit action
      inc('offscreen_pauses');
    } else if (reason === 'autoplay') inc('autoplay_pauses');
    log('video_paused', reason);
  }
  function enforcePlayback(v, from) {
    if (!isVideo(v) || v.paused) return;
    if (settings.offscreenPause && isOffscreen(v)) { stop(v, 'offscreen'); return; }
    if (!canPlay(v, from === 'play')) stop(v, 'autoplay');
    else { if (from === 'play') stateFor(v).authorizedPlayback = true; inc('playback_verified'); }
    if (settings.diagnostics && from === 'playing') log('playing_verified', v.paused ? 'blocked' : 'allowed');
  }
  function enforceAttrs(v) {
    if (settings.disableLoop && v.loop) { v.loop = false; inc('loops_disabled'); }
    if (settings.disableAutoplay && v.autoplay) { v.autoplay = false; inc('autoplay_attributes_removed'); }
    if (settings.videoControls && !v.controls) v.controls = true;
  }
  function applyMedia(v, reason = 'init') {
    if (!settings.rememberMedia || !v?.isConnected) return;
    const s = stateFor(v);
    if (reason !== 'init' && tick() - s.lastRestore < 80) return;
    const expected = { volume: media.volume, muted: media.muted, rate: media.rate };
    let touched = false;
    if (expected.volume !== null && Math.abs(v.volume - expected.volume) > .001) { v.volume = expected.volume; touched = true; }
    if (expected.muted !== null && v.muted !== expected.muted) { v.muted = expected.muted; touched = true; }
    if (expected.rate !== null && Math.abs(v.playbackRate - expected.rate) > .001) { v.playbackRate = expected.rate; touched = true; }
    if (touched) { s.justSet = { ...expected, until: tick() + 700 }; s.lastRestore = tick(); inc('media_restore_applied'); log('media_restored', reason); }
  }
  function recordMedia(v, kind, event) {
    if (!settings.rememberMedia) return;
    const s = stateFor(v);
    if (s.justSet && tick() <= s.justSet.until) {
      const same = kind === 'rate' ? Math.abs(v.playbackRate - (s.justSet.rate ?? v.playbackRate)) < .001 :
        Math.abs(v.volume - (s.justSet.volume ?? v.volume)) < .001 && v.muted === (s.justSet.muted ?? v.muted);
      if (same) { inc('media_echo_suppressed'); return; }
    }
    // Native controls typically dispatch trusted events following pointer/keyboard input.
    // Never let an unrelated Instagram-initiated mute overwrite a saved user preference.
    const r = v.getBoundingClientRect();
    const pointerOver = lastPointer.x >= r.left && lastPointer.x <= r.right && lastPointer.y >= r.top && lastPointer.y <= r.bottom;
    // Browser-native media controls may consume pointerdown without dispatching it to the page.
    // A trusted media event under the hovered player (not just after starting playback)
    // is therefore treated as an explicit native-control adjustment.
    const nativeControlChange = !!event?.isTrusted && pointerOver && partVisible(v) > .28 && tick() - s.lastPlayAt > 400;
    const recent = tick() < s.mediaGestureUntil || nativeControlChange;
    if (!recent && !event?.isTrusted) return applyMedia(v, 'app-reset');
    if (!recent && event?.isTrusted) {
      // A trusted native media event can originate from the site; only retain known intent.
      if ((kind === 'rate' && media.rate !== null) || (kind === 'audio' && media.volume !== null)) return applyMedia(v, 'unexpected-change');
      return;
    }
    if (kind === 'rate') media.rate = v.playbackRate;
    else { media.volume = v.volume; media.muted = v.muted; }
    inc('media_preferences_saved');
    log('media_saved', kind);
    clearTimeout(mediaTimer);
    mediaTimer = setTimeout(saveMedia, 120);
  }
  function setFromControls(v, kind, value) {
    if (!v) return;
    manualIntent(v);
    if (kind === 'volume') {
      v.volume = clamp(value, 0, 1); v.muted = value === 0;
      if (settings.rememberMedia) { media.volume = v.volume; media.muted = v.muted; }
    } else { v.playbackRate = clamp(value, .25, 3); if (settings.rememberMedia) media.rate = v.playbackRate; }
    if (settings.rememberMedia) { saveMedia(); inc('media_preferences_saved'); log('media_saved', kind); }
  }
  function registerVideo(v) {
    if (!isVideo(v) || videos.has(v)) return;
    videos.add(v); inc('videos_found');
    const s = stateFor(v);
    enforceAttrs(v);
    applyMedia(v);
    const onPlay = () => { s.lastPlayAt = tick(); enforceAttrs(v); enforcePlayback(v, 'play'); updateBar(); };
    const onPlaying = () => enforcePlayback(v, 'playing');
    const onMeta = () => { enforceAttrs(v); applyMedia(v, 'metadata'); updateBar(); };
    const onVolume = e => { recordMedia(v, 'audio', e); updateBar(); };
    const onRate = e => { recordMedia(v, 'rate', e); updateBar(); };
    const onPause = () => { s.authorizedPlayback = false; updateBar(); };
    const onRefresh = () => updateBar();
    const listeners = { play: onPlay, playing: onPlaying, loadedmetadata: onMeta, volumechange: onVolume,
      ratechange: onRate, pause: onPause, ended: onPause, timeupdate: onRefresh };
    for (const [event, fn] of Object.entries(listeners)) v.addEventListener(event, fn);
    const attrObserver = new MutationObserver(() => enforceAttrs(v));
    attrObserver.observe(v, { attributes: true, attributeFilter: ['loop', 'autoplay', 'controls'] });
    s.originalClean.push(() => { attrObserver.disconnect(); for (const [event, fn] of Object.entries(listeners)) v.removeEventListener(event, fn); });
    intersect?.observe(v);
    enforcePlayback(v, 'registered');
  }
  function cleanDisconnected() {
    for (const v of videos) {
      if (v.isConnected) continue;
      const s = videoStates.get(v);
      for (const fn of s?.originalClean || []) fn();
      intersect?.unobserve(v); videos.delete(v); videoStates.delete(v);
      if (currentVideo === v) hideBar();
    }
    for (const [a, button] of postButtons) if (!a.isConnected) { button.remove(); postButtons.delete(a); }
  }
  function pauseOffscreen() {
    if (!settings.offscreenPause) return;
    for (const v of videos) if (isOffscreen(v)) stop(v, 'offscreen');
  }
  function captureUserIntent(event) {
    if (event.type === 'keydown') {
      if (event.key !== ' ' && event.key !== 'Enter' && event.key !== 'k') return;
      const active = document.activeElement;
      if (isVideo(active)) manualIntent(active);
      return;
    }
    const x = event.clientX, y = event.clientY;
    if (x == null || y == null) return;
    for (const v of videos) {
      const r = v.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && partVisible(v) > .12) {
        manualIntent(v);
        // Playback clicks are not necessarily volume edits. Only interactions near native
        // media controls authorize persistence of native volume/speed changes.
        if (y >= r.bottom - Math.min(90, r.height * .24)) stateFor(v).mediaGestureUntil = tick() + 9000;
        // A native video control is a user action, not a request to autoplay all videos.
        return;
      }
    }
  }
  function requestPlay(v) {
    if (!v || !v.isConnected) return;
    manualIntent(v);
    const promise = v.play();
    if (promise?.catch) promise.catch(() => log('manual_play_rejected', 'browser', 'warn'));
    updateBar();
  }

  function findProfile() {
    // Only trust a username URL from an actual profile-navigation link, never feed authors.
    const options = [];
    for (const a of document.querySelectorAll('a[href]')) {
      let url;
      try { url = new URL(a.getAttribute('href'), location.origin); } catch (_) { continue; }
      if (url.hostname !== location.hostname) continue;
      const found = url.pathname.match(PROFILE_PATH_PATTERN);
      if (!found) continue;
      if (RESERVED_PROFILE_PATTERN.test(found[1])) continue;
      const text = [a.getAttribute('aria-label') || '', a.getAttribute('title') || '', a.textContent || ''].join(' ').trim();
      const inNav = !!a.closest('nav, aside, [role="navigation"]');
      const explicit = /(^|\s)(프로필|profile|내 프로필|my profile)(\s|$)/i.test(text);
      if (!inNav && !explicit) continue;
      const score = (inNav ? 40 : 0) + (explicit ? 60 : 0) + (a.querySelector('img') ? 10 : 0);
      options.push({ anchor: a, user: found[1], score });
    }
    options.sort((a, b) => b.score - a.score);
    return options[0] || null;
  }
  function findNavRow(anchor) {
    let child = anchor;
    for (let i = 0; i < 6 && child.parentElement; i++) {
      const parent = child.parentElement;
      const items = [...parent.children];
      // A navigation list typically has multiple child rows, each containing one link.
      if (items.length >= 2 && items.some(x => x !== child && !!x.querySelector?.('a[href]')) && child.querySelectorAll('a[href]').length <= 1) return child;
      child = parent;
      if (child.matches('nav,aside,[role="navigation"]')) break;
    }
    return anchor;
  }
  function removeRepeatedIds(element) { element.removeAttribute('id'); element.querySelectorAll('[id]').forEach(el => el.removeAttribute('id')); }
  function navClone(row, type) {
    const item = row.cloneNode(true);
    removeRepeatedIds(item);
    const link = item.matches('a') ? item : item.querySelector('a[href]');
    if (!link) return null;
    link.removeAttribute('target'); link.removeAttribute('download');
    link.setAttribute('aria-label', type === 'saved' ? '컬렉션' : 'IG+ 설정');
    link.setAttribute('title', type === 'saved' ? '저장된 게시물 및 컬렉션' : 'Instagram Tweaks 설정');
    link.dataset.igpNavigation = type;
    link.setAttribute('href', type === 'saved' ? `/${encodeURIComponent(currentProfile)}/saved/` : '#igp-settings');
    // Preserve the existing DOM structure/CSS classes but replace its visible content.
    const oldSvg = link.querySelector('svg, img');
    if (oldSvg) oldSvg.outerHTML = ico(type === 'saved' ? 'bookmark' : 'sliders', 24);
    else link.insertAdjacentHTML('afterbegin', ico(type === 'saved' ? 'bookmark' : 'sliders', 24));
    const labels = [...link.querySelectorAll('span')].filter(n => n.children.length === 0 && n.textContent.trim());
    const label = labels.find(n => /프로필|profile/i.test(n.textContent)) || labels.at(-1);
    if (label) label.textContent = type === 'saved' ? '컬렉션' : 'IG+ 설정';
    else {
      const span = document.createElement('span'); span.textContent = type === 'saved' ? '컬렉션' : 'IG+ 설정'; link.append(span);
    }
    return { item, link };
  }
  function ensureNav() {
    // Avoid scanning the entire feed for a profile link on every Instagram DOM update.
    if (navTarget?.isConnected && navSettings?.item.isConnected &&
        (!settings.savedShortcut || navSaved?.item.isConnected)) {
      const match = (navTarget.getAttribute('href') || '').match(PROFILE_PATH_PATTERN);
      if (match && match[1] === currentProfile) return;
    }
    const profile = findProfile();
    if (!profile) { inc('nav_profile_missing'); return; }
    const same = currentProfile === profile.user && navTarget === profile.anchor && (!settings.savedShortcut || navSaved?.item.isConnected) && navSettings?.item.isConnected;
    if (same) return;
    currentProfile = profile.user; navTarget = profile.anchor;
    navSaved?.item.remove(); navSettings?.item.remove();
    navSaved = null; navSettings = null;
    const row = findNavRow(profile.anchor);
    const parent = row.parentElement;
    if (!parent) return;
    const saved = settings.savedShortcut ? navClone(row, 'saved') : null;
    const settingsLink = navClone(row, 'settings');
    if ((settings.savedShortcut && !saved) || !settingsLink) { inc('nav_clone_failed'); return; }
    // Place saved before profile, settings after profile; native nav styling follows layout.
    if (saved) parent.insertBefore(saved.item, row);
    row.after(settingsLink.item);
    navSaved = saved; navSettings = settingsLink;
    if (saved) inc('saved_shortcut_injected'); inc('settings_shortcut_injected');
    log('sidebar_links_installed');
  }
  function onNavClick(event) {
    const a = event.target.closest?.('a[data-igp-navigation]');
    if (!a) return;
    const type = a.dataset.igpNavigation;
    if (type === 'settings') { event.preventDefault(); togglePanel(!panelVisible); }
    // For saved, keep a REAL anchor: middle-click/Ctrl+click/new-tab work natively.
  }
  const POST_PATTERN = /^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/;
  function getPostUrl(a) {
    try {
      const u = new URL(a.href, location.href);
      return (u.hostname === location.hostname && POST_PATTERN.test(u.pathname)) ? u.origin + u.pathname.replace(/\/$/, '') + '/' : null;
    } catch (_) { return null; }
  }
  function postUrl(article) {
    const link = article?.querySelector?.('a[href*="/p/"],a[href*="/reel/"],a[href*="/tv/"]');
    const nested = link && getPostUrl(link);
    if (nested) return nested;
    if (POST_PATTERN.test(location.pathname)) return location.origin + location.pathname.replace(/\/$/, '') + '/';
    return null;
  }
  function copyTarget(article) {
    const glyphs = article.querySelectorAll('svg[aria-label], [role="img"][aria-label]');
    for (const svg of glyphs) {
      if (!/^(저장|Save|저장됨|Remove)$/i.test(svg.getAttribute('aria-label') || '')) continue;
      let parent = svg;
      for (let i = 0; i < 4 && parent?.parentElement; i++) {
        parent = parent.parentElement;
        if (parent.matches('button, [role="button"]')) return parent;
      }
    }
    // Otherwise, put it in the post's existing action section; never fixed to the viewport.
    return article.querySelector('section') || article;
  }
  function addCopy(article) {
    if (postButtons.has(article) || !settings.copyPostLink || !postUrl(article)) return;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'igp-inline-copy';
    btn.setAttribute('aria-label', '게시물 링크 복사'); btn.setAttribute('title', '게시물 링크 복사');
    btn.innerHTML = ico('copy', 20) + '<span>링크 복사</span>';
    const target = copyTarget(article);
    if (target === article) article.append(btn); else target.after(btn);
    postButtons.set(article, btn);
    inc('copy_buttons_injected');
  }
  async function copyPost(article, button) {
    const value = postUrl(article);
    if (!value) { inc('copy_link_missing'); return; }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const t = document.createElement('textarea'); t.value = value; t.style.position = 'fixed'; t.style.left = '-9999px';
        document.body.append(t); t.select(); const ok = document.execCommand('copy'); t.remove();
        if (!ok) throw Error('Clipboard unavailable');
      }
      inc('links_copied'); button.querySelector('span').textContent = '복사됨';
      setTimeout(() => { if (button.isConnected) button.querySelector('span').textContent = '링크 복사'; }, 1000);
    } catch (e) { inc('copy_errors'); log('copy_failed', e.name || 'error', 'error'); }
  }
  function removeCopies() { for (const btn of postButtons.values()) btn.remove(); postButtons.clear(); }

  const CSS = `
    :host{all:initial;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
    *{box-sizing:border-box;} [hidden]{display:none!important}
    button,select,input{font-family:inherit;}
    .panel{position:fixed;z-index:2147483620;width:min(370px,calc(100vw - 20px));max-height:calc(100vh - 24px);overflow:auto;top:12px;left:95px;background:#1e2024;color:#f5f5f5;border:1px solid #54565b;border-radius:12px;box-shadow:0 12px 35px #000a;padding:15px;font-size:13px;pointer-events:auto;}
    .top{display:flex;justify-content:space-between;align-items:center;gap:12px}.top h2{font-size:15px;margin:0}.top small{font-size:11px;color:#b4b4b4}
    .top button{background:transparent;border:0;color:inherit;cursor:pointer;padding:5px}.fields{margin:8px 0}
    .fields label{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #34373b;cursor:pointer}
    input[type=checkbox]{width:18px;height:18px;accent-color:#ffffff;cursor:pointer;flex-shrink:0}
    .actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.actions button{background:#34373c;color:#fff;border:1px solid #777;border-radius:7px;padding:8px;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:6px}
    .notes{font-size:11px;color:#adb0b5;white-space:pre-line;line-height:1.65}.panel pre{font:11px/1.5 Consolas,monospace;background:#101113;border-radius:5px;max-height:130px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:8px}
    .bar{position:fixed;z-index:2147483610;color:white;display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:9px;border:1px solid #ffffff60;background:#18191ced;box-shadow:0 4px 14px #0008;max-width:calc(100vw - 16px);min-width:270px;user-select:none;pointer-events:auto;font-size:12px}
    .bar button{background:#303238;color:white;border:0;border-radius:6px;cursor:pointer;height:27px;min-width:28px;display:flex;align-items:center;justify-content:center;padding:4px}
    .bar input[type=range]{min-width:30px;accent-color:#f1f1f1;cursor:pointer}.bar .seek{flex:1;width:55px}.bar .volume{width:45px}.bar .time{font-size:10px;white-space:nowrap;font-variant-numeric:tabular-nums}
    .bar select{font-size:11px;background:#303238;border:1px solid #666;color:white;border-radius:4px;max-width:65px}
    @media(max-width:600px){.bar{gap:3px;padding:5px}.bar .time{display:none}.bar .volume{width:30px}}
  `;
  const COPY_CSS = `
    .igp-inline-copy{display:inline-flex!important;align-items:center;gap:5px;border:0!important;background:transparent!important;color:inherit!important;font:inherit!important;cursor:pointer!important;padding:6px 9px!important;margin:0 4px!important;border-radius:7px!important;vertical-align:middle!important;position:static!important;box-shadow:none!important;max-width:max-content!important;}
    .igp-inline-copy:hover{background:rgba(128,128,128,.18)!important}.igp-inline-copy span{font-size:12px!important}
  `;
  function initializeUI() {
    const style = document.createElement('style'); style.id = 'igp-inline-style'; style.textContent = COPY_CSS;
    (document.head || document.documentElement).append(style);
    root = document.createElement('div'); root.id = 'igp-root';
    root.style.setProperty('all', 'initial', 'important');
    shadow = root.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${CSS}</style>
      <div class="panel" id="igp-panel" hidden><div class="top"><h2>Instagram Tweaks <small>v${VERSION}</small></h2><button type="button" id="close" aria-label="닫기">${ico('close', 20)}</button></div><div class="fields" id="fields"></div><h3>상태 및 진단</h3><div class="notes" id="status"></div><pre id="logs"></pre><div class="actions"><button id="self-check">자체 점검</button><button id="export">${ico('download', 15)} 진단 JSON</button><button id="reset">설정 초기화</button></div><p class="notes">진단 데이터는 외부로 전송하지 않습니다. 영상·사용자명·게시물 주소는 기록하지 않습니다. 자동재생 차단은 영상 다운로드까지 막지는 않습니다.</p></div>
      <div id="bar" class="bar" hidden><button id="play" title="수동 재생/정지">${ico('play', 17)}</button><input id="seek" class="seek" type="range" min="0" max="1000" value="0" aria-label="재생 위치"><span id="time" class="time">--:--</span><input id="volume" class="volume" type="range" min="0" max="1" step=".05" aria-label="음량"><select id="rate" aria-label="배속"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="1.75">1.75×</option><option value="2">2×</option></select></div>`;
    document.body.appendChild(root);
    panel = shadow.querySelector('#igp-panel'); bar = shadow.querySelector('#bar');
    const fieldRoot = shadow.querySelector('#fields');
    for (const [name, [label]] of Object.entries(FEATURES)) {
      const row = document.createElement('label'); const caption = document.createElement('span'); caption.textContent = label;
      const c = document.createElement('input'); c.type = 'checkbox'; c.dataset.setting = name; c.checked = settings[name];
      row.append(caption, c); fieldRoot.append(row);
    }
    fieldRoot.addEventListener('change', e => {
      const name = e.target?.dataset?.setting;
      if (name && Object.hasOwn(FEATURES, name)) changeSetting(name, e.target.checked);
    });
    shadow.querySelector('#close').addEventListener('click', () => togglePanel(false));
    shadow.querySelector('#self-check').addEventListener('click', () => { const result = selfCheck(); window.alert(`자체 점검 ${result.passed}/${result.total} 통과\n자세한 내용은 진단 JSON을 확인하세요.`); });
    shadow.querySelector('#export').addEventListener('click', exportDiagnostic);
    shadow.querySelector('#reset').addEventListener('click', () => {
      if (!window.confirm('IG+ 설정을 기본값으로 되돌릴까요?')) return;
      for (const [k, v] of Object.entries(defaults)) changeSetting(k, v);
    });
    shadow.querySelector('#play').addEventListener('click', () => {
      if (!currentVideo) return;
      if (currentVideo.paused) requestPlay(currentVideo); else currentVideo.pause();
      updateBar(true);
    });
    shadow.querySelector('#seek').addEventListener('input', e => {
      const v = currentVideo;
      if (v && Number.isFinite(v.duration) && v.duration > 0) { v.currentTime = v.duration * (e.target.value / 1000); updateBar(true); }
    });
    shadow.querySelector('#volume').addEventListener('input', e => { if (currentVideo) { setFromControls(currentVideo, 'volume', +e.target.value); updateBar(true); } });
    shadow.querySelector('#rate').addEventListener('change', e => { if (currentVideo) { setFromControls(currentVideo, 'rate', +e.target.value); updateBar(true); } });
    bar.addEventListener('pointerenter', () => { busyBar = true; });
    bar.addEventListener('pointerleave', () => { busyBar = false; locateVideo(); });
    inc('ui_created');
  }
  function togglePanel(visible) {
    if (!panel) return;
    panelVisible = !!visible; panel.hidden = !panelVisible;
    if (visible) {
      const r = navSettings?.link.getBoundingClientRect();
      if (r) { panel.style.left = `${clamp(r.right + 12, 10, innerWidth - Math.min(380, innerWidth))}px`; panel.style.top = `${clamp(r.top - 180, 10, Math.max(10, innerHeight - 400))}px`; }
      drawStatus();
    }
  }
  function time(n) { return Number.isFinite(n) && n >= 0 ? `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}` : '--:--'; }
  function hideBar() { if (bar) bar.hidden = true; currentVideo = null; }
  function positionBar(v) {
    if (!bar || !v || partVisible(v) < .28) return hideBar();
    const rect = v.getBoundingClientRect();
    const w = Math.min(435, Math.max(275, rect.width - 16), innerWidth - 18);
    bar.style.width = `${w}px`;
    bar.style.left = `${clamp(rect.left + (rect.width - w)/2, 8, Math.max(8, innerWidth - w - 8))}px`;
    bar.style.top = `${clamp(rect.top + 8, 8, Math.max(8, innerHeight - 44))}px`;
  }
  function updateBar(force = false) {
    if (!bar || bar.hidden || !currentVideo || !settings.videoControls) return;
    if (!force && tick() - lastBarUpdate < 130) return;
    lastBarUpdate = tick();
    const v = currentVideo;
    shadow.querySelector('#play').innerHTML = ico(v.paused ? 'play' : 'pause', 17);
    const seek = shadow.querySelector('#seek'); seek.disabled = !Number.isFinite(v.duration) || v.duration <= 0;
    if (!seek.disabled && !busyBar) seek.value = String(Math.floor(clamp(v.currentTime / v.duration, 0, 1) * 1000));
    shadow.querySelector('#time').textContent = `${time(v.currentTime)}/${time(v.duration)}`;
    shadow.querySelector('#volume').value = String(v.muted ? 0 : v.volume);
    const speed = shadow.querySelector('#rate');
    for (const option of speed.options) {
      if (+option.value === v.playbackRate) { speed.value = String(v.playbackRate); break; }
    }
  }
  function locateVideo() {
    if (!bar || !settings.videoControls || busyBar || panelVisible) return;
    const { x, y } = lastPointer;
    let choice = null;
    for (const v of videos) {
      if (partVisible(v) < .28) continue;
      const r = v.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { choice = v; break; }
    }
    if (!choice) return hideBar();
    currentVideo = choice; bar.hidden = false; positionBar(choice); updateBar(true);
  }
  function drawStatus() {
    if (!panelVisible || !shadow) return;
    const heap = performance.memory?.usedJSHeapSize;
    shadow.querySelector('#status').textContent = `영상 추적 ${videos.size}개 · ${Math.round((Date.now() - start)/1000)}초 실행${Number.isFinite(heap) ? ` · JS 힙 ${(heap/1048576).toFixed(1)}MB` : ''}\n` +
      `자동재생 차단 ${counts.play_calls_blocked || 0}회 · 자동재생 정지 ${counts.autoplay_pauses || 0}회\n화면 밖 정지 ${counts.offscreen_pauses || 0}회 · 음량 복원 ${counts.media_restore_applied || 0}회\n컬렉션 메뉴 ${navSaved?.item.isConnected ? '연결' : '미발견'} · 링크 버튼 ${postButtons.size}개 · 오류 ${counts.errors || 0}건`;
    shadow.querySelector('#logs').textContent = messages.slice(-12).map(m => `[${m.time.slice(11,19)}] ${m.level}/${m.event} ${m.detail}`).join('\n') || '상세 진단 OFF 또는 기록 없음';
  }
  function selfCheck() {
    const checks = {
      'play interception': !!originalPlay && HTMLMediaElement.prototype.play !== originalPlay,
      'settings initialized': !!panel && Object.keys(FEATURES).every(k => !!shadow.querySelector(`[data-setting="${k}"]`)),
      'video observer active': !!observer,
      'sidebar saved shortcut': settings.savedShortcut ? !!navSaved?.item.isConnected : true,
      'sidebar settings shortcut': !!navSettings?.item.isConnected,
      'copy button placement': [...postButtons.values()].every(b => b.closest('article') && getComputedStyle(b).position !== 'fixed'),
      'removed recommendation filter': !Object.hasOwn(settings, 'hideSuggested'),
      'saved video preference': media.volume === null || (media.volume >= 0 && media.volume <= 1)
    };
    const total = Object.keys(checks).length;
    const passed = Object.values(checks).filter(Boolean).length;
    inc('self_checks'); log('self_test', `${passed}/${total}`, passed === total ? 'info' : 'warn');
    lastSelfCheck = { at: new Date().toISOString(), checks, passed, total };
    return lastSelfCheck;
  }
  let lastSelfCheck = null;
  function exportDiagnostic() {
    safe('export', () => {
      const data = { product: 'Instagram Tweaks', version: VERSION, exportedAt: new Date().toISOString(),
        durationSeconds: Math.round((Date.now() - start)/1000), settings: { ...settings },
        mediaPresent: { volume: media.volume !== null, muted: media.muted !== null, rate: media.rate !== null },
        counts: { ...counts }, videosTracked: videos.size, copyButtons: postButtons.size,
        sidebar: { saved: !!navSaved?.item.isConnected, settings: !!navSettings?.item.isConnected },
        selfTest: lastSelfCheck, performance: { jsHeapBytes: performance.memory?.usedJSHeapSize ?? null },
        events: [...messages], privacy: 'No user IDs, URLs, media URLs, captions or content logged. Local download only.' };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `instagram-tweaks-v${VERSION}-diagnostics-${new Date().toISOString().slice(0,10)}.json`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
      inc('diagnostic_exports');
    });
  }
  function changeSetting(name, value) {
    if (!Object.hasOwn(FEATURES, name)) return;
    settings[name] = !!value;
    saveSettings();
    const input = shadow?.querySelector(`[data-setting="${name}"]`);
    if (input) input.checked = settings[name];
    inc('settings_changed'); log('setting_changed', name + '=' + settings[name]);
    if (name === 'offscreenPause' && value) pauseOffscreen();
    if (name === 'disableAutoplay') {
      for (const v of videos) { enforceAttrs(v); if (value) enforcePlayback(v, 'setting'); else v.autoplay = stateFor(v).originalAutoplay; }
    }
    if (name === 'disableLoop') for (const v of videos) { if (value) enforceAttrs(v); else v.loop = stateFor(v).originalLoop; }
    if (name === 'videoControls') {
      for (const v of videos) v.controls = value ? true : stateFor(v).originalControls;
      if (!value) hideBar();
    }
    if (name === 'rememberMedia' && value) for (const v of videos) applyMedia(v, 'setting');
    if (name === 'savedShortcut') { navSaved?.item.remove(); navSaved = null; ensureNav(); }
    if (name === 'copyPostLink') { if (!value) removeCopies(); else scanPosts(); }
    drawStatus();
  }
  function scanPosts() {
    if (!settings.copyPostLink) return;
    for (const article of document.querySelectorAll('article')) addCopy(article);
  }
  function onDocumentClick(e) {
    const node = e.target instanceof Element ? e.target : null;
    if (!node) return;
    const target = node.closest('button.igp-inline-copy');
    if (target) {
      e.preventDefault(); e.stopPropagation();
      const article = target.closest('article'); if (article) void copyPost(article, target);
    }
  }
  function scanAll() {
    scanScheduled = false;
    const now = tick();
    const changedArticles = new Set();
    for (const node of mutationCandidates) {
      if (node.matches?.('video')) registerVideo(node);
      for (const v of node.querySelectorAll?.('video') || []) registerVideo(v);
      const article = node.closest?.('article');
      if (article) changedArticles.add(article);
      if (node.matches?.('article')) changedArticles.add(node);
      for (const a of node.querySelectorAll?.('article') || []) changedArticles.add(a);
    }
    mutationCandidates.clear();
    if (now - lastScan > 2500) {
      for (const v of document.querySelectorAll('video')) registerVideo(v);
      lastScan = now;
    }
    cleanDisconnected();
    if (location.href !== currentHref) { currentHref = location.href; inc('route_changes'); log('navigation'); }
    if (now - lastNavUpdate > 600 || !navSettings?.item.isConnected || (settings.savedShortcut && !navSaved?.item.isConnected)) {
      ensureNav(); lastNavUpdate = now;
    }
    if (settings.copyPostLink) for (const a of changedArticles) addCopy(a);
    if (now - lastPostsScan > 2200) { scanPosts(); lastPostsScan = now; }
    pauseOffscreen();
    inc('dom_scans');
  }
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(() => safe('scan', scanAll), 180);
  }
  function watchDOM() {
    observer = new MutationObserver(records => {
      inc('observer_batches');
      let change = false;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1 || node === root || node.closest?.('#igp-root') || node.matches?.('.igp-inline-copy,[data-igp-navigation]')) continue;
          mutationCandidates.add(node); change = true;
        }
        if (record.removedNodes.length) change = true;
      }
      if (mutationCandidates.size > 150) mutationCandidates = new Set([document.body]);
      if (change) scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    if ('IntersectionObserver' in window) {
      intersect = new IntersectionObserver(entries => {
        if (!settings.offscreenPause) return;
        for (const entry of entries) if (!entry.isIntersecting || entry.intersectionRatio < .28) stop(entry.target, 'offscreen');
      }, { threshold: [0, .1, .28, .5] });
    } else log('intersection_unavailable', '', 'warn');
  }
  let scrollQueued = false, pointerQueued = false;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false; pauseOffscreen();
      if (currentVideo) positionBar(currentVideo);
    });
  }
  function onPointerMove(e) {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (pointerQueued || !settings.videoControls || tick() - lastPointerUpdate < 85) return;
    pointerQueued = true;
    requestAnimationFrame(() => { pointerQueued = false; lastPointerUpdate = tick(); locateVideo(); });
  }
  function init() {
    if (!document.body || root) return;
    safe('initialize', () => {
      initializeUI(); watchDOM();
      document.addEventListener('pointerdown', captureUserIntent, true);
      document.addEventListener('keydown', captureUserIntent, true);
      document.addEventListener('click', onNavClick, true);
      document.addEventListener('click', onDocumentClick, true);
      document.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true, capture: true });
      window.addEventListener('resize', onScroll, { passive: true });
      document.addEventListener('visibilitychange', () => { if (document.hidden && settings.offscreenPause) { for (const v of videos) stop(v, 'offscreen'); } });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') togglePanel(false); });
      // Low-frequency failsafe catches media whose React components reset state.
      setInterval(() => {
        if (document.hidden) return;
        for (const v of videos) { enforceAttrs(v); enforcePlayback(v, 'fallback'); }
        if (navSettings && !navSettings.item.isConnected) scheduleScan();
      }, 1400);
      const refresh = () => scheduleScan();
      window.addEventListener('popstate', refresh);
      window.addEventListener('hashchange', refresh);
      scheduleScan();
      log('started', VERSION);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();