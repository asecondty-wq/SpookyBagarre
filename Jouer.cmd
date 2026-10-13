@echo off
rem Lance le serveur local de spookyBagarre et ouvre le jeu dans le navigateur.
cd /d "%~dp0"
set PY=
where python >nul 2>nul && set PY=python
if not defined PY where py >nul 2>nul && set PY=py
if not defined PY if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" set PY="%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not defined PY (
  echo Python est introuvable. Installe-le depuis https://www.python.org puis relance ce fichier.
  pause
  exit /b 1
)
start "" http://localhost:8642
%PY% tools\serve.py 8642
