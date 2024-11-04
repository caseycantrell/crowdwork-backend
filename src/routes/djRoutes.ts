import { Router } from 'express';
import { getAllDJs, getDjInfo, getPastDancefloors, updateDjInfo, updateProfilePic, deleteAccount } from '../controllers/djController';

const router = Router();

router.get('/djs', getAllDJs);
router.get('/dj/:djId', getDjInfo);
router.put('/dj/:djId', updateDjInfo);
router.get('/dj/:djId/past-dancefloors', getPastDancefloors);
router.put('/dj/:djId/profile-pic', updateProfilePic);
router.delete('/dj/:djId/delete-account', deleteAccount);

export default router;
