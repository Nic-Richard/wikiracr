param([switch]$AppBundle)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$savedJava = $env:JAVA_HOME
$savedAndroid = $env:ANDROID_HOME
$savedPath = $env:PATH
$savedKeyPath = $env:WIKIRACR_KEYSTORE_PATH
$savedPassword = $env:WIKIRACR_KEYSTORE_PASSWORD
Push-Location $root
try {
    $env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot'
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    $env:PATH = "$env:JAVA_HOME\bin;$savedPath"
    & npm.cmd run sync
    if ($LASTEXITCODE -ne 0) { throw 'Client sync failed.' }
    Set-Content -LiteralPath 'android\local.properties' -Value "sdk.dir=$($env:ANDROID_HOME -replace '\\', '/' -replace ':', '\:')" -Encoding ascii
    $task = if ($AppBundle) { 'bundleRelease' } else { 'assembleDebug' }
    if ($AppBundle) {
        $keyRoot = [IO.Path]::GetFullPath((Join-Path $root '..\..\keys'))
        $credential = Import-Clixml -LiteralPath (Join-Path $keyRoot 'upload-password.xml')
        $env:WIKIRACR_KEYSTORE_PATH = (Resolve-Path -LiteralPath (Join-Path $keyRoot 'wikiracr-upload.p12')).Path
        $env:WIKIRACR_KEYSTORE_PASSWORD = $credential.GetNetworkCredential().Password
    }
    & '.\android\gradlew.bat' -p android --no-daemon $task --max-workers=4 --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    $output = if ($AppBundle) { 'android\app\build\outputs\bundle\release\app-release.aab' } else { 'android\app\build\outputs\apk\debug\app-debug.apk' }
    Write-Host (Join-Path $root $output)
} finally {
    $env:JAVA_HOME = $savedJava
    $env:ANDROID_HOME = $savedAndroid
    $env:PATH = $savedPath
    $env:WIKIRACR_KEYSTORE_PATH = $savedKeyPath
    $env:WIKIRACR_KEYSTORE_PASSWORD = $savedPassword
    $credential = $null
    Pop-Location
}
