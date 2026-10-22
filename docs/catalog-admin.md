# 무료 요금제에서 뽑기 운영

Firebase Spark 요금제를 유지합니다. Cloud Functions와 Cloud Storage는 사용하지 않습니다.

- 기존 PNG 이미지는 Firebase Hosting의 `/gacha-assets/<content-hash>.png`에서 제공합니다. 앱 번들에는 이미지 대신 URL만 포함하며 Expo Image가 표시할 때 내려받아 캐시합니다.
- 관리자 업로드는 투명도를 유지한 PNG로 축소해 Firestore `gachaImages`에 저장합니다. 이미지당 base64 350,000자 이하이며 기존 이미지는 덮어쓰지 않습니다. 앱은 보이는 이미지부터 불러오고 기기 캐시를 재사용합니다.
- `gachaCatalog/live`에는 현재 가격·확률·동물 정보가 있습니다. 관리자 게시 시 전체 버전, 서버 검증용 뽑기 풀·가격·등급 정보, 변경 이력을 한 트랜잭션으로 저장합니다. 다른 관리자가 먼저 게시한 초안은 거부합니다.
- 추첨 난수는 기존처럼 앱에서 생성합니다. Firestore 규칙은 게시된 비용·허용 동물·보유량·뽑기권·업적 보상의 유효성을 검증합니다. 무료 구성에서 서버가 비밀 난수를 생성하는 기능은 제공하지 않습니다.
- 확률 합계 100%, 양수 비용, 중복 없는 ID, 유효한 이미지, 비어 있지 않은 풀을 검사합니다. 기존 컬렉션의 등급 변경·삭제와 동물 ID 삭제는 막습니다. 판매 종료는 스위치를 끕니다.

## 접속

관리자 계정으로 로그인한 뒤 **마이페이지 → 설정 → 뽑기 관리자 페이지**를 엽니다. 웹에서는 `/admin`으로 접속할 수 있습니다. 일반 이용자는 관리자 화면에서 거부되고 서버 규칙으로도 쓰기가 차단됩니다. 비밀번호는 앱 코드·스크립트·설정에 저장하지 않습니다.

동물 관리 그룹 선택 → 이름·소개·가격·등급별 확률 수정 → 동물 선택·추가 및 이미지 올리기 → 변경 내용 검토 → 게시 순서입니다. 게시되지 않은 변경은 이용자에게 반영되지 않습니다. 새 동물 그룹은 뽑기 풀에 포함하며, 진화 전용 그룹은 뽑기에서 제외합니다.

동물 종·다섯 등급 뽑기 개편의 기본 확률과 기존 서비스 전환 순서는 [개편 안내](species-redesign.md)를 참고하세요. 기존 원격 카탈로그는 관리자 화면에서 **동물·등급 개편 초안 적용** 후 검토·게시해야 전환됩니다.

## 개발 및 초기 배포

1. `node scripts/prepare-remote-gacha.cjs`
2. `node scripts/generate-gacha.js`
3. `npx expo export --platform web --output-dir web-build`
4. `npx firebase-tools deploy --only hosting,firestore:rules`
5. 처음 한 번 `node scripts/publish-initial-catalog.cjs`. 기존 live 문서가 있으면 덮어쓰지 않습니다.
6. 관리자 추가: `node scripts/setup-gacha-admin.cjs <로그인아이디>` (기존 Firebase CLI 프로젝트 관리자 권한 필요)

`public/gacha-assets`는 원본에서 재생성하므로 Git에서 제외합니다. PNG 내용이 달라지면 새 URL을 사용하므로 이전 캐시와 충돌하지 않습니다. 코드 생성기는 기존 서버 규칙의 초기 설정을 만들며 이미 게시된 원격 편집을 덮어쓰지 않습니다.

Spark의 일일 읽기·쓰기 및 Hosting 전송량 한도는 그대로 적용됩니다. 별도의 유료 서비스를 활성화하지 않습니다.

## 목록

프로필의 동물 6종·훈장 6개 미리보기는 유지합니다. 더보기는 별도 FlatList 모달로 열고 24개씩 확장합니다. 보관함·친구·알림·대표 동물·도감·랭킹은 가상 목록을 사용합니다. 프로필의 보유 수량과 친구 상태는 기존 동기화 데이터를 사용하므로 목록 확장은 추가 서버 읽기를 발생시키지 않습니다. 뽑기 기록은 Firestore `startAfter` 커서로 24건씩 실제 조회하며 추가 요청 중복·화면 전환 후 늦은 응답을 무시합니다. 랭킹과 친구의 전역 집계·지도 공유를 위한 기존 동기화는 유지합니다.

공식 문서: [Expo Image SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/image/), [FlatList](https://reactnative.dev/docs/flatlist), [Firestore 커서](https://firebase.google.com/docs/firestore/query-data/query-cursors).
