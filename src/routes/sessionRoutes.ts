import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db';
import QRCode from 'qrcode';
import { sendErrorResponse } from '../utils/helpers';

const router = Router();

require('dotenv').config();

const isPasswordStrong = (password: string) => {
  // minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

// login route
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {

    if (!email || !password) {
      return sendErrorResponse(res, 400, 'Email and password are both required, silly.');
    }
    
    const result = await pool.query('SELECT id, name, email, password FROM djs WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return sendErrorResponse(res, 401, 'Womp womp. User with this email not found.');
    }

    const dj = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, dj.password);

    if (!isPasswordValid) {
      return sendErrorResponse(res, 401, 'Your password is incorrect, friend.');
    }

    // set the session for the DJ
    req.session.dj = { id: String(dj.id), name: dj.name, email: dj.email };

    res.status(200).json({
      message: 'Logged in successfully',
      dj: { id: dj.id, name: dj.name, email: dj.email },
    });
  } catch (error) {
    console.error('Error during login:', error);
    sendErrorResponse(res, 500, 'Internal server error.');
  }
});

// logout route
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return sendErrorResponse(res, 500, 'Failed to log out.');
    }
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

// signup route
router.post('/signup', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    return sendErrorResponse(res, 400, 'All fields are required.');
  }
  
  if (!isPasswordStrong(password)) {
    return sendErrorResponse(res, 400, 'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.');
  }

  if (!process.env.FRONTEND_URL) {
    return sendErrorResponse(res, 500, 'Server configuration error: FRONTEND_URL is not set.');
  }

  try {
    // check if the DJ already exists
    const existingDJ = await pool.query('SELECT * FROM djs WHERE email = $1', [email]);
    if (existingDJ.rows.length > 0) {
      return sendErrorResponse(res, 400, 'DJ with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // insert the new DJ into the database
    const result = await pool.query(
      'INSERT INTO djs (name, email, password) VALUES ($1, $2, $3) RETURNING id',
      [name, email, hashedPassword]
    );

    const newDjId = result.rows[0].id;

    // generate the URL for the DJ's page
    const djUrl = `${process.env.FRONTEND_URL}/dj/${newDjId}?redirect=dancefloor`;

    // generate the QR code for the DJ's URL
    const qrCodeData = await QRCode.toDataURL(djUrl); // base64 string

    // update the DJ record with the QR code image (base64 string)
    await pool.query('UPDATE djs SET qr_code = $1 WHERE id = $2', [qrCodeData, newDjId]);

    // auto-login the new DJ by setting the session
    req.session.dj = { id: newDjId, name, email };

    res.status(201).json({
      message: 'DJ registered and logged in successfully.',
      djId: newDjId,
      qrCode: qrCodeData
    });
  } catch (error) {
    console.error('Error registering DJ:', error);
    sendErrorResponse(res, 500, 'Server error during registration.');
  }
});


export default router;