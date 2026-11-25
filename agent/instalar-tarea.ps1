<#
.SYNOPSIS
Programa el agente de sincronización con Everything (HU-166, HU-138) en el
Programador de tareas de Windows.

.DESCRIPTION
Crea, o reemplaza, dos tareas en la carpeta -Ruta del Programador de tareas:

«Sincronizar con Everything» (HU-166):
- Una vez al día, a la hora de -Hora.
- «Ejecutar la tarea lo antes posible si se omitió un inicio programado»
  (StartWhenAvailable): si el PC estaba apagado a esa hora, la ejecuta en
  cuanto se enciende y se inicia sesión. Por eso el PC no tiene que estar
  siempre encendido.
- Nunca dos a la vez, y se detiene si pasa de una hora.

«Atender Sincronizar ahora» (HU-138):
- Empieza al iniciar sesión y sigue mientras la sesión está iniciada
  (trackhive-agente.exe --vigilar): pregunta a Trackhive cada minuto si un
  administrador pidió «Sincronizar ahora» y, si hay una sincronización
  pedida, la hace.
- Sin límite de tiempo. Si el programa termina con error, Windows lo vuelve
  a iniciar (hasta 3 veces, cada minuto).
- Queda iniciada al instalarla, sin cerrar sesión (salvo con -SinIniciar).

Las dos corren con el usuario que ejecuta este script y solo mientras tiene
la sesión iniciada, que es cuando Everything está abierto. No guardan
contraseñas ni piden permisos de administrador, y no abren ninguna ventana:
el .exe oculta su consola cuando lo inicia el Programador.

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
    # Hora del día de la sincronización diaria, HH:mm
    [string] $Hora = '12:00',
    [string] $Nombre = 'Sincronizar con Everything',
    [string] $NombreVigilancia = 'Atender Sincronizar ahora',
    [string] $Ruta = '\Trackhive\',
    # No inicia ahora la tarea que atiende «Sincronizar ahora»: empieza en el
    # próximo inicio de sesión
    [switch] $SinIniciar,
    # Elimina las dos tareas en vez de crearlas
    [switch] $Quitar
)

$ErrorActionPreference = 'Stop'

function Get-Tarea([string] $NombreTarea) {
    Get-ScheduledTask -TaskName $NombreTarea -TaskPath $Ruta -ErrorAction SilentlyContinue
}

function Remove-Tarea([string] $NombreTarea) {
    if (Get-Tarea $NombreTarea) {
        Stop-ScheduledTask -TaskName $NombreTarea -TaskPath $Ruta
        Unregister-ScheduledTask -TaskName $NombreTarea -TaskPath $Ruta -Confirm:$false
        Write-Host "Tarea $Ruta$NombreTarea eliminada."
    }
}

if ($Quitar) {
    Remove-Tarea $Nombre
    Remove-Tarea $NombreVigilancia
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

$usuario = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited

# Sincronización diaria (HU-166)
$accion = New-ScheduledTaskAction -Execute $exe -WorkingDirectory $Carpeta
$disparador = New-ScheduledTaskTrigger -Daily -At $inicio
$opciones = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$descripcion = 'Agente de Trackhive (HU-166): envía a Trackhive las carpetas que indexa Everything. ' +
    "Log: $(Join-Path $Carpeta 'logs\agente.log')"

Register-ScheduledTask -TaskName $Nombre -TaskPath $Ruta -Action $accion -Trigger $disparador `
    -Settings $opciones -Principal $principal -Description $descripcion -Force | Out-Null

# «Sincronizar ahora» (HU-138): corre mientras la sesión está iniciada
$accionVigilancia = New-ScheduledTaskAction -Execute $exe -Argument '--vigilar' -WorkingDirectory $Carpeta
$alIniciarSesion = New-ScheduledTaskTrigger -AtLogOn -User $usuario
$opcionesVigilancia = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)
$descripcionVigilancia = 'Agente de Trackhive (HU-138): mientras la sesión está iniciada, pregunta a Trackhive ' +
    'cada minuto si un administrador pidió «Sincronizar ahora» y, si la hay, sincroniza. ' +
    "Log: $(Join-Path $Carpeta 'logs\vigilancia.log')"

# Si ya corría (una instalación anterior), se detiene para que tome el .exe y la configuración de ahora
if (Get-Tarea $NombreVigilancia) {
    Stop-ScheduledTask -TaskName $NombreVigilancia -TaskPath $Ruta
}
Register-ScheduledTask -TaskName $NombreVigilancia -TaskPath $Ruta -Action $accionVigilancia `
    -Trigger $alIniciarSesion -Settings $opcionesVigilancia -Principal $principal `
    -Description $descripcionVigilancia -Force | Out-Null
if (-not $SinIniciar) {
    Start-ScheduledTask -TaskName $NombreVigilancia -TaskPath $Ruta
}

Write-Host "Tarea $Ruta$Nombre programada todos los días a las $Hora para $usuario."
Write-Host 'Si el PC está apagado a esa hora, se ejecuta al encenderlo e iniciar sesión.'
Write-Host "Para probarla ahora: Start-ScheduledTask -TaskPath '$Ruta' -TaskName '$Nombre'"
Write-Host "Resultado de la última ejecución (0 = completa): (Get-ScheduledTaskInfo -TaskPath '$Ruta' -TaskName '$Nombre').LastTaskResult"
if ($SinIniciar) {
    Write-Host "Tarea $Ruta$NombreVigilancia programada: atenderá «Sincronizar ahora» desde el próximo inicio de sesión."
} else {
    Write-Host "Tarea $Ruta$NombreVigilancia iniciada: atiende «Sincronizar ahora» mientras la sesión está iniciada."
}
Write-Host "Su estado (Running = atendiendo): (Get-ScheduledTask -TaskPath '$Ruta' -TaskName '$NombreVigilancia').State"
