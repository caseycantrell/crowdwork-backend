import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db';
import { sendErrorResponse } from '../utils/helpers';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

dotenv.config();

const isPasswordStrong = (password: string) => {
  // minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
  
    try {
      if (!email || !password) {
        return sendErrorResponse(res, 400, "Email and password are both required.");
      }
  
      const result = await pool.query("SELECT id, name, email, password FROM djs WHERE email = $1", [email]);
  
      if (result.rows.length === 0) {
        return sendErrorResponse(res, 401, "User with this email not found.");
      }
  
      const dj = result.rows[0];
      const isPasswordValid = await bcrypt.compare(password, dj.password);
  
      if (!isPasswordValid) {
        return sendErrorResponse(res, 401, "Incorrect password.");
      }
  
      // return only user data (NextAuth handles JWT creation)
      res.status(200).json({
        id: dj.id,
        name: dj.name,
        email: dj.email,
      });
    } catch (error) {
      console.error("Error during login:", error);
      sendErrorResponse(res, 500, "Internal server error.");
    }
};
  

export const signup = async (req: Request, res: Response) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
      return sendErrorResponse(res, 400, 'All fields are required.');
  }

  if (!isPasswordStrong(password)) {
      return sendErrorResponse(
          res,
          400,
          'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.'
      );
  }

  if (!process.env.FRONTEND_URL) {
      return sendErrorResponse(res, 500, 'Server configuration error: FRONTEND_URL is not set.');
  }

  try {
      const existingDJ = await pool.query('SELECT * FROM djs WHERE email = $1', [email]);
      if (existingDJ.rows.length > 0) {
          return sendErrorResponse(res, 400, 'DJ with this email already exists.');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await pool.query(
          'INSERT INTO djs (name, email, password) VALUES ($1, $2, $3) RETURNING id',
          [name, email, hashedPassword]
      );

      const newDjId = result.rows[0].id;

      const djUrl = `${process.env.FRONTEND_URL}/dj/${newDjId}?redirect=dancefloor`;

      const qrCodeData = await QRCode.toDataURL(djUrl, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 3,
        color: {
            dark: '#ffffff', // white foreground
            light: '#000000' // black background
        }
      });

      await pool.query('UPDATE djs SET qr_code = $1 WHERE id = $2', [qrCodeData, newDjId]);
      
      res.status(201).json({
        message: "DJ registered successfully.",
        dj: {
          id: newDjId,
          name,
          email,
        },
        qrCode: qrCodeData,
      });
  } catch (error) {
      console.error('Error registering DJ:', error);
      sendErrorResponse(res, 500, 'Server error during registration.');
  }
};