import { Request, Response } from 'express';
import { pool } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { sendErrorResponse } from '../utils/helpers';

// start a dancefloor
export const startDancefloor = async (req: Request, res: Response) => {
    const { djId } = req.body;

    try {
        await pool.query(
            "UPDATE dancefloors SET status = 'completed' WHERE dj_id = $1 AND status = 'active'",
            [djId]
        );

        const dancefloorId = uuidv4();

        await pool.query(
            'INSERT INTO dancefloors (id, dj_id, status, created_at) VALUES ($1, $2, $3, NOW())',
            [dancefloorId, djId, 'active']
        );

        res.status(200).json({ dancefloorId });
    } catch (error) {
        console.error('Error starting dancefloor:', error);
        sendErrorResponse(res, 500, 'Failed to start dancefloor.');
    }
};

// stop a dancefloor
export const stopDancefloor = async (req: Request, res: Response) => {
    const { id } = req.body;

    try {
        await pool.query(
            "UPDATE dancefloors SET status = 'completed', ended_at = NOW() WHERE dj_id = $1 AND status = 'active'",
            [id]
        );

        res.status(200).json({ message: 'Dancefloor stopped.' });
    } catch (error) {
        console.error('Error stopping dancefloor:', error);
        sendErrorResponse(res, 500, 'Failed to stop dancefloor.');
    }
};

// fetch dancefloor & DJ info
export const getDancefloorDetails = async (req: Request, res: Response) => {
    const { dancefloorId } = req.params;

    try {
        const dancefloorResult = await pool.query(
            'SELECT * FROM dancefloors WHERE id = $1',
            [dancefloorId]
        );

        if (dancefloorResult.rows.length === 0) {
            return sendErrorResponse(res, 404, 'Dancefloor not found.');
        }

        const dancefloor = dancefloorResult.rows[0];

        // fetch song requests, messages, and DJ info in parallel
        const [songRequestsResult, messagesResult, djResult] = await Promise.all([
            pool.query(
                'SELECT * FROM song_requests WHERE dancefloor_id = $1 ORDER BY created_at ASC',
                [dancefloorId]
            ),
            pool.query(
                'SELECT * FROM messages WHERE dancefloor_id = $1 ORDER BY created_at ASC',
                [dancefloorId]
            ),
            pool.query(
                'SELECT * FROM djs WHERE id = $1',
                [dancefloor.dj_id]
            )
        ]);

        if (djResult.rows.length === 0) {
            return sendErrorResponse(res, 404, 'DJ not found.');
        }

        const djInfo = djResult.rows[0];

        res.status(200).json({
            ...dancefloor,
            songRequests: songRequestsResult.rows,
            messages: messagesResult.rows,
            dj: djInfo,
        });
    } catch (error) {
        console.error('Error fetching dancefloor details:', error);
        sendErrorResponse(res, 500, 'Failed to fetch dancefloor details.');
    }
};

// reactivate a past dancefloor
export const reactivateDancefloor = async (req: Request, res: Response) => {
    const { dancefloorId } = req.params;

    try {
        // set any currently active dancefloor status to "completed"
        await pool.query(
            "UPDATE dancefloors SET status = 'completed', ended_at = NOW() WHERE status = 'active'"
        );

        // reactivate the selected past dancefloor
        await pool.query(
            "UPDATE dancefloors SET status = 'active', ended_at = NULL WHERE id = $1",
            [dancefloorId]
        );

        res.status(200).json({ message: 'Dancefloor reactivated successfully.' });
    } catch (error) {
        console.error('Error reactivating dancefloor:', error);
        sendErrorResponse(res, 500, 'Failed to reactivate dancefloor.');
    }
};

// delete a dancefloor
export const deleteDancefloor = async (req: Request, res: Response) => {
    const { dancefloorId } = req.params;

    try {
        await pool.query('BEGIN');

        // delete associated song requests
        await pool.query(
            'DELETE FROM song_requests WHERE dancefloor_id = $1',
            [dancefloorId]
        );

        // delete associated messages
        await pool.query(
            'DELETE FROM messages WHERE dancefloor_id = $1',
            [dancefloorId]
        );

        // delete the dancefloor
        await pool.query(
            'DELETE FROM dancefloors WHERE id = $1',
            [dancefloorId]
        );

        await pool.query('COMMIT');

        res.status(200).json({ message: 'Dancefloor deleted successfully.' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error deleting dancefloor:', error);
        sendErrorResponse(res, 500, 'Failed to delete dancefloor.');
    }
};