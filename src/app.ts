import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import { connectDB, pool } from './config/db';
import djRoutes from './routes/djRoutes';
import sessionRoutes from './routes/sessionRoutes';
import dancefloorRoutes from './routes/dancefloorRoutes';
import songRequestRoutes from './routes/songRequestRoutes'
import { initializeSocket } from './socket';

// ensure env vars are loaded first
dotenv.config();

// Validate env vars
if (!process.env.DB_USER || !process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_PASSWORD || !process.env.DB_PORT) {
  throw new Error('DB env variables are not set correctly');
}

const app = express();
const PORT = process.env.PORT || 3002;

connectDB();

// enable CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secure_secret_key', // Use a secure secret key
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something is stored
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day expiration
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
  }
}));

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use('/api', djRoutes);
app.use('/api', sessionRoutes);
app.use('/api', dancefloorRoutes);
app.use('/api', songRequestRoutes);

// create HTTP server and initialize socket.io
const server = http.createServer(app);
initializeSocket(server); 

// start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err: Error) => {
  console.error('Failed to start server:', err);
});

// graceful shutdown for database pool
process.on('SIGINT', async () => {
  await pool.end();
  console.log('Postgres pool has ended');
  process.exit();
});

// handle uncaught exceptions and rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error.message);
  console.error('Error Stack:', error.stack);
});
