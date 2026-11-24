<#
.SYNOPSIS
Programa el agente de sincronización con Everything (HU-166) en el
Programador de tareas de Windows.

.DESCRIPTION
Crea, o reemplaza, la tarea \Trackhive\Sincronizar con Everything:

- Una vez al día, a la hora de -Hora.
- «Ejecutar la tarea lo antes posible si se omitió un inicio programado»
  (StartWhenAvailable): si el PC estaba apagado a esa hora, la ejecuta en
  cuanto se enciende y se inicia sesión. Por eso el PC no tiene que estar
  siempre encendido.
- Con el usuario que ejecuta este script y solo mientras tiene la sesión
  iniciada, que es cuando Everything está abierto. No guarda contraseñas ni
  pide permisos de administrador.
- Sin ventana: el .exe oculta su consola cuando lo inicia el Programador.
- Nunca dos a la vez, y se detiene si pasa de una hora.

Guía completa: docs/manual-operacion.md, sección 10.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\instalar-tarea.ps1

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\instalar-tarea.ps1 -Hora 13:30

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\instalar-tarea.ps1 -Quitar
#>
[CmdletBinding()]
param(
    # Carpeta con trackhive-agente.exe y agente.toml (por defecto, la de este script)
    [string] $Carpeta = $PSScriptRoot,
    # Hora del día, HH:mm
    [string] $Hora = '12:00',
    [string] $Nombre = 'Sincronizar con Everything',
    [string] $Ruta = '\Trackhive\',
    # Elimina la tarea en vez de crearla
    [switch] $Quitar
)

$ErrorActionPreference = 'Stop'

if ($Quitar) {
    Unregister-ScheduledTask -TaskName $Nombre -TaskPath $Ruta -Confirm:$false
    Write-Host "Tarea $Ruta$Nombre eliminada."
    return
}

$Carpeta = (Resolve-Path -LiteralPath $Carpeta).Path
$exe = Join-Path $Carpeta 'trackhive-agente.exe'
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
    throw "No se encontró $exe"
}
if (-not (Test-Path -LiteralPath (Join-Path $Carpeta 'agente.toml') -PathType Leaf)) {
    throw "Falta agente.toml en ${Carpeta}: copia agente.example.toml como agente.toml y complétalo"
}
$inicio = [datetime]::ParseExact($Hora, [string[]] @('HH:mm', 'H:mm'), [Globalization.CultureInfo]::InvariantCulture, 'None')

$accion = New-ScheduledTaskAction -Execute $exe -WorkingDirectory $Carpeta
$disparador = New-ScheduledTaskTrigger -Daily -At $inicio
$opciones = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$usuario = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
$descripcion = 'Agente de Trackhive (HU-166): envía a Trackhive las carpetas que indexa Everything. ' +
    "Log: $(Join-Path $Carpeta 'logs\agente.log')"

Register-ScheduledTask -TaskName $Nombre -TaskPath $Ruta -Action $accion -Trigger $disparador `
    -Settings $opciones -Principal $principal -Description $descripcion -Force | Out-Null

Write-Host "Tarea $Ruta$Nombre programada todos los días a las $Hora para $usuario."
Write-Host 'Si el PC está apagado a esa hora, se ejecuta al encenderlo e iniciar sesión.'
Write-Host "Para probarla ahora: Start-ScheduledTask -TaskPath '$Ruta' -TaskName '$Nombre'"
Write-Host "Resultado de la última ejecución (0 = completa): (Get-ScheduledTaskInfo -TaskPath '$Ruta' -TaskName '$Nombre').LastTaskResult"
