import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendErrorResponse } from '../utils/helpers';

// function to check the active dancefloor for a DJ
const checkActiveDancefloorForDj = async (djId: string) => {
    try {
        const result = await pool.query(
            "SELECT * FROM dancefloors WHERE dj_id = $1 AND status = 'active'",
            [djId]
        );
        console.log('Active Dancefloor Check:', result.rows);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error checking active dancefloor:', error);
        throw new Error('Failed to check active dancefloor.');
    }
};

// fetch all DJs
export const getAllDJs = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM djs');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching DJs:', error);
        sendErrorResponse(res, 500, 'Failed to fetch DJs.');
    }
};

// fetch DJ info and check for active dancefloor
export const getDjInfo = async (req: Request, res: Response) => {
    const { djId } = req.params;

    try {
        const djResult = await pool.query(
            'SELECT qr_code, name, bio, website, instagram_handle, twitter_handle, venmo_handle, cashapp_handle FROM djs WHERE id = $1',
            [djId]
        );

        if (djResult.rows.length === 0) {
            return sendErrorResponse(res, 404, 'DJ not found');
        }

        const {
            qr_code: qrCode,
            name,
            bio,
            website,
            instagram_handle,
            twitter_handle,
            venmo_handle,
            cashapp_handle,
        } = djResult.rows[0];

        const activeDancefloor = await checkActiveDancefloorForDj(djId);
        const isActive = !!activeDancefloor;
        const dancefloorId = activeDancefloor ? activeDancefloor.id : null;

        const isDjLoggedIn = req.session?.dj && String(req.session.dj.id) === djId;

        res.status(200).json({
            qrCode,
            name,
            bio,
            website,
            instagramHandle: instagram_handle,
            twitterHandle: twitter_handle,
            venmoHandle: venmo_handle,
            cashappHandle: cashapp_handle,
            isActive,
            dancefloorId,
            isDjLoggedIn,
        });
    } catch (error) {
        console.error('Error fetching DJ info or active dancefloor:', error);
        sendErrorResponse(res, 500, 'Error fetching DJ info.');
    }
};

// update DJ info
export const updateDjInfo = async (req: Request, res: Response) => {
    const { djId } = req.params;
    const { bio, website, instagramHandle, twitterHandle, venmoHandle, cashappHandle } = req.body;

    try {
        const result = await pool.query(
            `UPDATE djs
            SET bio = $1, website = $2, instagram_handle = $3, twitter_handle = $4, venmo_handle = $5, cashapp_handle = $6
            WHERE id = $7 RETURNING *`,
            [bio, website, instagramHandle, twitterHandle, venmoHandle, cashappHandle, djId]
        );

        if (result.rowCount === 0) {
            return sendErrorResponse(res, 404, 'DJ not found.');
        }

        res.status(200).json({
            message: 'DJ info updated successfully',
            dj: result.rows[0],
        });
    } catch (error) {
        console.error('Error updating DJ info:', error);
        sendErrorResponse(res, 500, 'Error updating DJ info.');
    }
};

// fetch past dancefloors
export const getPastDancefloors = async (req: Request, res: Response) => {
    const { djId } = req.params;

    try {
        const result = await pool.query(
            "SELECT * FROM dancefloors WHERE dj_id = $1 AND status = 'completed' ORDER BY end_time DESC",
            [djId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching past dancefloors:', error);
        sendErrorResponse(res, 500, 'Failed to fetch past dancefloors.');
    }
};