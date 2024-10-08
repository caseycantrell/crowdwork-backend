import dotenv from 'dotenv';
import { Pool } from 'pg';

// load environment variables from .env
dotenv.config();

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT as string, 10),
});

pool.on('connect', () => {
  console.log('New jabroni connected to Postgres');
});

pool.on('error', (err: Error) => {
  console.error('Oh goodness, an unexpected error on idle Postgres client', err);
});

export const connectDB = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Postgres connected successfully, which is tight.');
  } catch (error) {
    console.error('Oh lawd the Postgres connection failed:', error);
    process.exit(1); 
  }
};
