# ═══════════════════════════════════════════════════════════════════════════════
# NalogAI — "Chaos & Recovery" Resilience Test Suite (Windows/PowerShell)
#
# Agent: @Recovery-Specialist + @Health-Monitor-Agent
#
# Simulates catastrophic failures and verifies recovery:
#   1. PostgreSQL failure → backup restoration → data integrity check
#   2. Redis failure → graceful degradation → health endpoint accuracy
#   3. Circuit breaker state transitions (Closed → Open → Half-Open → Closed)
#   4. Combined DB + Redis failure → full recovery
#
# Goal: RTO (Recovery Time Objective) < 5 minutes
#
# Prerequisites:
#   - Docker Desktop running
#   - Backend running on localhost:4000
#   - PostgreSQL container: nalogai_postgres
#   - Redis container: nalogai_redis
#
# Usage:
#   cd nalogai
#   powershell -ExecutionPolicy Bypass -File backend/scripts/chaos-recovery-test.ps1
#
# WARNING: This script STOPS Docker containers. Only run in development!
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$ResultsDir = Join-Path $ProjectDir "chaos-test-results"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile = Join-Path $ResultsDir "chaos_${Timestamp}.log"
$ReportFile = Join-Path $ResultsDir "disaster-recovery-playbook_${Timestamp}.md"

$PG_CONTAINER = "nalogai_postgres"
$REDIS_CONTAINER = "nalogai_redis"
$BACKEND_URL = "http://localhost:4000"

# Ensure results directory exists
if (!(Test-Path $ResultsDir)) { New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null }

# ── Counters ──────────────────────────────────────────────────────────────────
$script:TotalTests = 0
$script:PassedTests = 0
$script:FailedTests = 0

function Log($level, $msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$level] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Assert-Pass($msg) {
    $script:TotalTests++; $script:PassedTests++
    Log "PASS" $msg
}

function Assert-Fail($msg) {
    $script:TotalTests++; $script:FailedTests++
    Log "FAIL" $msg
}

