import dotenv from 'dotenv';
import { Pool } from 'pg';

// load env vars
dotenv.config();

// check for DATABASE_URL
const connectionString = process.env.DATABASE_URL;

// create a Pool instance based on whether DATABASE_URL is set
const pool = connectionString 
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }, // required for Heroku Postgres
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      // no SSL configuration for local
    });

pool.on('connect', () => {
  console.log('New jabroni connected to Postgres.');
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle Postgres client:', err);
});

export const connectDB = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Postgres connected successfully, very cool.');
  } catch (error) {
    console.error('Failed to connect to Postgres:', error);
    process.exit(1);
  }
};

export { pool };