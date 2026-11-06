# Run while `npm run dev` is active in server\. Uses a web session to keep the auth cookie.
$base = "http://localhost:5000/api"
$sfx = Get-Random -Maximum 99999
$sfx = Get-Random -Maximum 99999
$json = @{ username="alice_$sfx"; email="alice_$sfx@example.com"; password="Passw0rdOK"; displayName="Alice" } | ConvertTo-Json

Write-Host "`n1) Register" -ForegroundColor Cyan
Invoke-RestMethod "$base/auth/register" -Method Post -Body $json -ContentType "application/json" -SessionVariable s

Write-Host "`n2) Duplicate register (expect 409)" -ForegroundColor Cyan
try { Invoke-RestMethod "$base/auth/register" -Method Post -Body $json -ContentType "application/json" } catch { $_.Exception.Response.StatusCode.value__ }

Write-Host "`n3) Weak password (expect 400)" -ForegroundColor Cyan
$weak = @{ username="bob_1"; email="bob@example.com"; password="short"; displayName="Bob" } | ConvertTo-Json
try { Invoke-RestMethod "$base/auth/register" -Method Post -Body $weak -ContentType "application/json" } catch { $_.Exception.Response.StatusCode.value__ }

Write-Host "`n4) GET /users/me with cookie" -ForegroundColor Cyan
Invoke-RestMethod "$base/users/me" -WebSession $s

Write-Host "`n5) PATCH profile" -ForegroundColor Cyan
Invoke-RestMethod "$base/users/me" -Method Patch -WebSession $s -ContentType "application/json" -Body (@{ bio="Hello from ProxiSpeak"; avatarColor="#22c55e" } | ConvertTo-Json)

Write-Host "`n6) Mass-assignment attempt (expect 400)" -ForegroundColor Cyan
try { Invoke-RestMethod "$base/users/me" -Method Patch -WebSession $s -ContentType "application/json" -Body (@{ email="evil@x.com" } | ConvertTo-Json) } catch { $_.Exception.Response.StatusCode.value__ }

Write-Host "`n7) Wrong password (expect 401)" -ForegroundColor Cyan
try { Invoke-RestMethod "$base/auth/login" -Method Post -ContentType "application/json" -Body (@{ identifier="alice_$sfx"; password="nope" } | ConvertTo-Json) } catch { $_.Exception.Response.StatusCode.value__ }

Write-Host "`n8) Unauthenticated /users/me (expect 401)" -ForegroundColor Cyan
try { Invoke-RestMethod "$base/users/me" } catch { $_.Exception.Response.StatusCode.value__ }

Write-Host "`n9) Audit log" -ForegroundColor Cyan
(Invoke-RestMethod "$base/audit/me" -WebSession $s).logs | Format-Table action, createdAt

Write-Host "`n10) Logout (expect 204 / empty)" -ForegroundColor Cyan
Invoke-RestMethod "$base/auth/logout" -Method Post -WebSession $s


