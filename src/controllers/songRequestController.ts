import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendErrorResponse } from '../utils/helpers';
import { getIo } from '../socket';

// update the status of a song request
export const updateSongRequestStatus = async (req: Request, res: Response): Promise<void> => {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!['queued', 'playing', 'completed', 'declined'].includes(status)) {
        sendErrorResponse(res, 400, 'Invalid status value.');
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
        sendErrorResponse(res, 500, 'Failed to update song request status.');
    }
};

// update the order of song requests
export const reorderSongRequests = async (req: Request, res: Response): Promise<void> => {
    const { dancefloorId } = req.params;
    const { order } = req.body; // Expecting an array of { requestId, newOrder }

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
        sendErrorResponse(res, 500, 'Failed to reorder song requests.');
    }
};

 // vote for a song request
export const voteForSongRequest = async (req: Request, res: Response): Promise<void> => {
    const { requestId } = req.params;

    try {
        await pool.query(
            'UPDATE song_requests SET votes = votes + 1 WHERE id = $1',
            [requestId]
        );

        const result = await pool.query(
            'SELECT votes FROM song_requests WHERE id = $1',
            [requestId]
        );
        const updatedVotes = result.rows[0].votes;

        res.status(200).json({ message: 'Vote added successfully.', votes: updatedVotes });
    } catch (error) {
        console.error('Error processing vote:', error);
        sendErrorResponse(res, 500, 'Failed to add vote.');
    }
};

// start playing a song
export const playSongRequest = async (req: Request, res: Response): Promise<void> => {
    const io = getIo();
    const { requestId } = req.params;

    try {
        const dancefloorResult = await pool.query(
            'SELECT dancefloor_id FROM song_requests WHERE id = $1',
            [requestId]
        );

        if (dancefloorResult.rows.length === 0) {
            sendErrorResponse(res, 404, 'Song request not found.');
            return;
        }

        const dancefloorId = dancefloorResult.rows[0].dancefloor_id;

        const currentlyPlaying = await pool.query(
            'SELECT id FROM song_requests WHERE status = $1 AND dancefloor_id = $2 FOR UPDATE',
            ['playing', dancefloorId]
        );

        if (currentlyPlaying.rows.length > 0) {
            const playingSongId = currentlyPlaying.rows[0].id;
            await pool.query('UPDATE song_requests SET status = $1 WHERE id = $2', ['queued', playingSongId]);
        }

        await pool.query('UPDATE song_requests SET status = $1 WHERE id = $2', ['playing', requestId]);

        io.to(dancefloorId).emit('statusUpdate', { requestId, status: 'playing' });

        res.status(200).json({ message: 'Song is now playing.' });
    } catch (error) {
        console.error('Error updating song status to playing:', error);
        sendErrorResponse(res, 500, 'Failed to update song status.');
    }
};

// mark a song as completed
export const completeSongRequest = async (req: Request, res: Response): Promise<void> => {
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
};

// decline a song request
export const declineSongRequest = async (req: Request, res: Response): Promise<void> => {
    const { requestId } = req.params;

    try {
        await pool.query(
            'UPDATE song_requests SET status = $1 WHERE id = $2',
            ['declined', requestId]
        );
        res.status(200).json({ message: 'Song request declined successfully.' });
    } catch (error) {
        console.error('Error declining song request:', error);
        sendErrorResponse(res, 500, 'Failed to decline song request.');
    }
};