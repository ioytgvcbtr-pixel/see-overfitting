import os
import subprocess
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[1]


def test_chinese_start_script_has_bom_for_windows_powershell_51():
    assert (ROOT/'scripts/start.ps1').read_bytes().startswith(b'\xef\xbb\xbf')


@pytest.mark.skipif(os.name!='nt',reason='Windows PowerShell parser')
def test_start_script_parses_in_windows_powershell_51():
    result=subprocess.run(['powershell.exe','-NoProfile','-Command',
        "$tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/start.ps1'),[ref]$tokens,[ref]$errors); if ($errors.Count) { $errors | ForEach-Object { $_.Message }; exit 1 }"],
        cwd=ROOT,capture_output=True,text=True)
    assert result.returncode==0,result.stdout+result.stderr
