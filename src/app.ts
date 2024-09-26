import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors'
import { Server } from 'socket.io';
import userRoutes from './routes/userRoutes';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import qrcode from 'qrcode'; 
import { v4 as uuidv4 } from 'uuid';

// ensure env vars are loaded first
dotenv.config();

// validate env vars
if (!process.env.DB_USER || !process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_PASSWORD || !process.env.DB_PORT) {
  throw new Error('DB env variables are not set correctly');
}

const app = express();
const PORT = process.env.PORT || 3002;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT as string, 10),
});

pool.on('connect', () => {
  console.log('New client connected to Postgres');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

export const connectDB = async () => {
  try {
    console.log('Attempting to connect to Postgres...');
    await pool.query('SELECT NOW()'); // simple query to check connection
    console.log('Postgres connected successfully');
  } catch (error) {
    console.error('Postgres connection failed:', (error as Error).message);
    console.error('Error stack:', (error as Error).stack);
    process.exit(1); // exit if database connection fails
  }
};

connectDB();

// create HTTP server and socket.io instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:8080',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  },
});

// enable CORS
app.use(cors({
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST'],
  credentials: true
}));

// middleware
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.post('/create-dancefloor', async (req: Request, res: Response) => {
  try {
    const dancefloorId = uuidv4();
    const qrCodeUrl = await qrcode.toDataURL(`http://localhost:${PORT}/dancefloor/${dancefloorId}`)
    return res.json({
      dancefloorId,
      qrCodeUrl
    })
  } catch (error) {
    console.error('Error creating dancefloor:', error)
    res.status(500).send('Failed to create dancefloor')
  }
});


// basic route for now
app.get('/', (req: Request, res: Response) => {
  res.send('hey buddy your server is running...');
});

// socket.io connection handler
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // event: user joins a dancefloor
  socket.on('joinDancefloor', (dancefloorId) => {
    socket.join(dancefloorId);
    console.log(`User ${socket.id} joined dancefloor: ${dancefloorId}`);
    
    // notify others in the dancefloor
    io.to(dancefloorId).emit('message', `User ${socket.id} has joined the dancefloor`);
  });

  // Event: handle messages (this could be used for chat or song requests)
  socket.on('sendMessage', (data) => {
    const { dancefloorId, message } = data;
    console.log(`Message from ${socket.id} in dancefloor ${dancefloorId}: ${message}`);
    
    // broadcast message to others in the dancefloor
    io.to(dancefloorId).emit('message', { userId: socket.id, message });
  });

  // disconnect handler
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.use('/api', userRoutes);

// start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
});

// graceful shutdown for database pool
process.on('SIGINT', async () => {
  await pool.end();
  console.log('Postgres pool has ended');
  process.exit();
});

// handle uncaught exceptions and rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error('Error Stack:', error.stack);
});
