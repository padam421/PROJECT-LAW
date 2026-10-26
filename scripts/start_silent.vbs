Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.Run "cmd.exe /c """ & strDir & "\run_ai_service.bat""", 0, False
WScript.Sleep 2000
WshShell.Run "cmd.exe /c """ & strDir & "\run_backend.bat""", 0, False
