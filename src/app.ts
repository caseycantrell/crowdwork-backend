import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import djRoutes from './routes/djRoutes';
import authRoutes from './routes/authRoutes';
import dancefloorRoutes from './routes/dancefloorRoutes';
import songRequestRoutes from './routes/songRequestRoutes';

// load env vars
dotenv.config();

const app = express();

// trust the first proxy (Heroku)
app.set('trust proxy', 1);

connectDB();

// CORS config
if (!process.env.CORS_ORIGIN) {
  throw new Error('CORS_ORIGIN environment variable is not set.');
}

const corsOptions = {
  origin: (origin: any, callback: any) => {
    if (!origin || origin === process.env.CORS_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS.'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // allows cookies and headers for cross-origin
};

// apply CORS globally
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // allow all OPTIONS requests for CORS preflight

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use('/api', djRoutes);
app.use('/api', authRoutes);
app.use('/api', dancefloorRoutes);
app.use('/api', songRequestRoutes);

export default app;