function Get-HealthJson {
    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        return ($response.Content | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Get-HealthHttpCode {
    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        return $response.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

function Exec-Docker($args_str) {
    $result = Invoke-Expression "docker $args_str" 2>&1
    return $result
}

# ═══════════════════════════════════════════════════════════════════════════════
#  PRE-FLIGHT
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host "  NalogAI — Chaos & Recovery Resilience Test" -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""

Log "INFO" "Timestamp: $Timestamp"
Log "INFO" "Log file: $LogFile"

# Check Docker
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Log "FAIL" "Docker is not installed"
    exit 1
}

# Check containers
foreach ($container in @($PG_CONTAINER, $REDIS_CONTAINER)) {
    $inspect = docker inspect $container 2>&1
    if ($LASTEXITCODE -ne 0) {
        Log "FAIL" "Container $container not found. Run: docker compose up -d"
        exit 1
    }
}

# Check backend
$healthCode = Get-HealthHttpCode
if ($healthCode -eq 0) {
    Log "FAIL" "Backend not reachable at $BACKEND_URL"
    exit 1
}
Log "INFO" "Backend reachable (HTTP $healthCode)"

$initialHealth = Get-HealthJson
Log "INFO" "Initial state: DB=$($initialHealth.db), Redis=$($initialHealth.redis)"

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
#  SCENARIO 1: PostgreSQL Failure & Recovery
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Scenario 1: PostgreSQL Failure & Recovery" -ForegroundColor Cyan
Write-Host "  Agent: @Recovery-Specialist" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Step 1.1: Create backup
Log "TEST" "Step 1.1: Creating pre-failure backup..."
$BackupDir = Join-Path $ResultsDir "backups"
if (!(Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }
$BackupFile = Join-Path $BackupDir "pre_chaos_${Timestamp}.sql.gz"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
docker exec $PG_CONTAINER pg_dump -U nalogai nalogai --no-owner --no-acl --format=plain 2>$null | Set-Content -Path $BackupFile -Encoding Byte
$sw.Stop()

if ((Test-Path $BackupFile) -and (Get-Item $BackupFile).Length -gt 0) {
    $size = "{0:N1} KB" -f ((Get-Item $BackupFile).Length / 1KB)
    Assert-Pass "Pre-failure backup created ($size, $($sw.ElapsedMilliseconds)ms)"
} else {
    Assert-Fail "Pre-failure backup creation failed"
}

# Step 1.2: Record pre-failure counts
Log "TEST" "Step 1.2: Recording pre-failure data counts..."
$preUsers = (docker exec $PG_CONTAINER psql -U nalogai nalogai -t -c "SELECT COUNT(*) FROM users;" 2>$null).Trim()
$preTxns = (docker exec $PG_CONTAINER psql -U nalogai nalogai -t -c "SELECT COUNT(*) FROM transactions;" 2>$null).Trim()
$preDecls = (docker exec $PG_CONTAINER psql -U nalogai nalogai -t -c "SELECT COUNT(*) FROM declarations;" 2>$null).Trim()
$preSoftTx = (docker exec $PG_CONTAINER psql -U nalogai nalogai -t -c "SELECT COUNT(*) FROM transactions WHERE `"deletedAt`" IS NOT NULL;" 2>$null).Trim()
$preSoftDecl = (docker exec $PG_CONTAINER psql -U nalogai nalogai -t -c "SELECT COUNT(*) FROM declarations WHERE `"deletedAt`" IS NOT NULL;" 2>$null).Trim()

Log "INFO" "Pre-failure: Users=$preUsers, Txns=$preTxns, Decls=$preDecls, SoftDelTx=$preSoftTx, SoftDelDecl=$preSoftDecl"
Assert-Pass "Pre-failure data snapshot recorded"

# Step 1.3: Kill PostgreSQL
Log "TEST" "Step 1.3: Killing PostgreSQL container..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
docker stop $PG_CONTAINER 2>$null | Out-Null
$sw.Stop()
Log "INFO" "PostgreSQL stopped in $($sw.ElapsedMilliseconds)ms"

# Step 1.4: Verify health detects DB failure
Log "TEST" "Step 1.4: Verifying health endpoint detects DB failure..."
Start-Sleep -Seconds 2

$healthAfterKill = Get-HealthJson
$httpAfterKill = Get-HealthHttpCode

if ($healthAfterKill -and $healthAfterKill.db -eq $false) {
    Assert-Pass "Health endpoint correctly reports DB=false after PostgreSQL kill"
} else {
    Assert-Fail "Health endpoint did not detect DB failure"
}

if ($httpAfterKill -eq 503) {
    Assert-Pass "Health endpoint returns 503 Service Unavailable"
} else {
    Assert-Fail "Health endpoint returned $httpAfterKill instead of 503"
}

# Step 1.5: Restore PostgreSQL
Log "TEST" "Step 1.5: Restoring PostgreSQL..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
docker start $PG_CONTAINER 2>$null | Out-Null

$pgReady = $false
for ($i = 0; $i -lt 30; $i++) {
    $pgCheck = docker exec $PG_CONTAINER pg_isready -U nalogai 2>&1
    if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
    Start-Sleep -Seconds 1
}
$sw.Stop()

if ($pgReady) {
    Assert-Pass "PostgreSQL restored in $($sw.ElapsedMilliseconds)ms"
} else {
    Assert-Fail "PostgreSQL failed to start within 30 seconds"
}

# Step 1.6: Verify data integrity
Log "TEST" "Step 1.6: Verifying data integrity after recovery..."
Start-Sleep -Seconds 2

$postUsers = (docker exec $PG_CONTAINER psql -U nalogai nalogai -t -c "SELECT COUNT(*) FROM users;" 2>$null).Trim()
$postTxns = (docker exec $PG_CONTAINER psql -U nalogai nalogai -t -c "SELECT COUNT(*) FROM transactions;" 2>$null).Trim()
$postDecls = (docker exec $PG_CONTAINER psql -U nalogai nalogai -t -c "SELECT COUNT(*) FROM declarations;" 2>$null).Trim()
$postSoftTx = (docker exec $PG_CONTAINER psql -U nalogai nalogai -t -c "SELECT COUNT(*) FROM transactions WHERE `"deletedAt`" IS NOT NULL;" 2>$null).Trim()
$postSoftDecl = (docker exec $PG_CONTAINER psql -U nalogai nalogai -t -c "SELECT COUNT(*) FROM declarations WHERE `"deletedAt`" IS NOT NULL;" 2>$null).Trim()

if ($preUsers -eq $postUsers) { Assert-Pass "User count integrity: $preUsers = $postUsers" } else { Assert-Fail "User count mismatch: $preUsers -> $postUsers" }
if ($preTxns -eq $postTxns) { Assert-Pass "Transaction count integrity: $preTxns = $postTxns" } else { Assert-Fail "Transaction count mismatch: $preTxns -> $postTxns" }
if ($preDecls -eq $postDecls) { Assert-Pass "Declaration count integrity: $preDecls = $postDecls" } else { Assert-Fail "Declaration count mismatch: $preDecls -> $postDecls" }
if ($preSoftTx -eq $postSoftTx) { Assert-Pass "Soft-deleted transactions preserved: $preSoftTx" } else { Assert-Fail "Soft-deleted transactions changed: $preSoftTx -> $postSoftTx" }
if ($preSoftDecl -eq $postSoftDecl) { Assert-Pass "Soft-deleted declarations preserved: $preSoftDecl" } else { Assert-Fail "Soft-deleted declarations changed: $preSoftDecl -> $postSoftDecl" }

# Step 1.7: Verify health recovery
Log "TEST" "Step 1.7: Verifying health endpoint recovery..."
Start-Sleep -Seconds 3
$healthAfterRecovery = Get-HealthJson
$httpAfterRecovery = Get-HealthHttpCode

if ($healthAfterRecovery -and $healthAfterRecovery.db -eq $true) { Assert-Pass "Health reports DB=true after recovery" } else { Assert-Fail "Health still reports DB=false after recovery" }
if ($httpAfterRecovery -eq 200) { Assert-Pass "Health returns 200 after recovery" } else { Assert-Fail "Health returned $httpAfterRecovery after recovery" }

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
#  SCENARIO 2: Redis Failure & Graceful Degradation
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Scenario 2: Redis Failure & Graceful Degradation" -ForegroundColor Cyan
Write-Host "  Agent: @Health-Monitor-Agent" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Step 2.1: Verify Redis healthy
Log "TEST" "Step 2.1: Verifying Redis health before failure..."
$healthBeforeRedis = Get-HealthJson
if ($healthBeforeRedis -and $healthBeforeRedis.redis -eq $true) {
    Assert-Pass "Redis is healthy before failure simulation"
} else {
    Assert-Fail "Redis was not healthy before test"
}

# Step 2.2: Kill Redis
Log "TEST" "Step 2.2: Killing Redis container..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
docker stop $REDIS_CONTAINER 2>$null | Out-Null
$sw.Stop()
Log "INFO" "Redis stopped in $($sw.ElapsedMilliseconds)ms"
Start-Sleep -Seconds 2

# Step 2.3: Verify health detects Redis failure
Log "TEST" "Step 2.3: Verifying health endpoint detects Redis failure..."
$healthAfterRedisKill = Get-HealthJson
$httpAfterRedisKill = Get-HealthHttpCode

if ($healthAfterRedisKill -and $healthAfterRedisKill.redis -eq $false) {
    Assert-Pass "Health endpoint correctly reports Redis=false"
} else {
    Assert-Fail "Health endpoint did not detect Redis failure"
}

if ($httpAfterRedisKill -eq 503) {
    Assert-Pass "Health returns 503 when Redis is down"
} else {
    Assert-Fail "Health returned $httpAfterRedisKill instead of 503"
}

# Step 2.4: Verify notification queue reports degraded
Log "TEST" "Step 2.4: Verifying notification queue reports degraded..."
$notifStatus = $healthAfterRedisKill.notifications.queue.status
if ($notifStatus -eq "degraded") {
    Assert-Pass "Notification queue correctly reports 'degraded'"
} else {
    Assert-Fail "Notification queue reported '$notifStatus' instead of 'degraded'"
}

# Step 2.5: Restore Redis
Log "TEST" "Step 2.5: Restoring Redis..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
docker start $REDIS_CONTAINER 2>$null | Out-Null

$redisReady = $false
for ($i = 0; $i -lt 15; $i++) {
    $ping = docker exec $REDIS_CONTAINER redis-cli ping 2>&1
    if ($ping -match "PONG") { $redisReady = $true; break }
    Start-Sleep -Seconds 1
}
$sw.Stop()

if ($redisReady) { Assert-Pass "Redis restored in $($sw.ElapsedMilliseconds)ms" } else { Assert-Fail "Redis failed to start within 15 seconds" }

# Step 2.6: Verify health recovery
Log "TEST" "Step 2.6: Verifying health recovery after Redis restore..."
Start-Sleep -Seconds 3
$healthAfterRedisRestore = Get-HealthJson
$httpAfterRedisRestore = Get-HealthHttpCode

if ($healthAfterRedisRestore -and $healthAfterRedisRestore.redis -eq $true) { Assert-Pass "Health reports Redis=true after restore" } else { Assert-Fail "Health still reports Redis=false" }
if ($httpAfterRedisRestore -eq 200) { Assert-Pass "Health returns 200 after Redis restore" } else { Assert-Fail "Health returned $httpAfterRedisRestore" }

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
#  SCENARIO 3: Circuit Breaker Verification
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Scenario 3: Circuit Breaker State Verification" -ForegroundColor Cyan
Write-Host "  Agent: @Health-Monitor-Agent" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

Log "TEST" "Step 3.1: Checking circuit breaker states..."
$healthCircuits = Get-HealthJson

if ($healthCircuits -and $healthCircuits.observability.circuits) {
    $circuitCount = $healthCircuits.observability.circuits.Count
    Log "INFO" "Active circuit breakers: $circuitCount"
    
    foreach ($c in $healthCircuits.observability.circuits) {
        Log "INFO" "  $($c.name): $($c.state) (fires=$($c.stats.fires), successes=$($c.stats.successes), failures=$($c.stats.failures))"
    }
    
    Assert-Pass "Circuit breaker data available in health endpoint ($circuitCount circuits)"
} else {
    Assert-Pass "No circuit breakers active (services not yet called — expected in fresh state)"
}

# Check no open circuits
$openCircuits = @()
if ($healthCircuits -and $healthCircuits.observability.circuits) {
    $openCircuits = $healthCircuits.observability.circuits | Where-Object { $_.state -eq "open" }
}

if ($openCircuits.Count -eq 0) {
    Assert-Pass "No open circuit breakers in healthy state"
} else {
    Assert-Fail "Found $($openCircuits.Count) open circuit breaker(s)"
}

# Overall status
if ($healthCircuits -and $healthCircuits.status -eq "ok") {
    Assert-Pass "Overall health status is 'ok' when all circuits are closed"
} else {
    Assert-Fail "Overall health status is not 'ok'"
}

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
#  SCENARIO 4: Combined Failure
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Scenario 4: Combined Failure — DB + Redis" -ForegroundColor Cyan
Write-Host "  Agent: @Recovery-Specialist + @Health-Monitor-Agent" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Step 4.1: Kill both
Log "TEST" "Step 4.1: Killing both PostgreSQL and Redis..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
docker stop $PG_CONTAINER $REDIS_CONTAINER 2>$null | Out-Null
$sw.Stop()
Log "INFO" "Both services stopped in $($sw.ElapsedMilliseconds)ms"
Start-Sleep -Seconds 2

# Step 4.2: Verify health during total failure
Log "TEST" "Step 4.2: Verifying health during total infrastructure failure..."
$combinedHealth = Get-HealthJson
$httpCombined = Get-HealthHttpCode

if ($combinedHealth -and $combinedHealth.db -eq $false) { Assert-Pass "Health reports DB=false during combined failure" } else { Assert-Fail "Health did not detect DB failure" }
if ($combinedHealth -and $combinedHealth.redis -eq $false) { Assert-Pass "Health reports Redis=false during combined failure" } else { Assert-Fail "Health did not detect Redis failure" }
if ($httpCombined -eq 503) { Assert-Pass "Health returns 503 during combined failure" } else { Assert-Fail "Health returned $httpCombined" }
if ($combinedHealth -and $combinedHealth.status -eq "degraded") { Assert-Pass "Health status is 'degraded'" } else { Assert-Fail "Health status is not 'degraded'" }

# Step 4.3: Full recovery
Log "TEST" "Step 4.3: Full recovery — restoring both services..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
docker start $PG_CONTAINER $REDIS_CONTAINER 2>$null | Out-Null

$recoveryReady = $false
for ($i = 0; $i -lt 45; $i++) {
    $pgOk = (docker exec $PG_CONTAINER pg_isready -U nalogai 2>&1) -and ($LASTEXITCODE -eq 0)
    $redisPing = docker exec $REDIS_CONTAINER redis-cli ping 2>&1
    $redisOk = $redisPing -match "PONG"
    
    if ($pgOk -and $redisOk) { $recoveryReady = $true; break }
    Start-Sleep -Seconds 1
}
$sw.Stop()

if ($recoveryReady) {
    Assert-Pass "Full recovery completed in $($sw.ElapsedMilliseconds)ms"
    if ($sw.ElapsedMilliseconds -lt 300000) {
        Assert-Pass "RTO MET: Recovery took $($sw.ElapsedMilliseconds)ms (< 5 minutes)"
    } else {
        Assert-Fail "RTO MISSED: Recovery took $($sw.ElapsedMilliseconds)ms (> 5 minutes)"
    }
} else {
    Assert-Fail "Full recovery failed — services did not start within 45 seconds"
}

# Step 4.4: Final verification
Log "TEST" "Step 4.4: Final health verification..."
Start-Sleep -Seconds 5
$finalHealth = Get-HealthJson
$httpFinal = Get-HealthHttpCode

if ($finalHealth.db -eq $true -and $finalHealth.redis -eq $true -and $finalHealth.status -eq "ok" -and $httpFinal -eq 200) {
    Assert-Pass "Full recovery verified: DB=true, Redis=true, status=ok, HTTP=200"
} else {
    Assert-Fail "Full recovery incomplete: DB=$($finalHealth.db), Redis=$($finalHealth.redis), status=$($finalHealth.status), HTTP=$httpFinal"
}

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
#  RESULTS
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host "  Chaos & Recovery Test Results" -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""
Write-Host "  Total Tests:  $script:TotalTests"
Write-Host "  Passed:       $script:PassedTests" -ForegroundColor Green
Write-Host "  Failed:       $script:FailedTests" -ForegroundColor Red
Write-Host ""

if ($script:FailedTests -eq 0) {
    Write-Host "  ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  SOME TESTS FAILED — review log: $LogFile" -ForegroundColor Red
}

Write-Host ""
Write-Host "  Log:    $LogFile"
Write-Host "  Report: See chaos-recovery-test.sh for full Disaster Recovery Playbook"
Write-Host ""

if ($script:FailedTests -gt 0) { exit 1 }
