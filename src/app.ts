import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { connectDB } from './config/db';
import djRoutes from './routes/djRoutes';
import sessionRoutes from './routes/sessionRoutes';
import dancefloorRoutes from './routes/dancefloorRoutes';
import songRequestRoutes from './routes/songRequestRoutes';
import dotenv from 'dotenv'

// ensure env vars are loaded first
dotenv.config();

const app = express();

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
  secret: process.env.SESSION_SECRET || 'your_secure_secret_key',
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something is stored
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day expiration
    secure: process.env.NODE_ENV === 'production', // use secure cookies in production
    httpOnly: true, // prevents client-side javascript from accessing the cookie
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

export default app;