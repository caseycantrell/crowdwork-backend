import http from 'http';
import dotenv from 'dotenv';
import { initializeSocket } from './socket';
import app from './app';

// Load environment variables
dotenv.config();

console.log('Backend URL:', process.env.BACKEND_URL);

// Validate that DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set correctly');
}

const PORT = process.env.PORT || 3002;

// Create HTTP server
const server = http.createServer(app);

// Initialize socket.io
initializeSocket(server);

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err: Error) => {
  console.error('Failed to start server:', err);
}).on('close', () => {
  console.log('Server connection closed.');
});

// Handle unhandled rejections and uncaught exceptions
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
