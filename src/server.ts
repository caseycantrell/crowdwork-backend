import http from 'http';
import dotenv from 'dotenv';
import { pool } from './config/db';
import { initializeSocket } from './socket';
import app from './app';  // Import Express app from app.ts

// load env vars
dotenv.config();

// validate required env vars
if (!process.env.DB_USER || !process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_PASSWORD || !process.env.DB_PORT) {
  throw new Error('DB env variables are not set correctly');
}

const PORT = process.env.PORT || 3002;

// Create HTTP server
const server = http.createServer(app);

// initialize socket.io
initializeSocket(server);

// start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  }).on('error', (err: Error) => {
    console.error('Failed to start server:', err);
  }).on('close', () => {
    console.log('Server connection closed.');
  });
  
  // handle unhandled rejections and uncaught exceptions
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
  
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error.message);
    console.error('Error Stack:', error.stack);
  });
  
  process.on('exit', (code) => {
    console.log(`Process exited with code: ${code}`);
  });