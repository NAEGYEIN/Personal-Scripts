# Changelog

## 0.18.3 — 2026-10-27

- Tampermonkey 공식 문서 기준 Chromium MV3 기본 Content Script 방식은 진짜 `document-start`를 보장하지 않을 수 있음을 반영.
- `@sandbox raw`를 명시해 가능한 경우 userscript를 ChatGPT 페이지의 MAIN_WORLD에서 실행하도록 강제.
- clipboard paste listener는 sandbox/unsafeWindow 브리지 대신 실제 `window`에 직접 등록.
- clipboard 기능에서 `currentSurface`/Work 상태 판정을 제거. `https://chatgpt.com/*` 안에서 실제 ChatGPT composer와 file input이 존재하는 경우만 동작.
- v0.18.2에서 채택한 MIT 구현의 composedPath composer 탐지와 direct file-input 주입 패턴은 유지.
## 0.18.2 — 2026-10-27

- v0.18.0/0.18.1의 자체 paste/composer/file-input 탐지 구현을 폐기하고 공개 MIT 구현을 기준으로 재작성.
- `@grant unsafeWindow`를 추가하고 `Soluna-Angelito/chatgpt-conversation-exporter`와 동일하게 실제 page window에 capture-phase paste listener를 document-start에서 즉시 등록.
- composer 탐지를 해당 프로젝트의 `composedPath()` + `#prompt-textarea.ProseMirror` 패턴으로 교체.
- 업로드는 `skranz/chatgpt_clipboard`의 검증 패턴을 따라 `#upload-files` 또는 `form[data-type="unified-composer"] input[type="file"]`에 `DataTransfer.files`를 직접 주입하고 `input`/`change` 이벤트를 발생.
- ZIP 생성 바이트 로직은 유지하되 `File`/`Blob`/`DataTransfer`/`Event`를 page realm 생성자로 사용.
- 일반 문자열 텍스트 붙여넣기, Work, `chatgpt.com` 외 사이트에는 개입하지 않음.
- 외부 구현 저작권·MIT 고지를 `THIRD-PARTY.md`에 추가.
## 0.18.1 — 2026-10-27

- 이미지 붙여넣기가 ChatGPT 기본 처리로 그대로 통과한 v0.18.0 실기 FAIL 반영.
- paste 리스너를 DOMContentLoaded 이후 document capture에서 document-start의 window capture로 이동해 ChatGPT 기본 붙여넣기 처리보다 먼저 가로채도록 변경.
- event target이 composer로 직접 잡히지 않는 경우 activeElement, 현재 selection, 단일 visible composer 순서로 실제 입력창을 복구 탐지.
- currentSurface가 일시적으로 unknown이어도 정상 Chat route의 composer 붙여넣기는 처리하고, 명시적 Work surface/route만 차단.
- 일반 텍스트 붙여넣기와 다른 사이트 비개입 원칙 유지.

## 0.18.0 — 2026-10-27

- Chat 입력창의 붙여넣기 이벤트에서 클립보드 이미지·파일을 감지해 디스크 저장 없이 메모리에서 ZIP으로 포장.
- Windows 캡처 이미지, 브라우저 이미지 복사, 탐색기에서 복사한 단일·복수 파일을 동일한 ZIP 첨부 경로로 처리.
- 일반 텍스트 복사는 기존 붙여넣기를 유지하고, 실제 `.txt` 파일 복사는 다른 파일과 동일하게 ZIP 처리.
- `https://chatgpt.com/*` 및 Chat 모드 입력창에서만 활성화하고 Work 및 다른 입력 요소에는 개입하지 않음.
- 외부 ZIP 라이브러리 없이 STORE 방식 ZIP writer를 내장해 원본 파일 바이트를 변경하지 않음.
- ChatGPT 첨부용 `input[type=file]`을 우선 사용하고, 입력을 찾지 못한 경우 composer drop 이벤트를 fallback으로 사용.
- 500MB 초과 클립보드 파일 묶음은 변환하지 않고 원래 붙여넣기를 유지.
- 기존 설정 키, 모델 고정, 링크 overlay, 자동 업데이트 경로 유지.

## 0.17.0 — 2026-10-27

- ChatGPT **Chat 모드 전용**으로 동작 범위를 제한하고 Work에서는 대화 폭 CSS, 모델 고정, 새 채팅·메뉴·프로젝트 링크 overlay를 해제.
- Chat/Work 전환 컨트롤, 라우트, DOM 지연 마운트를 함께 판별하도록 surface lifecycle 추가.
- 프로젝트 우측 **대화 시작** 아이콘을 프로젝트 canonical URL과 연결해 휠 클릭·Ctrl+클릭·우클릭 새 탭을 지원.
- 프로젝트 생성·삭제·재정렬 시 현재 DOM을 재탐지하고 끊어진 target/overlay를 자동 정리.
- 기존 `cgpui.settings.v1`, `cgpui.bindings.v1`, 모델 입력/IME 보호, 자동 업데이트 경로 유지.
- 네비게이션·surface 관련 mutation만 재검사하고 대화 스트리밍 DOM은 계속 제외.
- 사용되지 않던 일부 DOM helper 인자 전달을 정리.

## 0.16.4 — 2026-10-26

- 세 userscript 자동 업데이트 교차검증을 위한 패치 버전 상승.
- ChatGPT Tweaks 기능 코드는 v0.16.3과 동일.

## 0.16.3 — 2026-10-26

- 저장소 이름을 `NAEGYEIN/Personal-Scripts` 기준으로 갱신.
- canonical userscript/meta 경로를 `chatgpt-tweaks/` 하위로 이전.
- 기존 루트 자동 업데이트 경로에서 v0.16.3을 감지할 수 있도록 호환 파일 유지.
- 기능 코드·설정 키는 v0.16.2와 동일.

## 0.16.2 — 2026-10-25

- 자동 업데이트 검증용 배포.
- userscript와 meta의 `@version`, 내부 `VERSION`만 `0.16.2`로 증가.
- v0.16.1의 기능 코드·설정 키·자동 업데이트 URL 유지.

## 0.16.1 — 2026-10-25

- **v0.16.0을 최신 기능 기준본으로 복구.**
- v0.16.0 기능 본문 유지.
- GitHub/Tampermonkey 자동 업데이트 구조 추가.
- `@homepageURL`, `@supportURL`, `@updateURL`, `@downloadURL` 추가.
- `@version` 및 내부 표시 버전만 `0.16.1`로 증가.
- 기존 `@name`, `@namespace`, 설정 저장 키 유지.

## 0.16.0 — 2026-10-21

- 안전 상태 머신 기반 모델 고정 구조 재설계.
- 현재 모델 우선 판독 및 목표 모델 일치 시 0-click 종료.
- 모델 선택기와 추론 수준 전용 컨트롤 분리.
- 2단계 모델 UI 대응.
- 사용자 소유 팝업 미조작.
- `/` → `/c/<id>` first-send route promotion 보호.
- `focus` 자동 재적용 제거.
- read-only 안정화 검증 및 retry 분리.
- 진단 로그 강화.
- 입력/IME 보호 유지.
- 원본 패키지 자동 검증 66개 PASS.
