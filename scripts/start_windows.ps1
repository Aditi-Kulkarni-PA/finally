param([switch]$Build)

$ImageName = "finally"
$ContainerName = "finally-app"
$DataVolume = "finally-data"
$Port = 8000

if ($Build -or !(docker image inspect $ImageName 2>$null)) {
    Write-Host "Building Docker image..."
    docker build -t $ImageName .
}

docker rm -f $ContainerName 2>$null

if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Created .env from .env.example"
}

Write-Host "Starting FinAlly..."
docker run -d `
    --name $ContainerName `
    -v "${DataVolume}:/app/db" `
    -p "${Port}:8000" `
    --env-file .env `
    $ImageName

Write-Host "FinAlly is running at http://localhost:$Port"
Start-Process "http://localhost:$Port"
