#!/bin/bash

# Start the Socket.io server
echo "Starting Socket.io server..."
node socket-server.js &
SOCKET_PID=$!

# Start the Next.js app
echo "Starting Next.js app..."
npm run dev &
NEXT_PID=$!

# Handle termination
trap "kill $SOCKET_PID $NEXT_PID; exit" SIGINT SIGTERM

# Wait for both processes
wait $SOCKET_PID $NEXT_PID 