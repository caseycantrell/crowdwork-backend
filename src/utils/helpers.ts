import { Response } from 'express';

export const sendErrorResponse = (res: Response, statusCode: number, message: string): void => {
  res.status(statusCode).json({ error: message });
};