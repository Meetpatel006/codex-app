[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ForwardArgs
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetScript = Join-Path $scriptRoot "..\src\scripts\codex-refresh.ps1"

if (-not (Test-Path $targetScript)) {
    throw "Could not find source refresh script at '$targetScript'."
}

& $targetScript @ForwardArgs
exit $LASTEXITCODE
