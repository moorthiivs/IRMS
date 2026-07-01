@echo off
echo Building the application...
call npm run build:all

echo Creating deployment zip file (this may take a moment)...
powershell -Command "Compress-Archive -Path .\dist, .\client, .\prisma, .\package.json, .\package-lock.json, .\tsconfig.json, .\tsconfig.build.json -DestinationPath deploy.zip -Force"

echo.
echo ========================================================
echo Done! 
echo A file named 'deploy.zip' has been created in your backend folder.
echo.
echo You can now upload 'deploy.zip' directly to Azure using the portal (Advanced Tools / Kudu) or VS Code.
echo ========================================================
