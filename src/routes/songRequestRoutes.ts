import { Router } from 'express';
import { 
  updateSongRequestStatus, 
  reorderSongRequests,
} from '../controllers/songRequestController';

const router = Router();

router.put('/song-request/:requestId/status', updateSongRequestStatus);
router.put('/dancefloor/:dancefloorId/reorder', reorderSongRequests);

export default router;
