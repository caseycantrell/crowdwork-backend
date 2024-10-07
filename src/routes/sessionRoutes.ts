import express, { Request, Response } from 'express';

const router = express.Router();

// Route to get the current session info
router.get('/session', (req: Request, res: Response) => {
  if (req.session.dj) {
    return res.status(200).json({ dj: req.session.dj });
  } else {
    return res.status(401).json({ message: 'No session found' });
  }
});

export default router;
