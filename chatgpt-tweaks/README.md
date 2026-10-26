# ChatGPT Tweaks

개인용 ChatGPT 웹 UI 개선 Tampermonkey userscript.

## 현재 기준본

- 최신 배포: **v0.16.4**
- 기능 기준본: **v0.16.0 (2026-10-21)**
- v0.16.1은 v0.16.0 기능을 유지하고 GitHub/Tampermonkey 자동 업데이트 메타데이터를 추가했다.
- v0.16.2는 자동 업데이트 검증용 배포다.
- v0.16.4는 자동 업데이트 테스트용 패치 버전이며 기능 코드는 v0.16.3과 동일하다.
- v0.16.3은 저장소를 `NAEGYEIN/Personal-Scripts`로 변경한 뒤 canonical 배포 경로를 `chatgpt-tweaks/`로 이전하는 마이그레이션 배포다. 기능 동작은 v0.16.2와 동일하다.

## 주요 기능

- 대화 영역 최대 폭 조절
- 사용자 말풍선 최대 폭 조절
- 안전 상태 머신 기반 모델 고정 (`GPT-6`, `GPT-5.6 Sol`)
- 새 채팅 표준 링크 동작 보완
- 사이드바·탐색 메뉴 새 탭 열기 보완
- 설정 백업/복원 및 DOM 진단

## 설치

canonical userscript:

`https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/chatgpt-tweaks/chatgpt-tweaks.user.js`

## 자동 업데이트

- `@updateURL https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/chatgpt-tweaks/chatgpt-tweaks.meta.js`
- `@downloadURL https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/chatgpt-tweaks/chatgpt-tweaks.user.js`

루트의 호환 파일은 기존 v0.16.2 이하 설치가 v0.16.3을 감지해 canonical 경로로 이동하도록 당분간 유지한다.

## 설정 유지

다음 저장 키를 계속 사용한다.

- `cgpui.settings.v1`
- `cgpui.bindings.v1`

정상적인 인플레이스 업데이트에서는 기존 화면 폭, 모델 고정, 직접 지정 설정을 유지한다.

## 키보드 / 한·영

모델 고정 컨트롤러는 키보드 이벤트를 합성하지 않는다. 설정창·직접 지정 모드의 `Escape` 처리 외 한/영(`HangulMode`)을 가로채는 기능은 없다.

## 라이선스

별도 오픈소스 라이선스를 부여하지 않았다.
