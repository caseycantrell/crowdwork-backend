import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import userRoutes from './routes/userRoutes';
import session from 'express-session';
import bcrypt from 'bcrypt';
import sessionRoutes from './routes/sessionRoutes'

// ensure env vars are loaded first
dotenv.config();

// validate env vars
if (!process.env.DB_USER || !process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_PASSWORD || !process.env.DB_PORT) {
  throw new Error('DB env variables are not set correctly');
}

// declare module 'express-session' {
//   interface SessionData {
//     dj: { id: number; name: string; email: string };
//   }
// }

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
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add the session middleware
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

// authentication middleware
function isAuthenticated(req: Request, res: Response, next: Function) {
  if (req.session.dj) {
    return next(); // If DJ is logged in, proceed
  } else {
    return res.status(401).json({ message: 'Unauthorized access, please log in first' });
  }
}

// check for active dancefloor
const checkActiveDancefloorForDj = async (djId: string) => {
  const result = await pool.query('SELECT * FROM dancefloors WHERE dj_id = $1 AND is_active = TRUE', [djId]);
  return result.rows[0] || null;
};

// start a dancefloor
app.post('/api/start-dancefloor', async (req: Request, res: Response) => {
  const { djId } = req.body;
  console.log('Starting dancefloor for DJ:', djId);

  try {
    // deactivate any existing active dancefloor
    await pool.query(
      'UPDATE dancefloors SET is_active = FALSE WHERE dj_id = $1 AND is_active = TRUE',
      [djId]
    );

    // create and activate the new dancefloor
    const dancefloorId = uuidv4();
    await pool.query(
      'INSERT INTO dancefloors (id, dj_id, is_active) VALUES ($1, $2, TRUE)',
      [dancefloorId, djId]
    );

    res.status(200).json({ dancefloorId });
  } catch (error) {
    console.error('Error starting dancefloor:', error);
    res.status(500).json({ error: 'Failed to start dancefloor' });
  }
});

// stop a dancefloor
app.post('/api/stop-dancefloor', async (req: Request, res: Response) => {
  const { djId } = req.body;

  try {
    // deactivate any active dancefloor
    await pool.query(
      'UPDATE dancefloors SET is_active = FALSE WHERE dj_id = $1 AND is_active = TRUE',
      [djId]
    );

    res.status(200).json({ message: 'Dancefloor stopped.' });
  } catch (error) {
    console.error('Error stopping dancefloor:', error);
    res.status(500).json({ error: 'Failed to stop dancefloor' });
  }
});

