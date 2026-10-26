# ChatGPT Tweaks

개인용 ChatGPT 웹 UI 개선 Tampermonkey userscript.

## 현재 기준본

- 최신 배포: **v0.18.1**
- 기능 기준본: **v0.18.1 (2026-10-27)**
- v0.18.1은 붙여넣기 가로채기를 document-start의 window capture로 앞당기고 event target·active element·selection 기반 composer 탐지를 추가한다.
- v0.18.0은 Chat 입력창에서 붙여넣은 이미지·파일을 메모리 ZIP으로 묶어 첨부하는 실험 기능을 추가한다. 일반 텍스트 붙여넣기는 그대로 유지한다.
- v0.17.0은 Chat/Work 모드 분리, 프로젝트 우측 대화 시작 링크 보완, 동적 프로젝트 정리와 DOM 감시 최적화를 포함한다.
- v0.16.4는 자동 업데이트 테스트용 패치 버전이며 기능 코드는 v0.16.3과 동일하다.
- v0.16.3은 저장소를 `NAEGYEIN/Personal-Scripts`로 변경한 뒤 canonical 배포 경로를 `chatgpt-tweaks/`로 이전한 마이그레이션 배포다.

## 주요 기능

- **Chat 모드에서만** 동작하고 Work에서는 UI·모델 고정·링크 overlay를 비활성화
- 대화 영역 최대 폭 조절
- 사용자 말풍선 최대 폭 조절
- 안전 상태 머신 기반 모델 고정 (`GPT-6`, `GPT-5.6 Sol`)
- 새 채팅 표준 링크 동작 보완
- 프로젝트 우측 **대화 시작** 아이콘의 휠 클릭·Ctrl+클릭·우클릭 새 탭 보완
- 프로젝트 생성·삭제·재정렬 시 동적 재탐지 및 끊어진 overlay 자동 정리
- 사이드바·탐색 메뉴 새 탭 열기 보완
- 설정 백업/복원 및 DOM 진단
- Chat 입력창에서 클립보드 이미지·복사 파일을 디스크 저장 없이 ZIP으로 묶어 첨부 (`https://chatgpt.com/*` 한정, Work 비활성)

## 설치

canonical userscript:

`https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/chatgpt-tweaks/chatgpt-tweaks.user.js`

## 자동 업데이트

- `@updateURL https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/chatgpt-tweaks/chatgpt-tweaks.meta.js`
- `@downloadURL https://raw.githubusercontent.com/NAEGYEIN/Personal-Scripts/main/chatgpt-tweaks/chatgpt-tweaks.user.js`

기존 루트 호환 파일은 canonical 경로 이전과 자동 업데이트 교차검증 완료 후 제거되었다. 현재 배포 기준은 위 `chatgpt-tweaks/` canonical 경로뿐이다.

## 설정 유지

다음 저장 키를 계속 사용한다.

- `cgpui.settings.v1`
- `cgpui.bindings.v1`

정상적인 인플레이스 업데이트에서는 기존 화면 폭, 모델 고정, 직접 지정 설정을 유지한다.

## 키보드 / 한·영

모델 고정 컨트롤러는 키보드 이벤트를 합성하지 않는다. 설정창·직접 지정 모드의 `Escape` 처리 외 한/영(`HangulMode`)을 가로채는 기능은 없다.

## 라이선스

별도 오픈소스 라이선스를 부여하지 않았다.
