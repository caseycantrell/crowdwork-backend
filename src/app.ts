import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// basic route
app.get('/', (req: Request, res: Response) => {
  res.send('hey buddy your server is running...');
});

// start the server
app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
