# Run while the server is up. Creates 3 fresh users each run.
# Coordinates (Delhi): A = origin, B = ~50 m north of A, C = ~500 m north of A.
$base = "http://localhost:5000/api"
$sfx  = Get-Random -Maximum 99999
$latA = 28.6139; $lng = 77.2090
$latB = $latA + 0.00045   # ~50 m
$latC = $latA + 0.0045    # ~500 m
$sa = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$sb = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$sc = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Api($method, $path, $session, $body) {
  $p = @{ Uri = "$base$path"; Method = $method; WebSession = $session; ContentType = "application/json" }
  if ($body) { $p.Body = ($body | ConvertTo-Json) }
  try { Invoke-RestMethod @p } catch { "HTTP " + $_.Exception.Response.StatusCode.value__ + " " + $_.ErrorDetails.Message }
}
function Step($t) { Write-Host "`n$t" -ForegroundColor Cyan }
function Show($r) { if ($r -is [string]) { $r } else { $r | ConvertTo-Json -Depth 6 } }

Step "0) Register users A, B, C"
$ra = Api POST "/auth/register" $sa @{ username="a_$sfx"; email="a_$sfx@example.com"; password="Passw0rdOK"; displayName="Alice" }
$rb = Api POST "/auth/register" $sb @{ username="b_$sfx"; email="b_$sfx@example.com"; password="Passw0rdOK"; displayName="Bob" }
$rc = Api POST "/auth/register" $sc @{ username="c_$sfx"; email="c_$sfx@example.com"; password="Passw0rdOK"; displayName="Carol" }
$idB = $rb.user.id; $idC = $rc.user.id
"A=$($ra.user.id)  B=$idB  C=$idC"

Step "1) Nearby BEFORE sharing location (expect HTTP 409 LOCATION_REQUIRED)"
Show (Api GET "/nearby" $sa)

Step "2) Share locations: A origin, B 50 m away, C 500 m away"
Show (Api POST "/location" $sa @{ lat=$latA; lng=$lng; accuracy=10 })
Show (Api POST "/location" $sb @{ lat=$latB; lng=$lng; accuracy=10 })
Show (Api POST "/location" $sc @{ lat=$latC; lng=$lng; accuracy=10 })

Step "3) A's nearby (expect ONLY Bob, ~50 m)"
Show (Api GET "/nearby" $sa)

Step "4) C's nearby (expect empty list)"
Show (Api GET "/nearby" $sc)

Step "5) Bad inputs (expect 400, 422 LOW_ACCURACY, 422 IMPLAUSIBLE_MOVEMENT)"
Show (Api POST "/location" $sa @{ lat=999; lng=$lng })
Show (Api POST "/location" $sa @{ lat=$latA; lng=$lng; accuracy=5000 })
Show (Api POST "/location" $sa @{ lat=($latA + 1.0); lng=$lng; accuracy=10 })

Step "6) Connections: A -> C (expect 403 NOT_NEARBY), A -> B (expect 201)"
Show (Api POST "/connections" $sa @{ userId=$idC })
$req = Api POST "/connections" $sa @{ userId=$idB }
Show $req

Step "7) B sees incoming request, accepts"
Show (Api GET "/connections" $sb)
Show (Api POST "/connections/$($req.id)/accept" $sb)

Step "8) Rooms: A creates room (expect 201)"
$room = Api POST "/rooms" $sa @{ name="Test Room" }
Show $room
$roomId = $room.room.id

Step "9) B sees room nearby, joins (expect 2 participants)"
Show (Api GET "/rooms" $sb)
Show (Api POST "/rooms/$roomId/join" $sb)

Step "10) C is 500 m away: lists rooms (expect empty) and join (expect 403 OUT_OF_RANGE)"
Show (Api GET "/rooms" $sc)
Show (Api POST "/rooms/$roomId/join" $sc)

Step "11) B walks ~300 m away -> evicted (expect evictedRoomIds contains the room)"
Show (Api POST "/location" $sb @{ lat=($latA + 0.0027); lng=$lng; accuracy=10 })

Step "12) A's room now has only Alice"
Show (Api GET "/rooms/$roomId" $sa)

Step "13) A's audit log"
(Api GET "/audit/me" $sa).logs | Format-Table action, createdAt

Step "14) A clears location (expect empty), then nearby -> 409"
Show (Api DELETE "/location" $sa)
Show (Api GET "/nearby" $sa)