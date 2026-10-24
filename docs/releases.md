# APK 배포 절차

## 2026-10-24 · 1.0.4 APK 압축 파일 교체

- 같은 1.0.4 / versionCode 5이며 ARM64·x86_64 및 서명 인증서 유지.
- 다운로드 APK: 62,705,148 → 31,355,392바이트, 약 50% 감소. 설치 후 저장 공간과는 별개.
- 원본 assets/gacha 폴더 삭제 없이 Expo SDK 58 build-properties의 useLegacyPackaging으로 네이티브 라이브러리를 압축.
- 압축 설정 커밋: `73b1803a0e3cfec140a98ba4d68b419d58b73355`.
- 현재 공개 APK SHA-256: `b1cb06a9b9eefd099e551bf8fe62d9b79ee1e476be316e7da3ff333eff15d5f1`.
- 이전 APK와 네이티브 라이브러리 54개·JavaScript 번들·DEX의 해시 일치, 서명·두 CPU 지원·덮어 설치 및 개발 서버 없는 로그인 화면 실행 확인. AndroidRuntime/ReactNativeJS 오류 없음.
- Expo 설정 introspect에서 압축 활성화, lint/typecheck 통과. GitHub 파일 교체 후 재다운로드 SHA-256 일치 확인.

## 2026-10-24 · 1.0.4 배포 기록

- 앱 버전 1.0.4 / versionCode 5, arm64-v8a 및 x86_64.
- 제품 소스 커밋: `a05e3291b2bda232fd2e8fd8beef78c47ad752bd`.
- 공개 APK SHA-256: `7ebc24040259c8c4a888bf8ed3b037fe09eb5571376e71b906d6b06fb1b9bb5f`.
- 동물별 첫 획득·등급별 최초 달성 보상을 N/R/EP/U/L/H 각각 3/4/5/6/7/10장으로 축소.
- 노말·프리미엄 동물만 뽑기 허용, 가을·바다·고양이 뽑기 일시 중지. 기존 고등급 동물도 진화 전용으로 전환하며 보유 ID·이름·이미지·수량 유지.
- lint/typecheck, 보상·뽑기·종별 진화·고양이 회귀 검사, Firebase 보상 금액·중복 수령·획득 경로 및 관리자 카탈로그 통합 검사, 걸음 모듈 단위 테스트 통과.
- 기존 1.0.3과 인증서 일치, 에뮬레이터 덮어 설치 및 개발 서버 없는 로그인 화면 실행, AndroidRuntime/ReactNativeJS 오류 없음.
- 운영 카탈로그 v6, 웹·Firestore 규칙 배포 및 실제 웹·두 활성 뽑기·진화 전용 배제·기존 동물 유지 확인.
- GitHub 고정 다운로드 APK·체크섬 교체 후 재다운로드 해시 일치 확인. EAS 미로그인으로 기존 로컬 빌드 절차 사용.
- 실제 기기 센서·배터리 제한·재부팅 검증은 별도.

## 2026-10-24 · 1.0.3 배포 기록

- 앱 버전 1.0.3 / versionCode 4, arm64-v8a 및 x86_64.
- 제품 소스 커밋: `d76d84e00d297434081685187ede9f2efd2153f1`.
- 공개 APK SHA-256: `a7449729e33c74c11ce95ca79830a0ca10066ecf1d50fa18c17fdbc4ccc07159`.
- 프로필 상세, 보관함 수량·필터·정렬, 종별 도감·진화, 뽑기 확률과 지도 개선을 APK에도 반영.
- lint/typecheck, 프로필·가방·훈장·지도·도감·고양이·아기 동물 회귀 검사와 결투 147개 조합, 걸음 모듈 단위 테스트 통과.
- 기존 1.0.2와 서명 인증서 일치, 에뮬레이터 덮어 설치 및 개발 서버 없는 로그인 화면 실행 확인. AndroidRuntime/ReactNativeJS 오류 없음.
- GitHub 고정 다운로드 파일 및 체크섬 교체 후 재다운로드 SHA-256 일치 확인.
- EAS 미로그인으로 기존 로컬 릴리스 절차 사용. 실제 기기 센서·배터리 제한·재부팅 검증은 별도.

## 2026-10-22 · 1.0.2 배포 기록

- 앱 버전 1.0.2 / versionCode 3, arm64-v8a 및 x86_64.
- 제품 소스 커밋: `4b450ff71683aea611f9b6c278722fe90b6abba6`.
- 공개 APK SHA-256: `648eb19022fff78d7df5484f9711b186c3d2e5ab97202f0c0de6375bf7548bcc`.
- 기존 1.0.1과 서명 인증서 일치, 내장 JS 번들, 에뮬레이터 덮어 설치와 개발 서버 없는 로그인 화면 실행 확인.
- 린트·타입 검사, 지도 본인·친구 클릭 및 사진 변경 후 브리지 검사, 결투 147개 조합,
  친구 대전·보상 보안 규칙, 390px/320px 화면, 걸음 모듈 테스트 3개 통과.
