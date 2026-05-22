param(
    [string]$ServiceName = "ai-interview-backend",
    [string]$EnvFile = "backend/.env"
)

$ErrorActionPreference = "Stop"

if (-not $env:RENDER_API_KEY) {
    throw "Set RENDER_API_KEY first. Create it in Render Account Settings > API Keys, then run: `$env:RENDER_API_KEY='your_key_here'"
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw "Environment file not found: $EnvFile"
}

$headers = @{
    "Authorization" = "Bearer $env:RENDER_API_KEY"
    "Accept" = "application/json"
    "Content-Type" = "application/json"
}

$dotenv = @{}
Get-Content -LiteralPath $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
        return
    }

    $key, $value = $line.Split("=", 2)
    $dotenv[$key.Trim()] = $value.Trim().Trim('"').Trim("'")
}

$requiredKeys = @(
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
    "SMTP_FROM_NAME",
    "SMTP_USE_TLS",
    "SMTP_USE_SSL",
    "ALLOW_INSECURE_OTP_RESPONSE"
)

$missing = $requiredKeys | Where-Object { -not $dotenv.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($dotenv[$_]) }
if ($missing.Count -gt 0) {
    throw "Missing values in ${EnvFile}: $($missing -join ', ')"
}

$services = Invoke-RestMethod `
    -Method Get `
    -Uri "https://api.render.com/v1/services?limit=100" `
    -Headers $headers

$service = $services | Where-Object {
    if ($_.service) {
        $_.service.name -eq $ServiceName
    } else {
        $_.name -eq $ServiceName
    }
} | Select-Object -First 1

if (-not $service) {
    throw "Render service not found: $ServiceName"
}

$serviceId = if ($service.service) { $service.service.id } else { $service.id }
Write-Host "Updating SMTP environment variables on Render service '$ServiceName'..."

foreach ($key in $requiredKeys) {
    $body = @{ value = $dotenv[$key] } | ConvertTo-Json
    Invoke-RestMethod `
        -Method Put `
        -Uri "https://api.render.com/v1/services/$serviceId/env-vars/$key" `
        -Headers $headers `
        -Body $body | Out-Null

    Write-Host "$key updated"
}

Write-Host "Triggering backend redeploy..."
$deployBody = @{ clearCache = "do_not_clear" } | ConvertTo-Json
Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.render.com/v1/services/$serviceId/deploys" `
    -Headers $headers `
    -Body $deployBody | Out-Null

Write-Host "Done. Render is redeploying '$ServiceName'."
