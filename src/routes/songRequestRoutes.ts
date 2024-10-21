import { Router } from 'express';
import { 
  updateSongRequestStatus, 
  reorderSongRequests,
  likeSongRequest,
} from '../controllers/songRequestController';

const router = Router();

router.put('/song-request/:requestId/status', updateSongRequestStatus);
router.put('/dancefloor/:dancefloorId/reorder', reorderSongRequests);
router.put('/song-request/:requestId/like', likeSongRequest);

export default router;
