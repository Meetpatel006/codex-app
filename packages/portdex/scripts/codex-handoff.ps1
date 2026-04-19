[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ForwardArgs
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetScript = Join-Path $scriptRoot "..\src\scripts\codex-handoff.ps1"

if (-not (Test-Path $targetScript)) {
    throw "Could not find source handoff script at '$targetScript'."
}

& $targetScript @ForwardArgs
exit $LASTEXITCODE
