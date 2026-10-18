# Builds and installs the Android development build on this PC.
# Android tools break on the non-ASCII user folder and on paths over 260 characters, so everything runs
# from ASCII paths: the SDK through the C:\AndroidSdk junction, CMake 3.31 + ninja 1.12 from C:\tools\cmake.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

if (-not (Test-Path C:\AndroidSdk)) {
  New-Item -ItemType Junction -Path C:\AndroidSdk -Target "$env:LOCALAPPDATA\Android\Sdk" | Out-Null
}
New-Item -ItemType Directory -Force C:\tmp, C:\gradle-home | Out-Null

$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;C:\Program Files\nodejs;$env:Path"
$env:ANDROID_HOME = 'C:\AndroidSdk'
$env:ANDROID_SDK_ROOT = 'C:\AndroidSdk'
$env:TEMP = 'C:\tmp'
$env:TMP = 'C:\tmp'
$env:GRADLE_USER_HOME = 'C:\gradle-home'
$env:GRADLE_OPTS = '-Djava.io.tmpdir=C:\tmp'

Push-Location $root
try {
  # Prebuild regenerates android/, so the SDK and CMake locations are written after it.
  npx expo prebuild --platform android --no-install
  Set-Content -Path android\local.properties -Value "sdk.dir=C\:\\AndroidSdk`ncmake.dir=C\:\\tools\\cmake"
  npx expo run:android --no-bundler @args
} finally {
  Pop-Location
}
