import { Server } from 'socket.io';
import { pool } from './config/db';
import { v4 as uuidv4 } from 'uuid';

let io: Server;

export const initializeSocket = (server: any) => {
  const allowedOrigin = process.env.CORS_ORIGIN;

  if (!allowedOrigin) {
    throw new Error('CORS_ORIGIN environment variable is not set.');
  }
  
  io = new Server(server, {
    cors: {
      origin: allowedOrigin,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    socket.on('joinDancefloor', (dancefloorId) => {
      if (!dancefloorId) {
        console.error('No dancefloorId provided');
        return;
      }

      socket.join(dancefloorId);
      console.log(`User ${socket.id} joined dancefloor: ${dancefloorId}`);
      io.to(dancefloorId).emit('message', `User ${socket.id} has joined the dancefloor`);
    });

    // handle new song requests
    socket.on('songRequest', async (data) => {
      const { dancefloorId, song } = data;

      if (!dancefloorId || !song) {
        console.error('Missing dancefloorId or song');
        return;
      }

      console.log(`Song request from ${socket.id} in dancefloor ${dancefloorId}: ${song}`);

      try {
        const requestId = uuidv4();

        await pool.query(
          'INSERT INTO song_requests (id, dancefloor_id, user_id, song, created_at, status) VALUES ($1, $2, $3, $4, NOW(), $5)',
          [requestId, dancefloorId, socket.id, song, 'queued']
        );

        // increment and fetch requests count
        const result = await pool.query(
          'UPDATE dancefloors SET requests_count = requests_count + 1 WHERE id = $1 RETURNING requests_count',
          [dancefloorId]
        );

        const requestsCount = result.rows[0].requests_count;

        // emit new song request and updated count
        io.to(dancefloorId).emit('songRequest', { id: requestId, song, likes: 0, status: 'queued' });
        io.to(dancefloorId).emit('updateRequestsCount', { requestsCount });

      } catch (error) {
        console.error('Error saving song request:', error);
      }
    });

    // handle messages
    socket.on('sendMessage', async (data) => {
      const { dancefloorId, message, djId } = data;
    
      if (!dancefloorId || !message) {
        console.error('Missing dancefloorId or message');
        return;
      }
    
      if (message.length > 300) {
        socket.emit('messageError', { message: 'Message exceeds maximum length of 300 characters.' });
        return;
      }
    
      try {
        const result = await pool.query(
          'INSERT INTO messages (dancefloor_id, message, dj_id, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
          [dancefloorId, message, djId || null]
        );
    
        const newMessage = result.rows[0];
    
        // increment and fetch messages count
        const countResult = await pool.query(
          'UPDATE dancefloors SET messages_count = messages_count + 1 WHERE id = $1 RETURNING messages_count',
          [dancefloorId]
        );
    
        const messagesCount = countResult.rows[0].messages_count;
    
        // emit new message and updated count to all users in the dancefloor
        io.to(dancefloorId).emit('sendMessage', newMessage);
        io.to(dancefloorId).emit('updateMessagesCount', { messagesCount });
    
      } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('messageError', { message: 'Failed to send message.' });
      }
    });
    

    // handle status updates
    socket.on('statusUpdate', async (data) => {
      const { requestId, status, dancefloorId } = data;

      if (!requestId || !status || !dancefloorId) {
        console.error('Missing requestId, status, or dancefloorId');
        return;
      }

      if (!['queued', 'playing', 'completed', 'declined'].includes(status)) {
        socket.emit('statusUpdateError', { message: 'Invalid status value.' });
        return;
      }

      try {
        await pool.query(
          'UPDATE song_requests SET status = $1 WHERE id = $2',
          [status, requestId]
        );

        // emit status update event to all clients
        io.to(dancefloorId).emit('statusUpdate', { requestId, status });

        console.log(`Status of request ${requestId} changed to ${status}`);
      } catch (error) {
        console.error('Error updating song request status:', error);
        socket.emit('statusUpdateError', { message: 'Failed to update song status.' });
      }
    });

    // handle liking a song request
    socket.on('likeSongRequest', async (data) => {
      const { requestId, dancefloorId } = data;

      if (!requestId || !dancefloorId) {
        console.error('Missing requestId or dancefloorId');
        return;
      }

      try {
        // increment likes count
        await pool.query(
          'UPDATE song_requests SET likes = likes + 1 WHERE id = $1',
          [requestId]
        );

        // fetch updated likes count
        const result = await pool.query(
          'SELECT likes FROM song_requests WHERE id = $1',
          [requestId]
        );
        const updatedLikes = result.rows[0].likes;

        // emit updated likes to all users in the dancefloor
        io.to(dancefloorId).emit('likeSongRequest', { requestId, likes: updatedLikes });
        console.log(`Song request ${requestId} liked. Total likes: ${updatedLikes}`);
      } catch (error) {
        console.error('Error processing like:', error);
        socket.emit('likeError', { message: 'Failed to like song request.' });
      }
    });

    
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIo = () => io;