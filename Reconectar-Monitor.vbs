Option Explicit
' No arguments from a web URI are read or executed.
Dim shell, files, root, node, candidate, folder, environment, starter, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
Set environment = shell.Environment("PROCESS")
root = files.GetParentFolderName(WScript.ScriptFullName)
starter = files.BuildPath(root, "Iniciar-Monitor.mjs")
node = environment("CODEX_MONITOR_NODE")
If Len(node) = 0 Then
  For Each folder In Split(environment("PATH"), ";")
    folder = Replace(Trim(folder), Chr(34), "")
    If Len(folder) > 0 Then
      candidate = files.BuildPath(folder, "node.exe")
      If files.FileExists(candidate) Then
        node = candidate
        Exit For
      End If
    End If
  Next
End If
If Len(node) = 0 Then WScript.Quit 1
If Not files.FileExists(node) Then WScript.Quit 1
command = Chr(34) & node & Chr(34) & " " & Chr(34) & starter & Chr(34)
shell.Run command, 0, False
