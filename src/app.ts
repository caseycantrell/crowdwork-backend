import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import userRoutes from './routes/userRoutes';

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

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle Postgres client', err);
});

export const connectDB = async () => {
  try {
    console.log('Attempting to connect to Postgres...');
    await pool.query('SELECT NOW()');
    console.log('Postgres connected successfully');
  } catch (error) {
    console.error('Postgres connection failed:', (error as Error).message);
    process.exit(1); 
  }
};

connectDB();

// create HTTP server and socket.io instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

// enable CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'],
  methods: ['GET', 'POST'],
  credentials: true,
}));

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// check for active dancefloor
const checkActiveDancefloorForDj = async (djId: string) => {
  const result = await pool.query('SELECT * FROM dancefloors WHERE dj_id = $1 AND is_active = TRUE', [djId]);
  return result.rows[0] || null;
};

// Start a dancefloor for the DJ
app.post('/start-dancefloor', async (req: Request, res: Response) => {
  const { djId } = req.body;

  try {
    // Deactivate any existing active dancefloor for the DJ
    await pool.query(
      'UPDATE dancefloors SET is_active = FALSE WHERE dj_id = $1 AND is_active = TRUE',
      [djId]
    );

    // Create and activate the new dancefloor
    const dancefloorId = uuidv4();
    await pool.query(
      'INSERT INTO dancefloors (id, dj_id, is_active) VALUES ($1, $2, TRUE)',
      [dancefloorId, djId]
    );

    res.status(200).json({ dancefloorId });
  } catch (error) {
    console.error('Error starting dancefloor:', error);
    res.status(500).send('Failed to start dancefloor');
  }
});

// Stop a dancefloor for the DJ
app.post('/stop-dancefloor', async (req: Request, res: Response) => {
  const { djId } = req.body;

  try {
    // Deactivate any active dancefloor for the DJ
    await pool.query(
      'UPDATE dancefloors SET is_active = FALSE WHERE dj_id = $1 AND is_active = TRUE',
      [djId]
    );

    res.status(200).send('Dancefloor stopped.');
  } catch (error) {
    console.error('Error stopping dancefloor:', error);
    res.status(500).send('Failed to stop dancefloor');
  }
});

// route to check for active dancefloor
app.get('/dj/:djId', async (req: Request, res: Response) => {
  const { djId } = req.params;

  try {
    const activeDancefloor = await checkActiveDancefloorForDj(djId);

    if (activeDancefloor) {
      res.redirect(`/dancefloor/${activeDancefloor.id}`);
    } else {
      res.send('No active dancefloor at the moment.');
    }
  } catch (error) {
    console.error('Error fetching dancefloor:', error);
    res.status(500).send('Error checking dancefloor status.');
  }
});

// route to get dancefloor details
app.get('/dancefloor/:dancefloorId', async (req: Request, res: Response) => {
  const { dancefloorId } = req.params;

  try {
    const result = await pool.query('SELECT * FROM dancefloors WHERE id = $1', [dancefloorId]);

    if (result.rows.length > 0) {
      res.status(200).json(result.rows[0]);
    } else {
      res.status(404).send('Dancefloor not found.');
    }
  } catch (error) {
    console.error('Error fetching dancefloor:', error);
    res.status(500).send('Failed to fetch dancefloor.');
  }
});

// basic route for now
app.get('/', (req: Request, res: Response) => {
  res.send('Server is running...');
});

// socket.io connection handler
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // event: user joins a dancefloor
  socket.on('joinDancefloor', (dancefloorId) => {
    socket.join(dancefloorId);
    console.log(`User ${socket.id} joined dancefloor: ${dancefloorId}`);

    io.to(dancefloorId).emit('message', `User ${socket.id} has joined the dancefloor`);
  });

  // Handle song requests
  socket.on('songRequest', async (data) => {
    const { dancefloorId, song } = data;
    console.log(`Song request from ${socket.id} in dancefloor ${dancefloorId}: ${song}`);

    try {
      const requestId = uuidv4();  // Generate a unique ID for the request
      await pool.query(
        'INSERT INTO song_requests (id, dancefloor_id, user_id, song, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [requestId, dancefloorId, socket.id, song]
      );
      console.log('Song request saved to the database');
    } catch (error) {
      console.error('Error saving song request:', error);
    }

    io.to(dancefloorId).emit('songRequest', { userId: socket.id, song });
  });

  // handle messages
  socket.on('sendMessage', (data) => {
    const { dancefloorId, message } = data;
    console.log(`Message from ${socket.id} in dancefloor ${dancefloorId}: ${message}`);

    // Emit the message to the dancefloor
    io.to(dancefloorId).emit('message', message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.use('/api', userRoutes);

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
