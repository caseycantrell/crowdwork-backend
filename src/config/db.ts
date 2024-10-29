import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Log DATABASE_URL to verify it's being read correctly
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  throw new Error('DB env variables are not set correctly');
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },  // Required for Heroku Postgres
});

pool.on('connect', () => {
  console.log('New jabroni connected to Postgres');
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle Postgres client', err);
});

export const connectDB = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Postgres connected successfully.');
  } catch (error) {
    console.error('Failed to connect to Postgres:', error);
    process.exit(1);
  }
};