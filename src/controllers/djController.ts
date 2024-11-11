import { Request, Response } from 'express';
import { pool } from '../config/db';
import bcrypt from 'bcrypt';
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
            'SELECT qr_code, name, bio, website, instagram_handle, twitter_handle, venmo_handle, cashapp_handle, profile_pic_url FROM djs WHERE id = $1',
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
            profile_pic_url,
        } = djResult.rows[0];

        const activeDancefloor = await checkActiveDancefloorForDj(djId);
        const isActive = !!activeDancefloor;
        const dancefloorId = activeDancefloor ? activeDancefloor.id : null;

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
            profilePicUrl: profile_pic_url
        });
    } catch (error) {
        console.error('Error fetching DJ info or active dancefloor:', error);
        sendErrorResponse(res, 500, 'Error fetching DJ info.');
    }
};

// update DJ info
export const updateDjInfo = async (req: Request, res: Response) => {
    const { djId } = req.params;
    const { bio, name, website, instagramHandle, twitterHandle, venmoHandle, cashappHandle } = req.body;

    try {
        const result = await pool.query(
            `UPDATE djs
            SET bio = $1, name = $2, website = $3, instagram_handle = $4, twitter_handle = $5, venmo_handle = $6, cashapp_handle = $7
            WHERE id = $8 RETURNING *`,
            [bio, name, website, instagramHandle, twitterHandle, venmoHandle, cashappHandle, djId]
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
            "SELECT * FROM dancefloors WHERE dj_id = $1 AND status = 'completed' ORDER BY ended_at DESC",
            [djId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching past dancefloors:', error);
        sendErrorResponse(res, 500, 'Failed to fetch past dancefloors.');
    }
};

export const updateProfilePic = async (req: Request, res: Response) => {
    const { djId } = req.params;
    const { profile_pic_url } = req.body;
  
    try {
      await pool.query(
        'UPDATE djs SET profile_pic_url = $1 WHERE id = $2',
        [profile_pic_url, djId]
      );
  
      res.status(200).json({ message: 'Profile picture updated successfully.' });
    } catch (error) {
      console.error('Error updating profile picture URL:', error);
      res.status(500).json({ message: 'Failed to update profile picture.', error: error });
    }
};

// deleting account
export const deleteAccount = async (req: Request, res: Response) => {
    const { djId } = req.params;
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM djs WHERE id = $1 AND email = $2', [djId, email]);
        if (result.rows.length === 0) {
            return sendErrorResponse(res, 404, 'Account not found or email does not match.');
        }

        const dj = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, dj.password);

        if (!isPasswordValid) {
            return sendErrorResponse(res, 401, 'Incorrect password.');
        }

        await pool.query('BEGIN');

        // delete related song requests and messages for each dancefloor
        await pool.query(`
            DELETE FROM song_requests
            WHERE dancefloor_id IN (SELECT id FROM dancefloors WHERE dj_id = $1)
        `, [djId]);

        await pool.query(`
            DELETE FROM messages
            WHERE dancefloor_id IN (SELECT id FROM dancefloors WHERE dj_id = $1)
        `, [djId]);

        // delete dancefloors
        await pool.query('DELETE FROM dancefloors WHERE dj_id = $1', [djId]);

        // delete the user account
        await pool.query('DELETE FROM djs WHERE id = $1', [djId]);

        await pool.query('COMMIT');

        res.status(200).json({ message: 'Account deleted successfully.' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error deleting account:', error);
        sendErrorResponse(res, 500, 'Error deleting account.');
    }
};