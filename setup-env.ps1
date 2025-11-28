# PowerShell script to create .env file for VoxBox Frontend

$envContent = @"
# API Configuration
# Backend API URL - default is http://localhost:3000/api/v1
VITE_API_URL=http://localhost:3000/api/v1
"@

$envPath = Join-Path $PSScriptRoot ".env"

if (Test-Path $envPath) {
    Write-Host "⚠️  .env file already exists at: $envPath" -ForegroundColor Yellow
    $response = Read-Host "Do you want to overwrite it? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "❌ Setup cancelled" -ForegroundColor Red
        exit
    }
}

Set-Content -Path $envPath -Value $envContent
Write-Host "✅ .env file created successfully at: $envPath" -ForegroundColor Green
Write-Host "📝 Content:" -ForegroundColor Cyan
Write-Host $envContent
Write-Host ""
Write-Host "🎉 You can now start the development server with: npm run dev" -ForegroundColor Green

