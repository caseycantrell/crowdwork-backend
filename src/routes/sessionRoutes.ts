import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db';
import QRCode from 'qrcode';

const router = Router();

// login route
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT id, name, email, password FROM djs WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const dj = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, dj.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // set the session for the DJ
    req.session.dj = { id: String(dj.id), name: dj.name, email: dj.email };

    res.status(200).json({
      message: 'Logged in successfully',
      dj: { id: dj.id, name: dj.name, email: dj.email },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// logout route
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ message: 'Failed to log out' });
    }
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

// signup route
router.post('/signup', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // check if the DJ already exists
    const existingDJ = await pool.query('SELECT * FROM djs WHERE email = $1', [email]);
    if (existingDJ.rows.length > 0) {
      return res.status(400).json({ message: 'DJ with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // insert the new DJ into the database
    const result = await pool.query(
      'INSERT INTO djs (name, email, password) VALUES ($1, $2, $3) RETURNING id',
      [name, email, hashedPassword]
    );

    const newDjId = result.rows[0].id;

    // generate the URL for the DJ's page
    const djUrl = `http://localhost:3000/dj/${newDjId}`;

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
    res.status(500).json({ message: 'Server error during registration' });
  }
});


export default router;
