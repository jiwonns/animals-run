# 친구와 알림

- 홈 바로가기와 마이페이지의 친구 메뉴에서 친구 / 받은 신청 / 보낸 신청을 확인.
- 다른 플레이어의 프로필에서 친구 신청. 받은 쪽만 수락 가능. 신청 취소·거절·친구 삭제 지원.
- 홈 우측 상단 벨에 읽지 않은 신청/수락 알림이 있으면 빨간 점. 알림 클릭 시 읽음 처리 후 상대 프로필 이동. 모두 읽음 지원.
- 알림은 앱 내 실시간 알림이며 OS 푸시 알림을 전송하지 않음.
- 친구와 보류 중인 신청은 계정 쌍별 `friendships/{sortedUidPair}` 문서 하나. 반대 방향의 중복 신청과 자기 자신 신청을 차단.
- 요청과 수락 알림의 읽음 상태는 관계 문서의 `requestReadAt` / `acceptedReadAt`으로 저장. 취소·거절·친구 삭제 시 해당 관계의 알림도 함께 사라짐.
- 표시 이름/대표 동물은 신청·수락 시점의 스냅샷. 실제 프로필은 최신 공개 랭킹 문서를 읽음.

## 위치 공유

지도에서 내 위치 공유/숨김 아래에 친구에게만 공유 스위치. 숨김 상태에서도 친구 전용 설정을 유지하며, 다시 공유할 때 적용.

`mapPreferences/{uid}`에 `sharing`과 `audience: public | friends`를 계정별로 저장. 설정을 바꿀 때 기존 위치를 같은 배치에서 삭제. 이전 설정으로 날아온 위치 쓰기는 서버에서 거절. 친구 전용 위치는 현재 수락된 친구와 본인만 직접 읽을 수 있음. 공개 지도 쿼리는 `audience == public`으로 제한하고, 친구의 위치는 친구 관계에 따라 직접 구독. 삭제된 친구는 지도 상태에서도 즉시 제외.

기존 기기에서 사용하던 위치 숨김 선택은 최초 접속 시 이전. 구버전 앱의 공개 위치 쓰기는 공개/공유 상태에서만 허용. 구버전의 무제한 위치 목록 쿼리는 보안 규칙상 허용하지 않으므로 앱을 새로 로드해야 함.

규칙 원본 `scripts/friends.rules`와 생성기의 위치 규칙을 수정한 후 `node scripts/generate-gacha.js` 실행. 계정 탈퇴 시 관계와 위치 설정을 정리.

## 검증

```sh
npx expo lint
npx tsc --noEmit
node scripts/test-profile-display.cjs
npx firebase-tools emulators:exec --project demo-animalsrun --config firebase.community-test.json --only auth,firestore "node scripts/test-friends-rules.cjs"
```

세 계정으로 중복/자기 신청 차단, 수신자만 수락, 읽음 상태, 취소/거절/친구 삭제, 친구가 아닌 계정의 위치 직접 조회와 무제한 목록 조회 차단, 위치 설정 변경 시 삭제/늦은 쓰기 차단을 검사.
