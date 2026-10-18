<p align="center">
  <img src="assets/images/icon.png" width="120" alt="Animals Run" />
</p>

<h1 align="center">Animals Run 베타 테스트</h1>

<p align="center">
  걸으면 코인이 쌓이고, 코인으로 동물 친구를 뽑는 게임이에요.<br />
  테스트 도와줘서 고마워요!
</p>

<p align="center">
  <a href="https://github.com/jiwonns/animals-run/releases/latest/download/AnimalsRun-beta.apk"><b>📥 갤럭시용 APK 다운로드</b></a>
  &nbsp;·&nbsp;
  <a href="docs/beta-guide.pdf"><b>📄 안내서 PDF</b></a>
</p>

| 내 폰 | 설치 방법 |
| --- | --- |
| 📱 갤럭시 (안드로이드) | [1번 — APK 설치](#1-갤럭시-안드로이드--apk-설치) |
| 🍎 아이폰 | [2번 — Expo Go로 접속](#2-아이폰--expo-go로-접속) |

---

## 1. 갤럭시 (안드로이드) — APK 설치

<img src="docs/qr-apk.png" width="160" alt="APK 다운로드 QR" align="right" />

1. 갤럭시 카메라로 오른쪽 QR을 찍거나, 위의 **APK 다운로드**를 눌러 `AnimalsRun-beta.apk`를 받아요.
2. 다운로드한 파일을 눌러 열어요.
3. "출처를 알 수 없는 앱" 안내가 나오면 **설정 → 이 출처 허용**을 켜고 돌아와서 **설치**를 눌러요.
4. "Play 프로텍트" 경고가 뜨면 **세부정보 더보기 → 무시하고 설치**를 눌러요. 정식 스토어 앱이 아니라서 뜨는 경고예요.
5. 설치가 끝나면 **Animals Run** 아이콘이 생겨요.

<br clear="right" />

## 2. 아이폰 — Expo Go로 접속

| ① Expo Go 설치 | ② Animals Run 접속 |
| :---: | :---: |
| <img src="docs/qr-expo-go.png" width="160" alt="Expo Go 설치 QR" /> | <img src="docs/qr-expo-app.png" width="160" alt="Animals Run 접속 QR" /> |

1. App Store에서 **Expo Go** 앱을 설치해요. (왼쪽 QR)
2. 아이폰 **기본 카메라**로 오른쪽 QR을 찍고, 뜨는 알림을 눌러 Expo Go로 열어요.
3. 처음 열 때는 내려받느라 1분 정도 걸릴 수 있어요.
4. 다음부터는 Expo Go 앱을 열면 최근 목록에 Animals Run이 있어요.

QR이 안 찍히면 Expo Go에서 **Enter URL manually**를 누르고 아래 주소를 입력해요.

```
exp://djavh4q-anonymous-8082.exp.direct
```

> [!WARNING]
> 아이폰 접속용 서버는 개발자 PC에서 돌아가요. 접속이 안 되면 서버가 꺼진 거라서, 개발자에게 알려주세요.

## 3. 시작하기

1. **회원가입**에서 아이디, 닉네임, 비밀번호, 생년월일을 입력해요.
   - 아이디: 로그인용 (영문 소문자·숫자·`_` 4~20자)
   - 닉네임: 지도와 랭킹에 보이는 이름 (한글·영문·숫자·`_` 2~10자)
2. 가입하면 **100코인과 내 띠 동물**을 선물로 받아요.
3. 위치와 동작(걸음) 권한을 물어보면 **허용**해주세요. 걸음 수가 코인으로 바뀌고, 지도에 내 위치가 보여요.

## 4. 이렇게 놀아요

- **뽑기** — 코인이나 티켓으로 동물을 뽑아요. 배너마다 나오는 동물이 달라요.
- **홈** — 알 부화, 합성, 진화, 교배, 재활용으로 더 높은 등급의 동물을 만들어요.
- **보관함** — 모은 동물과 도감을 볼 수 있어요.
- **지도** — 걸으면서 주변 친구들의 대표 동물을 볼 수 있어요.
- **마이페이지** — 닉네임·대표 동물 변경, 업적 보상, 랭킹, 뽑기 기록.

## 5. 테스트하면서 봐주면 좋은 것

- 앱이 멈추거나 꺼지는 곳, 버벅이는 화면
- 걸음 수가 제대로 쌓이는지, 지도에 위치·동물 얼굴이 잘 뜨는지
- 확률이나 보상이 너무 짜거나 후한 부분
- 헷갈리는 문구나 버튼, "이런 게 있으면 좋겠다" 싶은 것

문제가 생기면 **어떤 폰**에서 **어느 화면**에서 **무엇을 눌렀을 때** 생겼는지와 스크린샷을 [Issues](https://github.com/jiwonns/animals-run/issues)에 남기거나 개발자에게 보내주세요.

## 6. 알아두세요

- 베타 버전이라 정식 출시 전에 데이터(코인, 동물)가 초기화될 수 있어요.
- 평소 쓰는 비밀번호와 다른 비밀번호를 써주세요.
- 새 버전이 나오면 갤럭시는 새 APK를 다시 설치하고, 아이폰은 Expo Go에서 다시 열면 자동으로 최신이 돼요.

---

## 개발자용

Expo SDK 58 · Expo Router · Firebase (Auth, Firestore)

```bash
npm install
cp .env.example .env               # Firebase 웹 앱 설정값 입력
cp .firebaserc.example .firebaserc # Firebase 프로젝트 ID 입력
npm run gacha                      # 이미지 최적화 + firestore.rules / 뽑기 상수 생성
npx expo start
```

- 뽑기 데이터: `assets/gacha/` → `npm run gacha`로 `firestore.rules`와 `src/constants/gacha.generated.ts` 생성
- 규칙 배포: `npx firebase-tools deploy --only firestore:rules`
