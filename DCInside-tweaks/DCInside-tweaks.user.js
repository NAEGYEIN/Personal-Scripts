// ==UserScript==
// @name         DCInside Tweaks
// @namespace    local.dcinside.optimizer
// @version      1.3.3
// @description  디시인사이드 레이아웃 보정 + 클릭 방해 제거 + 이름순 갤러리 즐겨찾기 + 이미지 댓글 숨김
// @homepageURL  https://github.com/NAEGYEIN/Personal-Scripts/tree/main/DCInside-tweaks
// @supportURL   https://github.com/NAEGYEIN/Personal-Scripts/issues
// @updateURL    https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/DCInside-tweaks/DCInside-tweaks.meta.js
// @downloadURL  https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/DCInside-tweaks/DCInside-tweaks.user.js
// @match        https://gall.dcinside.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const STYLE_ID = 'dcinside-optimizer-style';
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = String.raw`
    :root {
      --dc-min-content-width: 360px;
      --dc-main-max-width: 1160px;
      --dc-page-gutter: clamp(12px, 2vw, 28px);
    }

    /* =========================================================
       1. BASE / 전체 폭과 좌우 안전 여백
       ========================================================= */

    html,
    body {
      min-width: var(--dc-min-content-width) !important;
    }

    #top,
    .wrap_inner {
      width: 100% !important;
      max-width: 100% !important;
      min-width: var(--dc-min-content-width) !important;
      box-sizing: border-box !important;
    }

    .list_wrap,
    .view_wrap,
    .gnb_bar,
    .width1160 .gnb_bar {
      min-width: var(--dc-min-content-width) !important;
    }

    /*
      기존의 width:100% + max-width:1160px만 쓰면
      창 폭이 줄었을 때 좌우 끝에 너무 붙는다.
      아래 규칙은 항상 gutter를 남기고 중앙 정렬한다.
    */
    .width1160 .dchead,
    .width1160 .gnb,
    .width1160 #container,
    .width1160 .info_policy,
    .width1160 .copyright,
    .width1160 .visit_bookmark,
    .width1160 .gnb_depth2_list,
    #container {
      width: calc(100% - (var(--dc-page-gutter) * 2)) !important;
      max-width: var(--dc-main-max-width) !important;
      margin-left: auto !important;
      margin-right: auto !important;
      box-sizing: border-box !important;
    }

    .gnb_bar,
    .dcheader,
    .dcfoot {
      width: 100% !important;
      box-sizing: border-box !important;
    }

    /* =========================================================
       2. CLEANUP / 불필요 영역 제거
       ========================================================= */

    /* 타임베스트/추천 영역은 JS/MutationObserver 대신 CSS로 처리 */
    .content_box.r_timebest,
    .content_box.r_dcmedia,
    .content_box.r_recommend {
      display: none !important;
    }

    /* 기존 여백 제거 스크립트의 정리 기능 */
    .dcfoot,
    .gnb_list,
    .ad_bottom_list {
      display: none !important;
    }

    /* =========================================================
       3. MAIN CONTENT / 본문 폭과 이미지 overflow
       ========================================================= */

    .left_content {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }

    .view_content_wrap,
    .view_content_wrap .writing_view_box,
    .view_content_wrap .write_div,
    .view_content_wrap .write_div .imgwrap,
    .view_content_wrap .write_div .ai_wrap {
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }

    .view_content_wrap .writing_view_box img,
    .view_content_wrap .write_div img {
      max-width: 100% !important;
      height: auto !important;
    }

    .listwrap .buttom_search_wrap,
    .view_wrap .buttom_search_wrap {
      margin-bottom: 120px !important;
    }

    /* =========================================================
       4. GALLERY HEADER / 갤러리 상단 영역
       ========================================================= */

    .listwrap .issuebox,
    .list_array_option,
    .trendalign,
    .list_wrap.width1160 .newvisit_history,
    .width1160 .issuebox.open .newvisit_history {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }

    .issuebox.gallery_box {
      min-width: var(--dc-min-content-width) !important;
    }

    .page_head {
      height: auto !important;
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: flex-start !important;
      justify-content: space-between !important;
      gap: 8px 12px !important;
    }

    .page_head .fl,
    .page_head .fr {
      float: none !important;
      min-width: 0 !important;
    }

    .page_head .fl {
      display: flex !important;
      flex: 1 1 220px !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      gap: 4px 8px !important;
    }

    .page_head h2 {
      max-width: 100% !important;
      min-width: 0 !important;
    }

    .gall_issuebox {
      max-width: 100% !important;
      padding-top: 0 !important;
      display: flex !important;
      flex-wrap: wrap !important;
      justify-content: flex-start !important;
    }

    .gall_issuebox .bundle {
      display: inline-flex !important;
      flex-wrap: wrap !important;
    }

    .listwrap .issuebox .concept_wrap {
      display: flex !important;
      flex-wrap: wrap !important;
    }

    .listwrap .concept_txtlist,
    .listwrap .concept_img {
      width: auto !important;
      flex: 1 1 260px !important;
      box-sizing: border-box !important;
    }

    /* =========================================================
       5. RESPONSIVE <= 1040px
       ========================================================= */

    @media (max-width: 1040px) {
      .issue_wrap,
      .issue_contentbox {
        max-width: 100% !important;
        box-sizing: border-box !important;
      }

      .issue_contentbox [class*="_ranking_box"] {
        display: none !important;
      }

      .issue_contentbox [class*="_intro_box"] {
        float: none !important;
        width: 100% !important;
        max-width: 100% !important;
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: flex-start !important;
        gap: 12px !important;
        box-sizing: border-box !important;
      }

      .img_contbox {
        float: none !important;
        flex: 1 1 340px !important;
        width: auto !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-wrap: nowrap !important;
        align-items: flex-start !important;
      }

      .mintro_txtbox {
        float: none !important;
        flex: 1 1 auto !important;
        width: auto !important;
        max-width: calc(100% - 168px) !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }

      .info_contbox,
      .minor_view .info_contbox {
        float: none !important;
        flex: 1 1 280px !important;
        width: auto !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: 104px !important;
        margin: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }

      .info_cont {
        display: flex !important;
        align-items: flex-start !important;
        overflow: hidden !important;
        max-width: 100% !important;
      }

      .info_cont + .info_cont {
        margin-top: 8px !important;
      }

      .info_cont .tit {
        float: none !important;
        flex: 0 0 73px !important;
        width: 73px !important;
        max-width: 73px !important;
        box-sizing: border-box !important;
      }

      .info_cont .cont {
        float: none !important;
        flex: 1 1 auto !important;
        width: auto !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }

      .info_cont .cont,
      .mintro_txt,
      .mng_nick,
      .btn_mngadmin_report {
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }

      .btn_mngadmin_report {
        white-space: normal !important;
        text-align: left !important;
      }

      /* 댓글 영역 */
      .view_comment .comment_count {
        height: auto !important;
        min-height: 38px !important;
        line-height: 1.4 !important;
      }

      .view_comment .comment_count .num_box,
      .view_comment .comment_count > .fr {
        float: none !important;
        width: 100% !important;
      }

      .view_comment .comment_count > .fr {
        margin-top: 6px !important;
        text-align: right !important;
      }

      .view_comment .comment_sort {
        display: inline-flex !important;
        flex-wrap: wrap !important;
        row-gap: 6px !important;
        vertical-align: top !important;
      }

      .view_comment .comment_sort .radiobox.imgcheck {
        margin-left: 0 !important;
        margin-right: 10px !important;
      }

      .view_comment .cmt_txtbox,
      .view_comment .cmt_txt_cont {
        float: none !important;
        width: auto !important;
        min-width: 0 !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      .view_comment .usertxt,
      .view_comment .comment_dccon,
      .view_comment .reply_info .usertxt,
      .view_comment .reply_info .comment_dccon,
      .view_comment .del_reply,
      .view_comment .trend_box + .cmt_txtbox {
        width: auto !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }

      .view_comment .cmt_txt_cont textarea {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }

      .view_comment .comment_box .trend_box {
        max-width: calc(100% - 177px) !important;
        box-sizing: border-box !important;
      }
    }

    /* =========================================================
       6. RESPONSIVE <= 900px
       ========================================================= */

    @media (max-width: 900px) {
      .gall_issuebox {
        width: 100% !important;
      }

      .right_content,
      .right_content .power_link {
        float: none !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
    }

    /* =========================================================
       7. RESPONSIVE <= 860px / 헤더·검색창
       ========================================================= */

    @media (max-width: 860px) {
      :root {
        --dc-page-gutter: 12px;
      }

      .dchead {
        height: auto !important;
        padding: 20px 0 12px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        box-sizing: border-box !important;
      }

      .dc_logo,
      .wrap_search,
      .typea .wrap_search,
      .area_links,
      .dcheader.bg .area_links {
        position: static !important;
        left: auto !important;
        right: auto !important;
        top: auto !important;
        margin: 0 !important;
      }

      .dc_logo {
        width: auto !important;
        text-align: center !important;
      }

      .dc_logo a {
        float: none !important;
        display: inline-block !important;
      }

      .wrap_search,
      .typea .wrap_search {
        width: 100% !important;
        max-width: 364px !important;
      }

      .top_search,
      .typea .top_search {
        width: 100% !important;
      }

      .inner_search,
      .typea .inner_search {
        width: calc(100% - 49px) !important;
        box-sizing: border-box !important;
      }

      .in_keyword,
      .typea .in_keyword {
        width: 100% !important;
        box-sizing: border-box !important;
      }

      .area_links {
        width: 100% !important;
        margin-top: 10px !important;
        text-align: center !important;
      }

      .area_links ul.fl.clear {
        float: none !important;
        display: inline-flex !important;
        flex-wrap: wrap !important;
        justify-content: center !important;
      }

      .area_links li {
        float: none !important;
      }
    }

    /* =========================================================
       8. RESPONSIVE <= 720px / 목록 번호열 제거
       ========================================================= */

    @media (max-width: 720px) {
      :root {
        --dc-page-gutter: 10px;
      }

      .gall_list colgroup col:first-child {
        width: 0 !important;
        display: none !important;
      }

      .gall_list thead th:first-child,
      .gall_list tbody td.gall_num {
        display: none !important;
      }
    }

    /* =========================================================
       9. RESPONSIVE <= 640px
       ========================================================= */

    @media (max-width: 640px) {
      :root {
        --dc-page-gutter: 8px;
      }

      .listwrap .concept_txtlist,
      .listwrap .concept_img {
        flex-basis: 100% !important;
      }

      .gall_issuebox {
        gap: 6px 0 !important;
      }
    }

    /* =========================================================
       10. USABILITY / 클릭 방해·이미지 댓글·즐겨찾기
       ========================================================= */

    /* 목록 위를 투명하게 덮는 좌/우 광고 래퍼가 게시물 클릭을 가로채지 못하게 한다. */
    .stickyunit[data-ad-audit^="LIST_AD_"] {
      display: none !important;
      pointer-events: none !important;
    }

    /* 이미지 댓글(디시콘 포함)만 숨긴다. 텍스트 댓글은 유지한다. */
    .view_comment .comment_dccon,
    .view_comment .coment_dccon_img,
    .view_comment .written_dccon,
    .comment_wrap .comment_dccon,
    .comment_wrap .coment_dccon_img,
    .comment_wrap .written_dccon {
      display: none !important;
    }

    /* 갤러리 즐겨찾기 UI */
    .dcopt-favorites {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin: 0 0 10px;
      padding: 7px 9px;
      border: 1px solid #d7d7d7;
      background: #fafafa;
      box-sizing: border-box;
      font-size: 12px;
      line-height: 1.4;
    }

    .dcopt-favorites button,
    .dcopt-favorites a {
      font: inherit;
    }

    .dcopt-fav-toggle {
      flex: 0 0 auto;
      padding: 3px 7px;
      border: 1px solid #b8b8b8;
      background: #fff;
      cursor: pointer;
    }

    .dcopt-fav-list {
      display: flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
      min-width: 0;
    }

    .dcopt-fav-item {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      max-width: 220px;
      padding: 2px 5px;
      border-radius: 3px;
      background: #eee;
    }

    .dcopt-fav-item > a {
      overflow: hidden;
      color: #333 !important;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-decoration: none !important;
    }

    .dcopt-fav-remove {
      border: 0;
      background: transparent;
      color: #777;
      cursor: pointer;
      padding: 0 2px;
    }

    .dcopt-fav-empty {
      color: #888;
    }


  `;

  const mountStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const parent = document.head || document.documentElement;
    if (parent) parent.appendChild(style);
  };

  mountStyle();

  if (!style.isConnected) {
    document.addEventListener('readystatechange', mountStyle, { once: true });
  }

  /* =========================================================
     11. USABILITY JS / 즐겨찾기
     ========================================================= */

  const FAVORITES_KEY = 'dcinside.optimizer.favorites.v1';
  const MAX_FAVORITES = 30;

  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  const safeParseJSON = (raw, fallback) => {
    try {
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  };

  const FAVORITES_COLLATOR = new Intl.Collator('ko-KR', {
    numeric: true,
    sensitivity: 'base',
  });

  const sortFavorites = (items) => [...items].sort((a, b) => {
    const aName = String(a?.name || a?.id || '');
    const bName = String(b?.name || b?.id || '');
    return FAVORITES_COLLATOR.compare(aName, bName);
  });

  const loadFavorites = () => {
    const data = safeParseJSON(localStorage.getItem(FAVORITES_KEY), []);
    const items = Array.isArray(data) ? data.filter((item) => item && item.id && item.url) : [];
    return sortFavorites(items);
  };

  const saveFavorites = (items) => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(sortFavorites(items).slice(0, MAX_FAVORITES)));
  };

  const getGalleryInfo = () => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (!id) return null;

    let section = 'board';
    let listPath = '/board/lists/';
    if (location.pathname.startsWith('/mgallery/')) {
      section = 'mgallery';
      listPath = '/mgallery/board/lists/';
    } else if (location.pathname.startsWith('/mini/')) {
      section = 'mini';
      listPath = '/mini/board/lists/';
    }

    const rawName =
      document.querySelector('.page_head h2')?.textContent ||
      document.querySelector('.gall_tit')?.textContent ||
      document.title ||
      id;

    const name = rawName
      .replace(/\s+/g, ' ')
      .replace(/\s*[-|–]\s*디시인사이드.*$/i, '')
      .trim() || id;

    return {
      key: `${section}:${id}`,
      id,
      section,
      name,
      url: `${location.origin}${listPath}?id=${encodeURIComponent(id)}`,
    };
  };

  const mountFavorites = () => {
    if (document.getElementById('dcopt-favorites')) return;

    const gallery = getGalleryInfo();
    if (!gallery) return;

    const anchor =
      document.querySelector('.page_head') ||
      document.querySelector('.gall_listwrap') ||
      document.querySelector('.view_wrap .left_content');
    if (!anchor || !anchor.parentNode) return;

    const box = document.createElement('div');
    box.id = 'dcopt-favorites';
    box.className = 'dcopt-favorites';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dcopt-fav-toggle';

    const list = document.createElement('div');
    list.className = 'dcopt-fav-list';

    const render = () => {
      const favorites = loadFavorites();
      const isSaved = favorites.some((item) => item.key === gallery.key);
      toggle.textContent = isSaved ? '★ 저장됨' : '☆ 갤러리 저장';
      toggle.title = isSaved ? '현재 갤러리를 저장 목록에서 제거' : '현재 갤러리를 저장';

      list.replaceChildren();
      if (!favorites.length) {
        const empty = document.createElement('span');
        empty.className = 'dcopt-fav-empty';
        empty.textContent = '저장한 갤러리 없음';
        list.appendChild(empty);
        return;
      }

      favorites.forEach((item) => {
        const wrap = document.createElement('span');
        wrap.className = 'dcopt-fav-item';

        const link = document.createElement('a');
        link.href = item.url;
        link.textContent = item.name || item.id;
        link.title = item.name || item.id;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'dcopt-fav-remove';
        remove.textContent = '×';
        remove.title = '저장 목록에서 제거';
        remove.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          saveFavorites(loadFavorites().filter((fav) => fav.key !== item.key));
          render();
        });

        wrap.append(link, remove);
        list.appendChild(wrap);
      });
    };

    toggle.addEventListener('click', () => {
      const favorites = loadFavorites();
      const index = favorites.findIndex((item) => item.key === gallery.key);
      if (index >= 0) {
        favorites.splice(index, 1);
      } else {
        favorites.unshift(gallery);
      }
      saveFavorites(favorites);
      render();
    });

    box.append(toggle, list);
    anchor.parentNode.insertBefore(box, anchor);
    render();
  };


  onReady(() => {
    mountFavorites();
  });

})();