@echo off
echo ===================================================
echo 🚀 Starting Social Pivot on Windows Localhost...
echo ===================================================

echo.
echo 📦 Checking backend dependencies...
cd backend
call npm install
echo 🗄️ Setting up Database...
call npx prisma generate
call npx prisma db push
cd ..

echo.
echo 📦 Checking frontend dependencies...
cd frontend
call npm install
cd ..

echo.
echo 🌐 Starting Backend on port 3001...
start "Social Pivot Backend" cmd /c "cd backend && npm run start:dev"

echo.
echo 💻 Starting Frontend on port 3000...
start "Social Pivot Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo ✅ Application is launching in separate windows!
echo ➡️  Frontend: http://localhost:3000
echo ➡️  Backend: http://localhost:3001
echo ⚠️  Keep the new terminal windows open to keep the application running.
echo.
pause
