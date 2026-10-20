# APK 배포 절차

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
  '-Pandroid.enableMinifyInReleaseBuilds=true' --max-workers=2
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
