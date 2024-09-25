import express, { Request, Response } from 'express';
import userRoutes from './routes/userRoutes';
import dotenv from 'dotenv';

// ensure environment variables are loaded first
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// basic route for now
app.get('/', (req: Request, res: Response) => {
  res.send('hey buddy your server is running...');
});

app.use('/api', userRoutes);

// start the server
app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
});
