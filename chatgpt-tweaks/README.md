# ChatGPT Tweaks

개인용 ChatGPT 웹 UI 개선 Tampermonkey userscript.

## 현재 기준본

- 최신 배포: **v0.16.2**
- 기능 기준본: **v0.16.0 (2026-10-21)**
- v0.16.1은 v0.16.0의 기능 코드를 유지하고 GitHub/Tampermonkey 자동 업데이트 메타데이터만 추가한 배포 버전이다.
- v0.16.2는 자동 업데이트 검증용 배포이며 v0.16.1과 기능 코드는 동일하다.

## 주요 기능

- 대화 영역 최대 폭 조절
- 사용자 말풍선 최대 폭 조절
- 안전 상태 머신 기반 모델 고정 (`GPT-6`, `GPT-5.6 Sol`)
- 새 채팅 표준 링크 동작 보완
- 사이드바·탐색 메뉴 새 탭 열기 보완
- 설정 백업/복원 및 DOM 진단

## 설치

현재 canonical 소스 경로:

`chatgpt-tweaks/chatgpt-tweaks.user.js`

저장소 구조 이전 중에는 기존 설치의 자동 업데이트를 보호하기 위해 루트의 `chatgpt-tweaks.user.js` / `chatgpt-tweaks.meta.js` 호환 파일도 유지한다.

## 자동 업데이트

현재 v0.16.2 설치본은 기존 루트 경로의 `@updateURL` / `@downloadURL`을 사용한다. 저장소 이름을 `scripts`로 변경한 뒤 별도 마이그레이션 버전에서 새 canonical 경로로 전환한다.

## 설정 유지

다음 저장 키를 계속 사용한다.

- `cgpui.settings.v1`
- `cgpui.bindings.v1`

정상적인 인플레이스 업데이트에서는 기존 화면 폭, 모델 고정, 직접 지정 설정을 유지한다.

## 키보드 / 한·영

모델 고정 컨트롤러는 키보드 이벤트를 합성하지 않는다. 설정창·직접 지정 모드의 `Escape` 처리 외 한/영(`HangulMode`)을 가로채는 기능은 없다.

## 라이선스

별도 오픈소스 라이선스를 부여하지 않았다.
