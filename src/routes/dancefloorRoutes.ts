import { Router } from 'express';
import { 
  startDancefloor,
  stopDancefloor,
  getDancefloorDetails,
  reactivateDancefloor
} from '../controllers/dancefloorController';

const router = Router();

router.post('/start-dancefloor', startDancefloor);
router.post('/stop-dancefloor', stopDancefloor);
router.get('/dancefloor/:dancefloorId', getDancefloorDetails);
router.post('/dancefloor/:dancefloorId/reactivate', reactivateDancefloor);

export default router;