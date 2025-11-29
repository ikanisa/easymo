# Windows Code Signing Configuration
# ====================================

## Requirements
1. Extended Validation (EV) Code Signing Certificate
   - Provider: DigiCert, Sectigo, or similar CA
   - Cost: ~$500/year
   - Requires: Company verification, hardware token

2. Certificate Installation
   - Install certificate to Windows Certificate Store
   - Note the thumbprint (40-character hex string)

## Build Configuration

### Option 1: SignTool (Recommended for CI/CD)
```powershell
# Set environment variables
$env:WINDOWS_CERTIFICATE_THUMBPRINT="YOUR_CERT_THUMBPRINT"
$env:WINDOWS_SIGNING_PASSWORD="YOUR_PASSWORD"

# Build with signing
tauri build
```

### Option 2: Manual Signing
```powershell
# After build, sign manually
signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 `
  /sha1 YOUR_CERT_THUMBPRINT `
  "target\release\EasyMO Admin.exe"
```

## SmartScreen Reputation
- New certificates will trigger SmartScreen warnings
- Reputation builds over time (100+ downloads)
- Consider EV certificate for immediate trust

## Testing
```powershell
# Verify signature
signtool verify /pa /v "target\release\EasyMO Admin.exe"
```

## Installer Customization
Located in: `src-tauri/tauri.conf.json`

```json
{
  "bundle": {
    "windows": {
      "wix": {
        "language": "en-US",
        "template": "installer-template.wxs"
      },
      "nsis": {
        "license": "LICENSE.rtf",
        "headerImage": "installer-header.bmp",
        "sidebarImage": "installer-sidebar.bmp"
      }
    }
  }
}
```

## GitHub Actions Integration
```yaml
- name: Sign Windows Binary
  if: matrix.os == 'windows-latest'
  env:
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE_BASE64 }}
    WINDOWS_PASSWORD: ${{ secrets.WINDOWS_PASSWORD }}
  run: |
    # Import certificate
    $cert = [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE)
    [IO.File]::WriteAllBytes("cert.pfx", $cert)
    
    # Sign binary
    signtool sign /f cert.pfx /p $env:WINDOWS_PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 "target\release\EasyMO Admin.exe"
```
