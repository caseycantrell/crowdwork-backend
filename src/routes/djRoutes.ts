import { Router, Request, Response } from 'express';
import { pool } from '../config/db';

const router = Router();

const checkActiveDancefloorForDj = async (djId: string) => {
    const result = await pool.query('SELECT * FROM dancefloors WHERE dj_id = $1 AND is_active = TRUE', [djId]);
    console.log("Active Dancefloor Check:", result.rows);
    return result.rows[0] || null;
  };

// fetch all DJs
router.get('/api/djs', async (req: Request, res: Response) => {
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
      const djResult = await pool.query('SELECT qr_code FROM djs WHERE id = $1', [djId]);
      if (djResult.rows.length === 0) {
        return res.status(404).json({ message: 'DJ not found' });
      }
      const qrCode = djResult.rows[0].qr_code;
  
      const activeDancefloor = await checkActiveDancefloorForDj(djId);
      const isActive = !!activeDancefloor;
      const dancefloorId = activeDancefloor ? activeDancefloor.id : null;
  
      // check if the logged-in user is the DJ
      const isDjLoggedIn = req.session.dj && String(req.session.dj.id) === djId;
  
      res.status(200).json({ qrCode, isActive, dancefloorId, isDjLoggedIn });
    } catch (error) {
      console.error('Error fetching DJ info or active dancefloor:', error);
      res.status(500).json({ error: 'Error fetching DJ info' });
    }
  });
  
  

export default router;