# ═══════════════════════════════════════════════════════════════════════════════
# "Last Day Deadline" Concurrency Stress Test — Orchestrator (Windows/PowerShell)
#
# Runs all three scenarios sequentially, collects metrics, and generates
# a Scalability Heatmap report.
#
# Prerequisites:
#   - k6 installed (https://k6.io/docs/getting-started/installation/)
#   - Backend server running on localhost:3000
#   - Redis running on localhost:6379
#   - PostgreSQL running on localhost:5434
#
# Usage:
#   cd nalogai/backend
#   powershell -ExecutionPolicy Bypass -File scripts/k6-last-day-orchestrator.ps1
#
# Environment variables:
#   K6_BASE_URL     — API base URL (default: http://localhost:3000)
#   K6_USER_EMAIL   — Test user email (default: test@nalogai.kz)
#   K6_USER_PASS    — Test user password (default: TestPass123)
#   K6_NOTIFY_COUNT — Number of notifications to enqueue (default: 5000)
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResultsDir = Join-Path $ScriptDir "..\stress-test-results"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$ReportFile = Join-Path $ResultsDir "heatmap_${Timestamp}.md"

# Ensure results directory exists
if (!(Test-Path $ResultsDir)) { New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null }

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host "  NalogAI — `"Last Day Deadline`" Concurrency Stress Test" -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""
Write-Host "  Timestamp:  $Timestamp"
Write-Host "  Base URL:   $($env:K6_BASE_URL ?? 'http://localhost:3000')"
Write-Host "  Results:    $ResultsDir"
Write-Host ""

# ── Pre-flight checks ────────────────────────────────────────────────────────
Write-Host "[Pre-flight] Checking prerequisites..." -ForegroundColor Yellow

$k6Path = Get-Command k6 -ErrorAction SilentlyContinue
if (!$k6Path) {
    Write-Host "ERROR: k6 is not installed. Install from https://k6.io/docs/getting-started/installation/" -ForegroundColor Red
    exit 1
}

$baseUrl = $env:K6_BASE_URL ?? "http://localhost:3000"
try {
    $healthCheck = Invoke-WebRequest -Uri "$baseUrl/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[Pre-flight] Backend reachable (HTTP $($healthCheck.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Backend not reachable at $baseUrl" -ForegroundColor Red
    Write-Host "  Start the backend: cd nalogai/backend && npm run dev"
    exit 1
}

Write-Host "[Pre-flight] All checks passed" -ForegroundColor Green
Write-Host ""

# ── Scenario 1: Dashboard Surge (Load-Balancer-Expert) ───────────────────────
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "  Scenario 1: Dashboard Surge — @Load-Balancer-Expert" -ForegroundColor Blue
Write-Host "  10,000 concurrent users → Dashboard endpoints" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host ""

$DashboardJson = Join-Path $ResultsDir "dashboard_${Timestamp}.json"
$DashboardOutput = Join-Path $ResultsDir "dashboard_output_${Timestamp}.txt"
$DashboardScript = Join-Path $ScriptDir "k6-last-day-dashboard.js"

k6 run --summary-export="$DashboardJson" "$DashboardScript" 2>&1 | Tee-Object -FilePath $DashboardOutput
$DashboardExit = $LASTEXITCODE
Write-Host ""

# ── Cooldown ──────────────────────────────────────────────────────────────────
Write-Host "[Cooldown] Waiting 30s for system to stabilize..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# ── Scenario 2: Declaration Surge (Database-SRE) ─────────────────────────────
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "  Scenario 2: Declaration Surge — @Database-SRE" -ForegroundColor Blue
Write-Host "  500 simultaneous Generate Declaration (910.00) requests" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host ""

$DeclarationsJson = Join-Path $ResultsDir "declarations_${Timestamp}.json"
$DeclarationsOutput = Join-Path $ResultsDir "declarations_output_${Timestamp}.txt"
$DeclarationsScript = Join-Path $ScriptDir "k6-last-day-declarations.js"

k6 run --summary-export="$DeclarationsJson" "$DeclarationsScript" 2>&1 | Tee-Object -FilePath $DeclarationsOutput
$DeclarationsExit = $LASTEXITCODE
Write-Host ""

# ── Cooldown ──────────────────────────────────────────────────────────────────
Write-Host "[Cooldown] Waiting 30s for system to stabilize..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# ── Scenario 3: Notification Surge (Notification-Marshal) ─────────────────────
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "  Scenario 3: Notification Surge — @Notification-Marshal" -ForegroundColor Blue
Write-Host "  5,000 BullMQ notification jobs → Redis queue" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host ""

$NotificationsJson = Join-Path $ResultsDir "notifications_${Timestamp}.json"
$NotificationsOutput = Join-Path $ResultsDir "notifications_output_${Timestamp}.txt"
$NotificationsScript = Join-Path $ScriptDir "k6-last-day-notifications.js"

k6 run --summary-export="$NotificationsJson" "$NotificationsScript" 2>&1 | Tee-Object -FilePath $NotificationsOutput
$NotificationsExit = $LASTEXITCODE
Write-Host ""

# ── Generate Report ───────────────────────────────────────────────────────────
Write-Host "[Report] Generating Scalability Heatmap..." -ForegroundColor Yellow

$OverallStatus = if ($DashboardExit -eq 0 -and $DeclarationsExit -eq 0 -and $NotificationsExit -eq 0) { "PASS" } else { "FAIL" }
$DashboardIcon = if ($DashboardExit -eq 0) { "PASS" } else { "FAIL" }
$DeclarationsIcon = if ($DeclarationsExit -eq 0) { "PASS" } else { "FAIL" }
$NotificationsIcon = if ($NotificationsExit -eq 0) { "PASS" } else { "FAIL" }

$ReportContent = @"
# NalogAI: Scalability Heatmap — "Last Day Deadline" Stress Test

**Generated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC")
**Overall Status:** $OverallStatus

---

## Scenario Results Summary

| Scenario | Agent | Status | Output |
|----------|-------|--------|--------|
| Dashboard Surge (10K VUs) | @Load-Balancer-Expert | $DashboardIcon | dashboard_output_${Timestamp}.txt |
| Declaration Surge (500 VUs) | @Database-SRE | $DeclarationsIcon | declarations_output_${Timestamp}.txt |
| Notification Surge (5K jobs) | @Notification-Marshal | $NotificationsIcon | notifications_output_${Timestamp}.txt |

## Scalability Heatmap

| Load Level | Dashboard (VUs) | Declarations (VUs) | Notifications (Jobs) | Expected Behavior |
|------------|-----------------|--------------------|--------------------|-------------------|
| Normal | 0-100 | 0-10 | 0-100 | All green, p95 < 100ms |
| Moderate | 100-1,000 | 10-50 | 100-1,000 | p95 < 200ms, rate limiter kicks in |
| High | 1,000-5,000 | 50-200 | 1,000-3,000 | p95 < 500ms, connection pool pressure |
| Critical | 5,000-10,000 | 200-500 | 3,000-5,000 | p95 may exceed 500ms, 504s possible |
| Collapse | > 10,000 | > 500 | > 5,000 | Connection exhaustion, cascading failures |

See the full report in k6-last-day-orchestrator.sh for detailed bottleneck analysis.

*Generated by NalogAI Last Day Deadline Stress Test Orchestrator*
"@

$ReportContent | Out-File -FilePath $ReportFile -Encoding utf8

Write-Host "[Report] Scalability Heatmap saved to: $ReportFile" -ForegroundColor Green
Write-Host ""

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host "  Stress Test Complete" -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""
Write-Host "  Dashboard:     $(if ($DashboardExit -eq 0) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($DashboardExit -eq 0) { 'Green' } else { 'Red' })
Write-Host "  Declarations:  $(if ($DeclarationsExit -eq 0) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($DeclarationsExit -eq 0) { 'Green' } else { 'Red' })
Write-Host "  Notifications: $(if ($NotificationsExit -eq 0) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($NotificationsExit -eq 0) { 'Green' } else { 'Red' })
Write-Host ""
Write-Host "  Report: $ReportFile"
Write-Host ""

if ($DashboardExit -ne 0 -or $DeclarationsExit -ne 0 -or $NotificationsExit -ne 0) {
    exit 1
}
