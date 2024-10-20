import { Router } from 'express';
import { login, logout, signup, checkAuth } from '../controllers/authController';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/signup', signup);
router.get('/check', checkAuth);

export default router;