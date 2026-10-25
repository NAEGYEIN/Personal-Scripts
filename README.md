# ChatGPT Tweaks

개인용 ChatGPT 웹 UI 개선 Tampermonkey userscript.

## 현재 기준본

- 최신 배포: **v0.16.2**
- 기능 기준본: **v0.16.0 (2026-10-21)**
- v0.16.1은 v0.16.0의 기능 코드를 유지하고 GitHub/Tampermonkey 자동 업데이트 메타데이터만 추가한 배포 버전이다.

v0.16.2는 자동 업데이트 검증용 배포이며, v0.16.1과 기능 코드는 동일하다. 버전 표시만 증가했으며 기존 기능·설정 키·자동 업데이트 URL은 유지한다.

## 주요 기능

- 대화 영역 최대 폭 조절
- 사용자 말풍선 최대 폭 조절
- 안전 상태 머신 기반 모델 고정 (`GPT-6`, `GPT-5.6 Sol`)
- 새 채팅 표준 링크 동작 보완
- 사이드바·탐색 메뉴 새 탭 열기 보완
- 설정 백업/복원 및 DOM 진단

## 설치

Tampermonkey가 설치된 브라우저에서 아래 userscript를 한 번 설치한다.

`https://raw.githubusercontent.com/NAEGYEIN/chatgpt-tweaks/main/chatgpt-tweaks.user.js`

기존 `ChatGPT 개선 스크립트`는 `@name`과 `@namespace`를 유지하므로 동일 스크립트의 업데이트로 처리된다.

## 자동 업데이트

- 버전 확인: `chatgpt-tweaks.meta.js`
- 실제 설치/업데이트 파일: `chatgpt-tweaks.user.js`
- 새 배포마다 `@version`을 증가시킨다.

현재 메타데이터:

- `@updateURL https://raw.githubusercontent.com/NAEGYEIN/chatgpt-tweaks/main/chatgpt-tweaks.meta.js`
- `@downloadURL https://raw.githubusercontent.com/NAEGYEIN/chatgpt-tweaks/main/chatgpt-tweaks.user.js`

## 설정 유지

다음 저장 키를 계속 사용한다.

- `cgpui.settings.v1`
- `cgpui.bindings.v1`

따라서 정상적인 인플레이스 업데이트에서는 기존 화면 폭, 모델 고정, 직접 지정 설정을 유지한다.

## 키보드 / 한·영

모델 고정 컨트롤러는 키보드 이벤트를 합성하지 않는다. 설정창·직접 지정 모드의 `Escape` 처리 외 한/영(`HangulMode`)을 가로채는 기능은 없다.

## 라이선스

별도 오픈소스 라이선스를 부여하지 않았다.
