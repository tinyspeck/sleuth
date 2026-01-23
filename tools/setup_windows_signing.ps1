# Windows Signing Setup Script
# Installs and configures Java, jsign, and AWS credentials for KMS-based code signing

Write-Host "=== Setting up Windows signing environment ==="

# Refresh PATH to get current machine state
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Install Java if not present
Write-Host "Checking for Java installation..."
$javaCheck = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaCheck) {
    Write-Host "Java not found, installing via Chocolatey..."
    choco install openjdk17 -y --no-progress

    # Refresh PATH after installation
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Verify Java
Write-Host "Verifying Java installation..."
java -version
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Java installation failed"
    exit 1
}

# Install jsign if not present
Write-Host "Checking for jsign installation..."
$jsignCheck = Get-Command jsign -ErrorAction SilentlyContinue
if (-not $jsignCheck) {
    Write-Host "jsign not found, installing via Chocolatey..."
    choco install jsign -y --no-progress

    # Refresh PATH after installation
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Verify jsign
Write-Host "Verifying jsign installation..."
jsign --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: jsign installation failed"
    exit 1
}

# Set machine-level PATH so subsequent steps can find these tools
$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
[System.Environment]::SetEnvironmentVariable("Path", $machinePath, "Machine")

# Setup AWS credentials from EC2 instance metadata
Write-Host "=== Setting up AWS credentials ==="

function Set-AWSCredentials {
    $token = Invoke-RestMethod -Uri "http://169.254.169.254/latest/api/token" -Method PUT -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"}
    $roleName = Invoke-RestMethod -Uri "http://169.254.169.254/latest/meta-data/iam/security-credentials/" -Method Get -Headers @{"X-aws-ec2-metadata-token" = $token}
    $creds = Invoke-RestMethod -Uri "http://169.254.169.254/latest/meta-data/iam/security-credentials/$roleName" -Method Get -Headers @{"X-aws-ec2-metadata-token" = $token}

    $env:AWS_ACCESS_KEY_ID = $creds.AccessKeyId
    $env:AWS_SECRET_ACCESS_KEY = $creds.SecretAccessKey
    $env:AWS_SESSION_TOKEN = $creds.Token
    $env:AWS_DEFAULT_REGION = "us-east-1"

    Write-Host "Validating role credentials"
    aws sts get-caller-identity
}

function Set-AWSProfile {
    try {
        Write-Host "Setting AWS profile..."
        Set-AWSCredentials
        aws configure set region "us-east-1"
        aws configure set profile code-signing
        aws configure set aws_access_key_id $env:AWS_ACCESS_KEY_ID --profile code-signing
        aws configure set aws_secret_access_key $env:AWS_SECRET_ACCESS_KEY --profile code-signing
        aws configure set aws_session_token $env:AWS_SESSION_TOKEN --profile code-signing
        Write-Host "AWS profile configured"
        aws configure list
    }
    catch {
        Write-Host "Error while setting AWS profile: $($_.Exception.Message)"
    }
}

Set-AWSProfile
Write-Host "=== Windows signing setup complete ==="
