import { Request, Response } from 'express';

export const getUsers = (req: Request, res: Response) => {
  const users = ['Dylan', 'Dylan', 'Dylan', 'Dylan', 'Dylan'];
  res.json(users);
};