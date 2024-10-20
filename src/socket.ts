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
          [requestId, dancefloorId, socket.id, song, 'queued']
        );
    
        // increment requests_count
        await pool.query(
          'UPDATE dancefloors SET requests_count = requests_count + 1 WHERE id = $1',
          [dancefloorId]
        );
    
        // fetch the updated requests_count value
        const result = await pool.query(
          'SELECT requests_count FROM dancefloors WHERE id = $1',
          [dancefloorId]
        );
        const requestsCount = result.rows[0].requests_count;
    
        // emit the new song request and updated count to all clients
        io.to(dancefloorId).emit('songRequest', { id: requestId, song, votes: 0, status: 'queued' });
        io.to(dancefloorId).emit('updateRequestsCount', { requestsCount });
      } catch (error) {
        console.error('Error saving song request:', error);
      }
    });

    // handle messages
    socket.on('sendMessage', async (data) => {
      const { dancefloorId, message } = data;
    
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
    
        // increment messages_count
        await pool.query(
          'UPDATE dancefloors SET messages_count = messages_count + 1 WHERE id = $1',
          [dancefloorId]
        );
    
        // fetch the updated messages_count value
        const countResult = await pool.query(
          'SELECT messages_count FROM dancefloors WHERE id = $1',
          [dancefloorId]
        );
        const messagesCount = countResult.rows[0].messages_count;
    
        // emit the new message and updated count to all clients
        io.to(dancefloorId).emit('sendMessage', newMessage);
        io.to(dancefloorId).emit('updateMessagesCount', { messagesCount });
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