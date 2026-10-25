# ChatGPT Tweaks

개인용 ChatGPT 웹 UI 개선 Tampermonkey userscript.

## 기능

- 대화 영역 최대 폭 조절
- 사용자 말풍선 최대 폭 조절
- 새 채팅 버튼의 표준 링크 동작 보완
- 사이드바·탐색 메뉴의 새 탭 열기 보완
- ChatGPT DOM 변경 대응용 진단 기능

## 설치

Tampermonkey가 설치된 브라우저에서 아래 userscript를 한 번 설치한다.

`https://raw.githubusercontent.com/NAEGYEIN/chatgpt-tweaks/main/chatgpt-tweaks.user.js`

기존 `ChatGPT 개선 스크립트`를 사용 중이라면 `@name`과 `@namespace`가 동일하므로 정상적으로 교체 설치할 수 있다. 기존 설정 저장 키도 유지한다.

## 자동 업데이트

이 저장소는 Tampermonkey의 네이티브 업데이트 기능을 사용한다.

- 버전 확인: `chatgpt-tweaks.meta.js`
- 실제 업데이트 파일: `chatgpt-tweaks.user.js`
- 업데이트 때마다 `@version`을 증가시킨다.

Tampermonkey 5.6 계열부터 업데이트 **확인**과 **자동 설치** 설정이 분리되어 있으므로, 자동 적용을 원하면 Tampermonkey의 스크립트 업데이트 설정에서 자동 설치가 허용되어 있어야 한다.

## 설정 유지

업데이트 시 다음 저장 키를 유지한다.

- `cgpui.settings.v1`
- `cgpui.bindings.v1`

따라서 정상적인 인플레이스 업데이트에서는 기존 화면 폭·버튼 지정 설정을 그대로 사용한다.

## 한/영 키

현재 스크립트는 `HangulMode`를 처리하거나 차단하지 않는다. 키보드 이벤트 처리는 설정창·직접 지정 모드의 `Escape` 처리에 한정된다.

## 라이선스

별도 오픈소스 라이선스를 부여하지 않았다.
