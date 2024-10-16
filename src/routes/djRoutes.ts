import { Router } from 'express';
import { getAllDJs, getDjInfo, getPastDancefloors, updateDjInfo } from '../controllers/djController';

const router = Router();

router.get('/djs', getAllDJs);
router.get('/dj/:djId', getDjInfo);
router.put('/dj/:djId', updateDjInfo);
router.get('/dj/:djId/past-dancefloors', getPastDancefloors);

export default router;
