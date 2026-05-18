@echo off
where mvn >nul 2>nul
if %errorlevel%==0 (
    mvn %*
) else (
    echo Maven yuklu degil. Yuklemek icin:
    echo   Windows: https://maven.apache.org/download.cgi
    echo.
    echo Veya IntelliJ IDEA kullan - Maven'i otomatik yonetir.
    exit /b 1
)
