import { Router, Request, Response } from 'express';
import { pool } from '../config/db';
import { getIo } from '../socket';
import { sendErrorResponse } from '../utils/helpers';

const router = Router();

// update the status of a song request
router.put('/song-request/:requestId/status', async (req: Request, res: Response): Promise<void> => {
    const { requestId } = req.params;
    const { status } = req.body; // expecting 'queued', 'playing', 'declined' or 'completed'
  
    // check for valid statuses
    if (!['queued', 'playing', 'completed', 'declined'].includes(status)) {
      sendErrorResponse(res, 400, 'Invalid status value.')
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
      sendErrorResponse(res, 500, 'Failed to update song request status.')
    }
  });
  
  // update the order of song requests
  router.put('/dancefloor/:dancefloorId/reorder', async (req: Request, res: Response) => {
    const { dancefloorId } = req.params;
    const { order } = req.body; // expecting an array of { requestId, newOrder }
  
    try {
      for (const { requestId, newOrder } of order) {
        await pool.query(
          'UPDATE song_requests SET "order" = $1 WHERE id = $2 AND dancefloor_id = $3',
          [newOrder, requestId, dancefloorId]
        );
      }
  
      res.status(200).json({ message: 'Song requests reordered successfully.' });
    } catch (error) {
      console.error('Error reordering song requests:', error);
      sendErrorResponse(res, 500, 'Failed to reorder song requests.')
    }
  });
  
  // vote for a song request
  router.put('/song-request/:requestId/vote', async (req: Request, res: Response): Promise<void> => {
    const { requestId } = req.params;
  
    try {
      // Increment the vote count for the song request
      await pool.query(
        'UPDATE song_requests SET votes = votes + 1 WHERE id = $1',
        [requestId]
      );
  
      // Fetch the updated vote count and return it
      const result = await pool.query('SELECT votes FROM song_requests WHERE id = $1', [requestId]);
      const updatedVotes = result.rows[0].votes;
  
      res.status(200).json({ message: 'Vote added successfully.', votes: updatedVotes });
    } catch (error) {
      console.error('Error processing vote:', error);
      sendErrorResponse(res, 500, 'Failed to add vote.')
    }
  });
  
  
  // start playing a song
  router.put('/song-request/:requestId/play', async (req: Request, res: Response): Promise<void> => {
    const io = getIo();
    const { requestId } = req.params;
  
    try {
      // Find the dancefloor ID of the request so we can emit the event to the correct room
      const dancefloorResult = await pool.query(
        'SELECT dancefloor_id FROM song_requests WHERE id = $1',
        [requestId]
      );
  
      if (dancefloorResult.rows.length === 0) {
        sendErrorResponse(res, 404, 'Song request not found.')
        return;
      }
  
      const dancefloorId = dancefloorResult.rows[0].dancefloor_id;
  
      // find the currently playing song and set it back to 'queued'
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
      // set the selected song to 'playing'
      await pool.query('UPDATE song_requests SET status = $1 WHERE id = $2', ['playing', requestId]);
  
      // emit the update to the frontend for the specific dancefloor
      io.to(dancefloorId).emit('statusUpdate', { requestId, status: 'playing' });
  
      res.status(200).json({ message: 'Song is now playing.' });
    } catch (error) {
      console.error('Error updating song status to playing:', error);
      sendErrorResponse(res, 500, 'Failed to update song status.')
    }
  });
  
  
  // mark a song as completed
  router.put('/song-request/:requestId/complete', async (req: Request, res: Response) => {
    const { requestId } = req.params;
  
    try {
      await pool.query(
        'UPDATE song_requests SET status = $1 WHERE id = $2',
        ['completed', requestId]
      );
      res.status(200).json({ message: 'Song has been marked as completed.' });
    } catch (error) {
      console.error('Error updating song status to completed:', error);
      sendErrorResponse(res, 500, 'Failed to update song status.');
    }
  });
  
  // decline a song request
  router.put('/song-request/:requestId/decline', async (req: Request, res: Response) => {
    const { requestId } = req.params;
  
    try {
      await pool.query('UPDATE song_requests SET status = $1 WHERE id = $2', ['declined', requestId]);
      res.status(200).json({ message: 'Song request declined successfully.' });
    } catch (error) {
      console.error('Error declining song request:', error);
      sendErrorResponse(res, 500, 'Failed to decline song request.')
    }
  });

export default router;
