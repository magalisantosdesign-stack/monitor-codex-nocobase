# Firefox places its native host in a job. The fixed launcher must break away
# so the collector survives the short-lived native messaging invocation.
function Start-MonitorOutsideJob {
  param([string]$NodePath, [string]$LauncherPath, [string]$WorkingDirectory)
  if(-not ('CodexMonitorBreakaway' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class CodexMonitorBreakaway {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
 struct StartupInfo { public int cb; public string reserved, desktop, title; public uint x,y,xSize,ySize,xChars,yChars,fill,flags; public ushort show,reserved2Size; public IntPtr reserved2,input,output,error; }
 [StructLayout(LayoutKind.Sequential)]
 struct ProcessInfo { public IntPtr process,thread; public uint processId,threadId; }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 static extern bool CreateProcess(string application,StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inherit,uint flags,IntPtr environment,string directory,ref StartupInfo startup,out ProcessInfo process);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 public static int Start(string node,string launcher,string directory) {
  var startup=new StartupInfo(); startup.cb=Marshal.SizeOf(startup);
  ProcessInfo process;
  // CREATE_BREAKAWAY_FROM_JOB | CREATE_NO_WINDOW; handles are not inherited.
  if(!CreateProcess(node,new StringBuilder("\""+node+"\" \""+launcher+"\""),IntPtr.Zero,IntPtr.Zero,false,0x01000000|0x08000000,IntPtr.Zero,directory,ref startup,out process)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  try {
   if(WaitForSingleObject(process.process,35000)!=0) throw new TimeoutException();
   uint code; if(!GetExitCodeProcess(process.process,out code)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
   return unchecked((int)code);
  } finally { CloseHandle(process.thread); CloseHandle(process.process); }
 }
}
'@
  }
  return [CodexMonitorBreakaway]::Start($NodePath,$LauncherPath,$WorkingDirectory)
}
