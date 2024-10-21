import { Router } from 'express';
import { 
  updateSongRequestStatus, 
  reorderSongRequests,
  likeSongRequest,
  playSongRequest,
  completeSongRequest,
  declineSongRequest 
} from '../controllers/songRequestController';

const router = Router();

router.put('/song-request/:requestId/status', updateSongRequestStatus);
router.put('/dancefloor/:dancefloorId/reorder', reorderSongRequests);
router.put('/song-request/:requestId/like', likeSongRequest);
router.put('/song-request/:requestId/play', playSongRequest);
router.put('/song-request/:requestId/complete', completeSongRequest);
router.put('/song-request/:requestId/decline', declineSongRequest);

export default router;