- Firebase 웹과 규칙·인덱스 배포 완료. GitHub 고정 다운로드 파일 교체 후 재다운로드 해시 일치 확인.
- EAS 로그인이 없어 기존 문서의 로컬 릴리스 절차를 사용했다. 실제 휴대폰의 센서·배터리 제한·재부팅 검증은 별도다.

코드·웹 배포와 Android APK 교체는 별개의 작업입니다. 네이티브 기능을 바꾸면 JavaScript나 README만 갱신해도 기존 설치 APK는 바뀌지 않습니다.

## 고정 다운로드 주소

- 공개 APK: `https://github.com/jiwonns/animals-run/releases/download/v1.0.0-beta/AnimalsRun-beta.apk`
- QR은 위 주소를 가리키므로 APK를 교체해도 그대로 사용합니다.
- 배포 태그는 주소 호환성을 위해 유지합니다. 실제 앱 버전과 소스 커밋, SHA-256은 릴리스 본문과 체크섬 파일에 기록합니다.

## 빌드

1. `app.json`의 `expo.version`과 `android.versionCode`를 올립니다. `versionCode`는 이전 배포보다 커야 합니다. npm 버전도 맞춥니다.
2. 기존 공개 APK를 내려받아 보관하고 서명 인증서 SHA-256을 확인합니다. 업데이트용 APK는 기존 앱과 같은 패키지·인증서를 사용해야 합니다. 서명 파일은 Git에 올리지 않습니다.
3. `npm run lint`, `npm run typecheck`와 변경한 기능의 테스트를 통과시킵니다.
4. 기본 배포는 EAS Build를 사용합니다. 이 프로젝트의 기존 APK 서명을 유지하도록 자격 증명을 연결한 뒤 APK 형식의 내부 배포 빌드를 생성합니다.
5. EAS 로그인이 없는 현재 환경에서는 준비된 Android SDK·JDK로 기존 로컬 릴리스 빌드를 사용했습니다. `npx expo prebuild --platform android --no-install`로 설정을 반영합니다. 생성된 `android/`는 직접 편집하지 않습니다.
6. Windows 로컬 빌드에서는 JDK, Android SDK, Gradle 캐시 경로를 해당 환경에 맞게 설정한 뒤 실행합니다.

```powershell
$env:ANIMALS_RUN_CMAKE_HOME = 'C:\tools\cmake' # Windows에서 긴 경로를 지원하는 CMake를 지정할 때만
npx expo prebuild --platform android --no-install
.\android\gradlew.bat -p android :step-counter:testDebugUnitTest :app:assembleRelease `
  '-PreactNativeArchitectures=arm64-v8a,x86_64' `
  '-Pandroid.enableMinifyInReleaseBuilds=true' '-Pexpo.useLegacyPackaging=true' --max-workers=2
```

결과물은 `android/app/build/outputs/apk/release/app-release.apk`입니다. `app-debug.apk`나 Metro 연결이 필요한 개발 빌드를 공개 APK로 배포하지 않습니다.

## 게시 전 확인

- `aapt dump badging`으로 패키지, 버전 이름·코드와 CPU 지원을 확인합니다.
- `apksigner verify --print-certs`로 서명이 유효하고 이전 공개 APK와 인증서가 같은지 확인합니다.
- APK에 실행용 JS 번들과 백그라운드 걸음 서비스·필요 권한이 들어 있는지 확인합니다.
- 에뮬레이터에서 설치·실행하고 Metro 없이 로그인 화면이 나타나는지 확인합니다. 가능하면 기존 버전 위에 덮어 설치하는 동작도 확인합니다.
- 실제 걸음 센서·배터리 제한·재부팅 동작은 실제 Android 기기에서 확인합니다.

## 공개 파일 교체

1. 검증한 APK를 `AnimalsRun-beta.apk`로 복사하고 SHA-256 체크섬 파일을 만듭니다.
2. GitHub 릴리스의 APK를 `gh release upload v1.0.0-beta <APK> <체크섬> --clobber`로 교체합니다.
3. 같은 릴리스의 제목·본문에 앱 버전, 날짜, 포함 기능과 소스 커밋을 기록합니다.
4. 공개된 APK를 다시 내려받아 빌드 결과와 SHA-256이 같은지 확인합니다.
5. README에 실제 교체한 버전·설치 안내를 반영하고 소스와 함께 push합니다.

README에 최신 APK라고 표시하는 시점에는 공개 파일 교체와 재다운로드 검증까지 끝나 있어야 합니다.
