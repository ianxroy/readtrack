$text = 'Ang tungkulin ng mga guro ay magturo sa mga mag-aaral at gabayan siya sa kanilang pag-unlad.'
$body = @{
    text = $text
} | ConvertTo-Json

Write-Host "Testing: $text"
Write-Host ""

$response = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/grammar/check' `
    -Method POST `
    -ContentType 'application/json' `
    -Body $body -ErrorAction Stop

$result = $response.Content | ConvertFrom-Json

Write-Host "Total issues: $($result.issues.Count)"
Write-Host "Grammar issues:"
$result.issues | Where-Object { $_.type -eq 'grammar' } | ForEach-Object {
    Write-Host "  Rule: $($_.rule_id)"
    Write-Host "  Message: $($_.message)"
    Write-Host "  At text: $($text.Substring($_.offset, $_.length))"
    Write-Host ""
}

Write-Host ""
Write-Host "Score: $($result.score)"
