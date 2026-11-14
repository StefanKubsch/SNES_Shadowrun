# Controlled Windows reproduction; touches only a new temporary artifact.
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This diagnostic requires Windows.' }
$taskTempRoot = Join-Path ([IO.Path]::GetTempPath()) ('snes-windows-open-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskTempRoot | Out-Null
$taskFile = Join-Path $taskTempRoot 'render-proof.json'
$taskHelper = Join-Path $PSScriptRoot 'write-artifact.mjs'
$taskHandle = [IntPtr]::new(-1)
$taskMapping = [IntPtr]::Zero
$taskView = [IntPtr]::Zero
try {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SnesMappedArtifact {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern IntPtr CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] public static extern IntPtr CreateFileMappingW(IntPtr file,IntPtr security,uint protection,uint high,uint low,IntPtr name);
 [DllImport("kernel32.dll",SetLastError=true)] public static extern IntPtr MapViewOfFile(IntPtr mapping,uint access,uint high,uint low,UIntPtr size);
 [DllImport("kernel32.dll")] public static extern bool UnmapViewOfFile(IntPtr view);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
}
'@
    [IO.File]::WriteAllText($taskFile, '{"original":true}')
    $taskHandle = [SnesMappedArtifact]::CreateFileW($taskFile,2147483648,7,[IntPtr]::Zero,3,128,[IntPtr]::Zero)
    if ($taskHandle -eq [IntPtr]::new(-1)) { throw 'CreateFile mapping source failed.' }
    $taskMapping = [SnesMappedArtifact]::CreateFileMappingW($taskHandle,[IntPtr]::Zero,2,0,0,[IntPtr]::Zero)
    if ($taskMapping -eq [IntPtr]::Zero) { throw 'CreateFileMapping failed.' }
    $taskView = [SnesMappedArtifact]::MapViewOfFile($taskMapping,4,0,0,[UIntPtr]::Zero)
    if ($taskView -eq [IntPtr]::Zero) { throw 'MapViewOfFile failed.' }
    $taskTruncate = [SnesMappedArtifact]::CreateFileW($taskFile,1073741824,7,[IntPtr]::Zero,2,128,[IntPtr]::Zero)
    $taskWinError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($taskTruncate -ne [IntPtr]::new(-1)) {
        [SnesMappedArtifact]::CloseHandle($taskTruncate) | Out-Null
        throw 'Expected Windows to reject truncation of the mapped artifact.'
    }
    if ($taskWinError -ne 1224) { throw "Unexpected native open error: $taskWinError" }
    node --input-type=module -e '
import assert from "node:assert/strict";
import {readFile,writeFile,stat} from "node:fs/promises";
import {pathToFileURL} from "node:url";
const [path,helper]=process.argv.slice(1),text="{\"original\":true}";
const {writeArtifactIfChanged}=await import(pathToFileURL(helper));
const before=await stat(path);
await assert.rejects(()=>writeFile(path,text),{code:"UNKNOWN",errno:-4094,syscall:"open"});
assert.equal(await writeArtifactIfChanged(path,text),false);
assert.equal((await stat(path)).mtimeMs,before.mtimeMs);
await assert.rejects(()=>writeArtifactIfChanged(path,"changed"),{code:"UNKNOWN",errno:-4094,syscall:"open"});
assert.equal(await readFile(path,"utf8"),text);
console.log(JSON.stringify({controlled_fixture:true,native_open_error:1224,node_open_error:"UNKNOWN/-4094",identical_artifact_preserved:true,changed_artifact_failure_propagated:true}));
' $taskFile $taskHelper
    if ($LASTEXITCODE -ne 0) { throw 'Mapped artifact checks failed.' }
    [SnesMappedArtifact]::UnmapViewOfFile($taskView) | Out-Null
    $taskView = [IntPtr]::Zero
    [SnesMappedArtifact]::CloseHandle($taskMapping) | Out-Null
    $taskMapping = [IntPtr]::Zero
    [SnesMappedArtifact]::CloseHandle($taskHandle) | Out-Null
    $taskHandle = [IntPtr]::new(-1)
    node --input-type=module -e '
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
const [path,helper]=process.argv.slice(1),{writeArtifactIfChanged}=await import(pathToFileURL(helper));
assert.equal(await writeArtifactIfChanged(path,"changed"),true);
assert.equal(await readFile(path,"utf8"),"changed");
console.log(JSON.stringify({unmapped_changed_artifact_written:true}));
' $taskFile $taskHelper
    if ($LASTEXITCODE -ne 0) { throw 'Unmapped artifact check failed.' }
} finally {
    if ($taskView -ne [IntPtr]::Zero) { [SnesMappedArtifact]::UnmapViewOfFile($taskView) | Out-Null }
    if ($taskMapping -ne [IntPtr]::Zero) { [SnesMappedArtifact]::CloseHandle($taskMapping) | Out-Null }
    if ($taskHandle -ne [IntPtr]::new(-1)) { [SnesMappedArtifact]::CloseHandle($taskHandle) | Out-Null }
    if (Test-Path -LiteralPath $taskFile) { Remove-Item -LiteralPath $taskFile -Force }
    Remove-Item -LiteralPath $taskTempRoot
}
