import { Router } from 'express';
import { 
  startDancefloor,
  stopDancefloor,
  getDancefloorDetails,
  reactivateDancefloor,
  renameDancefloor,
  deleteDancefloor
} from '../controllers/dancefloorController';

const router = Router();

router.post('/start-dancefloor', startDancefloor);
router.post('/stop-dancefloor', stopDancefloor);
router.get('/dancefloor/:dancefloorId', getDancefloorDetails);
router.post('/dancefloor/:dancefloorId/reactivate', reactivateDancefloor);
router.patch('/dancefloor/rename', renameDancefloor);
router.delete('/dancefloor/:dancefloorId', deleteDancefloor);

export default router;