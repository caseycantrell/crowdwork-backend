import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendErrorResponse } from '../utils/helpers';
import { getIo } from '../socket';

// update the status of a song request
export const updateSongRequestStatus = async (req: Request, res: Response): Promise<void> => {
    const io = getIo();
    const { requestId } = req.params;
    const { status } = req.body;

    if (!['queued', 'playing', 'completed', 'declined'].includes(status)) {
        sendErrorResponse(res, 400, 'Invalid status value.');
        return;
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let dancefloorId: string;

        const result = await client.query(
            'SELECT dancefloor_id FROM song_requests WHERE id = $1',
            [requestId]
        );

        if (result.rows.length === 0) {
            sendErrorResponse(res, 404, 'Song request not found.');
            await client.query('ROLLBACK'); // rollback on failure
            return;
        };

        dancefloorId = result.rows[0].dancefloor_id;

        // if the new status is "playing", update the currently playing song to "queued"
        if (status === 'playing') {
            const currentlyPlaying = await client.query(
                'SELECT id FROM song_requests WHERE status = $1 AND dancefloor_id = $2 FOR UPDATE',
                ['playing', dancefloorId]
            );

            if (currentlyPlaying.rows.length > 0) {
                const playingSongId = currentlyPlaying.rows[0].id;
                await client.query(
                    'UPDATE song_requests SET status = $1 WHERE id = $2',
                    ['queued', playingSongId]
                );
            };
        };

        // update the status of the requested song
        await client.query(
            'UPDATE song_requests SET status = $1 WHERE id = $2',
            [status, requestId]
        );

        await client.query('COMMIT');

        // emit the status update to the relevant dancefloor room after commit
        io.to(dancefloorId).emit('statusUpdate', { requestId, status });

        res.status(200).json({ message: `Song request marked as ${status}.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error updating song status to ${status}:`, error);
        sendErrorResponse(res, 500, 'Failed to update song status.');
    } finally {
        client.release();
    };
};

// update the order of song requests
export const reorderSongRequests = async (req: Request, res: Response): Promise<void> => {
    const { dancefloorId } = req.params;
    const { order } = req.body; // expecting an array of { requestId, newOrder }

    try {
        for (const { requestId, newOrder } of order) {
            await pool.query(
                'UPDATE song_requests SET "order" = $1 WHERE id = $2 AND dancefloor_id = $3',
                [newOrder, requestId, dancefloorId]
            );
        };

        res.status(200).json({ message: 'Song requests reordered successfully.' });
    } catch (error) {
        console.error('Error reordering song requests:', error);
        sendErrorResponse(res, 500, 'Failed to reorder song requests.');
    };
};

 // like a song request
export const likeSongRequest = async (req: Request, res: Response): Promise<void> => {
    const { requestId } = req.params;

    try {
        await pool.query(
            'UPDATE song_requests SET likes = likes + 1 WHERE id = $1',
            [requestId]
        );

        const result = await pool.query(
            'SELECT likes FROM song_requests WHERE id = $1',
            [requestId]
        );
        const updatedLikes = result.rows[0].likes;

        res.status(200).json({ message: 'Like added successfully.', likes: updatedLikes });
    } catch (error) {
        console.error('Error processing like:', error);
        sendErrorResponse(res, 500, 'Failed to like song request.');
    };
};