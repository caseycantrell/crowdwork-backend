import { Router, Request, Response } from 'express';
import { pool } from '../config/db';

const router = Router();

// function to check the active dancefloor for a DJ
const checkActiveDancefloorForDj = async (djId: string) => {
  const result = await pool.query(
    "SELECT * FROM dancefloors WHERE dj_id = $1 AND status = 'active'",
    [djId]
  );
  console.log("Active Dancefloor Check:", result.rows);
  return result.rows[0] || null;
};

// fetch all DJs
router.get('/djs', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM djs');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching DJs:', error);
    res.status(500).json({ error: 'Failed to fetch DJs.' });
  }
});

// fetch DJ info and check for active dancefloor
router.get('/dj/:djId', async (req: Request, res: Response) => {
  const { djId } = req.params;

  try {
    const djResult = await pool.query(
      'SELECT qr_code, name, bio, website, instagram_handle, twitter_handle, venmo_handle, cashapp_handle FROM djs WHERE id = $1',
      [djId]
    );

    if (djResult.rows.length === 0) {
      return res.status(404).json({ message: 'DJ not found' });
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

    const isDjLoggedIn = req.session.dj && String(req.session.dj.id) === djId;

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
    res.status(500).json({ error: 'Error fetching DJ info' });
  }
});

// update DJ info
router.put('/dj/:djId', async (req: Request, res: Response) => {
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
      return res.status(404).json({ message: 'DJ not found' });
    }

    res.status(200).json({ message: 'DJ info updated successfully', dj: result.rows[0] });
  } catch (error) {
    console.error('Error updating DJ info:', error);
    res.status(500).json({ message: 'Error updating DJ info' });
  }
});

// fetch past dancefloors
router.get('/dj/:djId/past-dancefloors', async (req: Request, res: Response) => {
  const { djId } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM dancefloors WHERE dj_id = $1 AND status = 'completed' ORDER BY end_time DESC",
      [djId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching past dancefloors:', error);
    res.status(500).json({ error: 'Failed to fetch past dancefloors.' });
  }
});

export default router;
