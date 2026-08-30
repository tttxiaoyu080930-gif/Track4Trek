param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [Parameter(Mandatory = $true)]
  [string]$DestinationPath,

  [Parameter(Mandatory = $true)]
  [string]$RouteName
)

$ErrorActionPreference = "Stop"
$namespace = "http://www.topografix.com/GPX/1/1"

$document = [System.Xml.XmlDocument]::new()
$document.PreserveWhitespace = $false
$document.Load($SourcePath)

$namespaceManager = [System.Xml.XmlNamespaceManager]::new($document.NameTable)
$namespaceManager.AddNamespace("g", $namespace)

$destinationDirectory = Split-Path -Parent $DestinationPath
if ($destinationDirectory) {
  [System.IO.Directory]::CreateDirectory($destinationDirectory) | Out-Null
}

$settings = [System.Xml.XmlWriterSettings]::new()
$settings.Encoding = [System.Text.UTF8Encoding]::new($false)
$settings.Indent = $true
$settings.NewLineChars = "`n"
$settings.NewLineHandling = [System.Xml.NewLineHandling]::Replace

$writer = [System.Xml.XmlWriter]::Create($DestinationPath, $settings)

function Write-RoutePoint {
  param(
    [System.Xml.XmlWriter]$Writer,
    [System.Xml.XmlElement]$Point,
    [string]$ElementName,
    [System.Xml.XmlNamespaceManager]$NamespaceManager,
    [string]$Namespace
  )

  $Writer.WriteStartElement($ElementName, $Namespace)
  $Writer.WriteAttributeString("lat", $Point.GetAttribute("lat"))
  $Writer.WriteAttributeString("lon", $Point.GetAttribute("lon"))

  $elevation = $Point.SelectSingleNode("g:ele", $NamespaceManager)
  if ($null -ne $elevation -and -not [string]::IsNullOrWhiteSpace($elevation.InnerText)) {
    $Writer.WriteElementString("ele", $Namespace, $elevation.InnerText.Trim())
  }

  $Writer.WriteEndElement()
}

try {
  $writer.WriteStartDocument()
  $writer.WriteStartElement("gpx", $namespace)
  $writer.WriteAttributeString("version", "1.1")
  $writer.WriteAttributeString("creator", "Track4Trek sample library")

  $writer.WriteStartElement("metadata", $namespace)
  $writer.WriteElementString("name", $namespace, $RouteName)
  $writer.WriteEndElement()

  $tracks = $document.SelectNodes("//g:trk", $namespaceManager)
  $trackIndex = 0
  foreach ($track in $tracks) {
    $trackIndex += 1
    $writer.WriteStartElement("trk", $namespace)
    $trackName = if ($tracks.Count -gt 1) { "$RouteName $trackIndex" } else { $RouteName }
    $writer.WriteElementString("name", $namespace, $trackName)

    foreach ($segment in $track.SelectNodes("g:trkseg", $namespaceManager)) {
      $writer.WriteStartElement("trkseg", $namespace)
      foreach ($point in $segment.SelectNodes("g:trkpt", $namespaceManager)) {
        Write-RoutePoint -Writer $writer -Point $point -ElementName "trkpt" -NamespaceManager $namespaceManager -Namespace $namespace
      }
      $writer.WriteEndElement()
    }

    $writer.WriteEndElement()
  }

  $routes = $document.SelectNodes("//g:rte", $namespaceManager)
  $routeIndex = 0
  foreach ($route in $routes) {
    $routeIndex += 1
    $writer.WriteStartElement("rte", $namespace)
    $routeLabel = if ($routes.Count -gt 1) { "$RouteName $routeIndex" } else { $RouteName }
    $writer.WriteElementString("name", $namespace, $routeLabel)

    foreach ($point in $route.SelectNodes("g:rtept", $namespaceManager)) {
      Write-RoutePoint -Writer $writer -Point $point -ElementName "rtept" -NamespaceManager $namespaceManager -Namespace $namespace
    }

    $writer.WriteEndElement()
  }

  $writer.WriteEndElement()
  $writer.WriteEndDocument()
}
finally {
  $writer.Dispose()
}
