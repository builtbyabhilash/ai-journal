param(
    [int]$Port = 5758
)

Add-Type -AssemblyName System.Net.HttpListener -ErrorAction SilentlyContinue

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\public")).Path
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "Serving $root at $prefix (Ctrl+C to stop)"
Write-Output "NOTE: POST /api/analyze returns a MOCK response here (no real AI call)."
Write-Output "The real AI analysis only runs once deployed to Cloudflare Workers."

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".webmanifest" = "application/manifest+json"
}

$mockAnalysis = @'
{
  "encouragingNote": "Sounds like a full day - thanks for taking a moment to reflect on it. (This is a local mock response - deploy to Cloudflare to get real AI analysis.)",
  "wentWell": [
    "You showed up and wrote down what actually happened, which is the hardest part of journaling.",
    "You noticed both the good and the hard parts of your day instead of only one side."
  ],
  "couldImprove": [
    { "point": "This is a placeholder suggestion since no real AI is connected locally.", "how": "Deploy the app to Cloudflare Workers and set the ANTHROPIC_API_KEY secret to see real, personalized suggestions." }
  ]
}
'@

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    try {
        $path = $req.Url.AbsolutePath

        if ($path -eq "/api/analyze" -and $req.HttpMethod -eq "POST") {
            $bytes = [Text.Encoding]::UTF8.GetBytes($mockAnalysis)
            $res.ContentType = "application/json; charset=utf-8"
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            if ($path -eq "/") { $path = "/index.html" }
            $filePath = Join-Path $root ($path.TrimStart("/") -replace "/", [IO.Path]::DirectorySeparatorChar)

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [IO.Path]::GetExtension($filePath).ToLower()
                $ct = $mime[$ext]
                if (-not $ct) { $ct = "application/octet-stream" }
                $bytes = [IO.File]::ReadAllBytes($filePath)
                $res.ContentType = $ct
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
                $msg = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
                $res.OutputStream.Write($msg, 0, $msg.Length)
            }
        }
    } catch {
        $res.StatusCode = 500
    } finally {
        $res.OutputStream.Close()
    }
}