// save message
app.post('/api/dancefloor/:dancefloorId/message', async (req: Request, res: Response): Promise<void> => {
  const { dancefloorId } = req.params;
  const { message } = req.body;

  // Enforce character limit
  if (message.length > 300) {
    res.status(400).json({ error: 'Message exceeds maximum length of 300 characters.' });
    return;
  }

  try {
    await pool.query(
      'INSERT INTO messages (dancefloor_id, message, created_at) VALUES ($1, $2, NOW())',
      [dancefloorId, message]
    );

    // emit the message to the dancefloor so that all users can see it
    io.to(dancefloorId).emit('message', message);

    res.status(200).json({ message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// login route
app.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // query the db to find the DJ by email
    const result = await pool.query('SELECT id, name, email, password FROM djs WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const dj = result.rows[0];

    // const isPasswordValid = password === dj.password;
    const isPasswordValid = await bcrypt.compare(password, dj.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // store DJ info in the session
    req.session.dj = { id: dj.id, name: dj.name, email: dj.email };

    res.status(200).json({
      message: 'Logged in successfully',
      dj: { id: dj.id, name: dj.name, email: dj.email }, // sending DJ details to the frontend
    });
    
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// logout route
app.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ message: 'Failed to log out' });
    }
    res.clearCookie('connect.sid'); // Clears the session cookie
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

// signup route
app.post('/signup', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if the DJ already exists
    const existingDJ = await pool.query('SELECT * FROM djs WHERE email = $1', [email]);
    if (existingDJ.rows.length > 0) {
      return res.status(400).json({ message: 'DJ with this email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new DJ into the database
    const result = await pool.query(
      'INSERT INTO djs (name, email, password) VALUES ($1, $2, $3) RETURNING id',
      [name, email, hashedPassword]
    );

    const newDjId = result.rows[0].id;

    // auto-login the new DJ by setting the session
    req.session.dj = { id: newDjId, name, email };

    // send back success with the DJ info to redirect to their DJ page
    res.status(201).json({
      message: 'DJ registered and logged in successfully.',
      djId: newDjId, // send the new DJ's ID for frontend redirect
    });
  } catch (error) {
    console.error('Error registering DJ:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});



// check for active dancefloor
app.get('/api/dj/:djId', async (req: Request, res: Response) => {
  const { djId } = req.params;

  try {
    const activeDancefloor = await checkActiveDancefloorForDj(djId);

    if (activeDancefloor) {
      res.status(200).json({ id: activeDancefloor.id, is_active: true });
    } else {
      res.status(200).json({ is_active: false });
    }
  } catch (error) {
    console.error('Error fetching dancefloor:', error);
    res.status(500).json({ error: 'Error checking dancefloor status' });
  }
});

// get dancefloor details
app.get('/api/dancefloor/:dancefloorId', async (req: Request, res: Response) => {
  const { dancefloorId } = req.params;

  try {
    const result = await pool.query('SELECT * FROM dancefloors WHERE id = $1', [dancefloorId]);

    if (result.rows.length > 0) {
      res.status(200).json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Dancefloor not found.' });
    }
  } catch (error) {
    console.error('Error fetching dancefloor:', error);
    res.status(500).json({ error: 'Failed to fetch dancefloor.' });
  }
});

// fetch all DJs
app.get('/api/djs', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM djs');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching DJs:', error);
    res.status(500).json({ error: 'Failed to fetch DJs.' });
  }
});

// fetch all song requests for a dancefloor
app.get('/api/dancefloor/:dancefloorId/song-requests', async (req: Request, res: Response) => {
  const { dancefloorId } = req.params;

  try {
    // get song requests ordered by votes (descending) and creation time (ascending)
    const result = await pool.query(
      'SELECT * FROM song_requests WHERE dancefloor_id = $1 ORDER BY votes DESC, created_at ASC',
      [dancefloorId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching song requests:', error);
    res.status(500).json({ error: 'Failed to fetch song requests.' });
  }
});

// fetch messages for a dancefloor
app.get('/api/dancefloor/:dancefloorId/messages', async (req: Request, res: Response) => {
  const { dancefloorId } = req.params;

  try {
    const result = await pool.query('SELECT * FROM messages WHERE dancefloor_id = $1 ORDER BY created_at ASC', [dancefloorId]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// protected route
app.get('/api/protected', isAuthenticated, (req: Request, res: Response) => {
  res.status(200).json({ message: 'You have accessed a protected route' });
});

// update the status of a song request
app.put('/api/song-request/:requestId/status', async (req: Request, res: Response): Promise<void> => {
  const { requestId } = req.params;
  const { status } = req.body; // expecting 'queued', 'playing', or 'completed'

  // check for valid statuses
  if (!['queued', 'playing', 'completed'].includes(status)) {
    res.status(400).json({ error: 'Invalid status value.' });
    return;
  }

  try {
    await pool.query(
      'UPDATE song_requests SET status = $1 WHERE id = $2',
      [status, requestId]
    );
    res.status(200).json({ message: 'Song request status updated.' });
  } catch (error) {
    console.error('Error updating song request status:', error);
    res.status(500).json({ error: 'Failed to update song request status.' });
  }
});

// update the order of song requests
app.put('/api/dancefloor/:dancefloorId/reorder', async (req: Request, res: Response) => {
  const { dancefloorId } = req.params;
  const { order } = req.body; // expecting an array of { requestId, newOrder }

  try {
    // loop through the array and update the order for each song request
    for (const { requestId, newOrder } of order) {
      await pool.query(
        'UPDATE song_requests SET "order" = $1 WHERE id = $2 AND dancefloor_id = $3',
        [newOrder, requestId, dancefloorId]
      );
    }

    res.status(200).json({ message: 'Song requests reordered successfully.' });
  } catch (error) {
    console.error('Error reordering song requests:', error);
    res.status(500).json({ error: 'Failed to reorder song requests.' });
  }
});

// vote for a song request
app.put('/api/song-request/:requestId/vote', async (req: Request, res: Response): Promise<void> => {
  const { requestId } = req.params;
  const { userId } = req.body;

  try {
    // check if the user has already voted for this request
    const existingVote = await pool.query(
      'SELECT * FROM votes WHERE user_id = $1 AND song_request_id = $2',
      [userId, requestId]
    );

    if (existingVote.rows.length > 0) {
      res.status(400).json({ error: 'You have already voted for this song request.' });
      return;
    }

    // if no existing vote, insert the vote into the `votes` table
    await pool.query(
      'INSERT INTO votes (user_id, song_request_id) VALUES ($1, $2)',
      [userId, requestId]
    );

    // increment the vote count for the song request
    await pool.query(
      'UPDATE song_requests SET votes = votes + 1 WHERE id = $1',
      [requestId]
    );

    // fetch the updated vote count and return it
    const result = await pool.query('SELECT votes FROM song_requests WHERE id = $1', [requestId]);
    const updatedVotes = result.rows[0].votes;

    res.status(200).json({ message: 'Vote added successfully.', votes: updatedVotes });
  } catch (error) {
    console.error('Error processing vote:', error);
    res.status(500).json({ error: 'Failed to add vote.' });
  }
});

// start playing a song
app.put('/api/song-request/:requestId/play', async (req: Request, res: Response): Promise<void> => {
  const { requestId } = req.params;

  try {
    // Find the dancefloor ID of the request so we can emit the event to the correct room
    const dancefloorResult = await pool.query(
      'SELECT dancefloor_id FROM song_requests WHERE id = $1',
      [requestId]
    );

    if (dancefloorResult.rows.length === 0) {
      res.status(404).json({ error: 'Song request not found.' });
      return;
    }

    const dancefloorId = dancefloorResult.rows[0].dancefloor_id;

    // Find the currently playing song and set it back to 'queued'
    const currentlyPlaying = await pool.query(
      'SELECT id FROM song_requests WHERE status = $1 AND dancefloor_id = $2 FOR UPDATE',
      ['playing', dancefloorId]
    );

    if (currentlyPlaying.rows.length > 0) {
      const playingSongId = currentlyPlaying.rows[0].id;
      console.log(`Setting song ${playingSongId} back to queued`);
      await pool.query('UPDATE song_requests SET status = $1 WHERE id = $2', ['queued', playingSongId]);
    }

    console.log(`Setting song ${requestId} to playing`);
    // Set the selected song to 'playing'
    await pool.query('UPDATE song_requests SET status = $1 WHERE id = $2', ['playing', requestId]);

    // Emit the update to the frontend for the specific dancefloor
    io.to(dancefloorId).emit('statusUpdate', { requestId, status: 'playing' });

    res.status(200).json({ message: 'Song is now playing.' });
  } catch (error) {
    console.error('Error updating song status to playing:', error);
    res.status(500).json({ error: 'Failed to update song status.' });
  }
});


// mark a song as completed
app.put('/api/song-request/:requestId/complete', async (req: Request, res: Response) => {
  const { requestId } = req.params;

  try {
    await pool.query(
      'UPDATE song_requests SET status = $1 WHERE id = $2',
      ['completed', requestId]
    );
    res.status(200).json({ message: 'Song has been marked as completed.' });
  } catch (error) {
    console.error('Error updating song status to completed:', error);
    res.status(500).json({ error: 'Failed to update song status.' });
  }
});

// decline a song request
app.put('/api/song-request/:requestId/decline', async (req: Request, res: Response) => {
  const { requestId } = req.params;

  try {
    await pool.query('UPDATE song_requests SET status = $1 WHERE id = $2', ['declined', requestId]);
    res.status(200).json({ message: 'Song request declined successfully.' });
  } catch (error) {
    console.error('Error declining song request:', error);
    res.status(500).json({ error: 'Failed to decline song request.' });
  }
});

// route for testing server
app.get('/', (req: Request, res: Response) => {
  res.send('Your server is running breh...');
});

// socket.io connection handler
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Event: user joins a dancefloor
  socket.on('joinDancefloor', (dancefloorId) => {
    socket.join(dancefloorId);
    console.log(`User ${socket.id} joined dancefloor: ${dancefloorId}`);

    io.to(dancefloorId).emit('message', `User ${socket.id} has joined the dancefloor`);
  });

// handle song requests
socket.on('songRequest', async (data) => {
  const { dancefloorId, song } = data;
  console.log(`Song request from ${socket.id} in dancefloor ${dancefloorId}: ${song}`);

  try {
    const requestId = uuidv4();  // Generate a unique ID for the request
    await pool.query(
      'INSERT INTO song_requests (id, dancefloor_id, user_id, song, created_at, status) VALUES ($1, $2, $3, $4, NOW(), $5)',
      [requestId, dancefloorId, socket.id, song, 'queued'] // Set status to 'queued'
    );
    console.log('Song request saved to the database');

    // Emit the song request to the dancefloor
    io.to(dancefloorId).emit('songRequest', { id: requestId, song, votes: 0, status: 'queued' });
  } catch (error) {
    console.error('Error saving song request:', error);
  }
});


  // handle messages
  socket.on('sendMessage', (data) => {
    const { dancefloorId, message } = data;
    console.log(`Message from ${socket.id} in dancefloor ${dancefloorId}: ${message}`);

    // emit the message to the dancefloor
    io.to(dancefloorId).emit('message', message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// apply user routes
app.use('/api', userRoutes);

// spply session routes
app.use('/api', sessionRoutes);

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