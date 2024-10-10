import { Router, Request, Response } from 'express';
import { pool } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { getIo } from '../socket';
import { sendErrorResponse } from '../utils/helpers';

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
    sendErrorResponse(res, 500, 'Failed to start dancefloor.');
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
    sendErrorResponse(res, 500, 'Failed to stop dancefloor.');
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

    if (result.rows.length === 0) {
      return res.status(200).json({ message: 'No song requests found.' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching song requests:', error);
    sendErrorResponse(res, 500, 'Failed to fetch song requests.');
  }
});

// fetch messages for a dancefloor
router.get('/dancefloor/:dancefloorId/messages', async (req: Request, res: Response) => {
  const { dancefloorId } = req.params;

  try {
    const result = await pool.query('SELECT * FROM messages WHERE dancefloor_id = $1 ORDER BY created_at ASC', [dancefloorId]);

    if (result.rows.length === 0) {
      return res.status(200).json({ message: 'No messages found.' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    sendErrorResponse(res, 500, 'Failed to fetch messages.');
  }
});

// fetch dancefloor details
router.get('/dancefloor/:dancefloorId', async (req: Request, res: Response) => {
  const { dancefloorId } = req.params;

  try {
    const dancefloorResult = await pool.query('SELECT * FROM dancefloors WHERE id = $1', [dancefloorId]);
    
    if (dancefloorResult.rows.length === 0) {
      return sendErrorResponse(res, 404, 'Dancefloor not found.');
    }
    
    const dancefloor = dancefloorResult.rows[0];

    // fetch song requests & messages for a dancefloor
    const [songRequestsResult, messagesResult] = await Promise.all([
      pool.query('SELECT * FROM song_requests WHERE dancefloor_id = $1 ORDER BY created_at ASC', [dancefloorId]),
      pool.query('SELECT * FROM messages WHERE dancefloor_id = $1 ORDER BY created_at ASC', [dancefloorId])
    ]);

    res.status(200).json({
      ...dancefloor,
      songRequests: songRequestsResult.rows, // will return an empty array if no records exist
      messages: messagesResult.rows // same here
    });
  } catch (error) {
    console.error('Error fetching dancefloor details:', error);
    sendErrorResponse(res, 500, 'Failed to fetch dancefloor.');
  }
});

export default router;