#!/bin/bash

# Social Pivot Startup Script

echo "🚀 Starting Social Pivot..."

# Check dependencies
echo "📦 Installing backend dependencies..."
cd backend && npm install
echo "📦 Installing frontend dependencies..."
cd ../frontend && npm install

# Database Setup
echo "🗄️ Setting up Database..."
cd ../backend
npx prisma generate
npx prisma db push

# Create dummy data if needed? No.

# Start Backend
echo "🌐 Starting Backend on port 3001..."
npm run start:dev &
BACKEND_PID=$!

# Start Frontend
echo "💻 Starting Frontend on port 3000..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "✅ App is running!"
echo "➡️  Frontend: http://localhost:3000"
echo "➡️  Backend: http://localhost:3001"
echo "⚠️  Ensure Redis is running for the Scheduler to work!"

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT

wait
