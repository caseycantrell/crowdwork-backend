import { Router } from 'express';
import { 
  startDancefloor,
  stopDancefloor,
  getDancefloorDetails
} from '../controllers/dancefloorController';

const router = Router();

router.post('/start-dancefloor', startDancefloor);
router.post('/stop-dancefloor', stopDancefloor);
router.get('/dancefloor/:dancefloorId', getDancefloorDetails);

export default router;