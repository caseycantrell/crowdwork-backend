import { Router, Request, Response } from 'express';
import { pool } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { getIo } from '../socket';

const router = Router();

// Start a dancefloor
router.post('/start-dancefloor', async (req: Request, res: Response) => {
  const { djId } = req.body;

  try {
    // set the status of any existing active dancefloor to 'completed'
    await pool.query(
      "UPDATE dancefloors SET status = 'completed' WHERE dj_id = $1 AND status = 'active'",
      [djId]
    );

    const dancefloorId = uuidv4();
    
    // create a new active dancefloor
    await pool.query(
      'INSERT INTO dancefloors (id, dj_id, status, created_at) VALUES ($1, $2, $3, NOW())',
      [dancefloorId, djId, 'active']
    );

    res.status(200).json({ dancefloorId });
  } catch (error) {
    console.error('Error starting dancefloor:', error);
    res.status(500).json({ error: 'Failed to start dancefloor' });
  }
});

// stop a dancefloor
router.post('/stop-dancefloor', async (req: Request, res: Response) => {
  const { djId } = req.body;

  try {
    // set the active dancefloor's status to 'completed'
    await pool.query(
      "UPDATE dancefloors SET status = 'completed', end_time = NOW() WHERE dj_id = $1 AND status = 'active'",
      [djId]
    );

    res.status(200).json({ message: 'Dancefloor stopped.' });
  } catch (error) {
    console.error('Error stopping dancefloor:', error);
    res.status(500).json({ error: 'Failed to stop dancefloor' });
  }
});

// send a message
router.post('/dancefloor/:dancefloorId/message', async (req: Request, res: Response): Promise<void> => {
  const { dancefloorId } = req.params;
  const { message } = req.body;
  const io = getIo();

  // enforce character limit
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

// fetch all song requests for a dancefloor
router.get('/dancefloor/:dancefloorId/song-requests', async (req: Request, res: Response) => {
  const { dancefloorId } = req.params;

  try {
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
router.get('/dancefloor/:dancefloorId/messages', async (req: Request, res: Response) => {
  const { dancefloorId } = req.params;

  try {
    const result = await pool.query('SELECT * FROM messages WHERE dancefloor_id = $1 ORDER BY created_at ASC', [dancefloorId]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// fetch dancefloor details
router.get('/dancefloor/:dancefloorId', async (req: Request, res: Response) => {
  const { dancefloorId } = req.params;

  try {
    const dancefloorResult = await pool.query('SELECT * FROM dancefloors WHERE id = $1', [dancefloorId]);
    
    if (dancefloorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dancefloor not found.' });
    }
    
    const dancefloor = dancefloorResult.rows[0];

    // fetch song requests & messages for a dancefloor
    const [songRequestsResult, messagesResult] = await Promise.all([
      pool.query('SELECT * FROM song_requests WHERE dancefloor_id = $1 ORDER BY created_at ASC', [dancefloorId]),
      pool.query('SELECT * FROM messages WHERE dancefloor_id = $1 ORDER BY created_at ASC', [dancefloorId])
    ]);

    if (songRequestsResult.rows.length === 0) {
      console.log("No song requests found for this dancefloor.");
    }
    if (messagesResult.rows.length === 0) {
      console.log("No messages found for this dancefloor.");
    }

    res.status(200).json({
      ...dancefloor,
      songRequests: songRequestsResult.rows,
      messages: messagesResult.rows,
    });
  } catch (error) {
    console.error('Error fetching dancefloor details:', error);
    res.status(500).json({ error: 'Failed to fetch dancefloor.' });
  }
});

export default router;