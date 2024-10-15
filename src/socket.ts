import { Server } from 'socket.io';
import { pool } from './config/db';
import { v4 as uuidv4 } from 'uuid';

let io: Server;

export const initializeSocket = (server: any) => {
  io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // event: user joins a dancefloor
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
        const requestId = uuidv4();
        await pool.query(
          'INSERT INTO song_requests (id, dancefloor_id, user_id, song, created_at, status) VALUES ($1, $2, $3, $4, NOW(), $5)',
          [requestId, dancefloorId, socket.id, song, 'queued'] // set status to 'queued'
        );
        console.log('Song request saved to the database');

        // emit the song request to the dancefloor
        io.to(dancefloorId).emit('songRequest', { id: requestId, song, votes: 0, status: 'queued' });
      } catch (error) {
        console.error('Error saving song request:', error);
      }
    });

    // handle messages
    socket.on('sendMessage', async (data) => {
      const { dancefloorId, message } = data;
    
      // check character limit
      if (message.length > 300) {
        socket.emit('messageError', { message: 'Message exceeds maximum length of 300 characters.' });
        return;
      }
    
      try {
        const result = await pool.query(
          'INSERT INTO messages (dancefloor_id, message, created_at) VALUES ($1, $2, NOW()) RETURNING *',
          [dancefloorId, message]
        );
    
        const newMessage = result.rows[0];
    
        io.to(dancefloorId).emit('sendMessage', newMessage);
    
      } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('messageError', { message: 'Failed to send message.' });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
};

export const getIo = () => io;