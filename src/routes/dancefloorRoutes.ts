import { Router } from 'express';
import { 
  startDancefloor,
  stopDancefloor,
  getSongRequestsForDancefloor,
  getMessagesForDancefloor,
  getDancefloorDetails
} from '../controllers/dancefloorController';

const router = Router();

router.post('/start-dancefloor', startDancefloor);
router.post('/stop-dancefloor', stopDancefloor);
router.get('/dancefloor/:dancefloorId/song-requests', getSongRequestsForDancefloor);
router.get('/dancefloor/:dancefloorId/messages', getMessagesForDancefloor);
router.get('/dancefloor/:dancefloorId', getDancefloorDetails);

export default router;