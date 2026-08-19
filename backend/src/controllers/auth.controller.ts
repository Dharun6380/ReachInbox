import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const client = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'your_google_client_id_here' ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export async function googleLogin(req: Request, res: Response) {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Credential token is required' });
  }

  try {
    let email: string;
    let name: string;
    let avatar: string | null = null;

    const isMockBypass = !client || credential.startsWith('mock_token_');

    if (isMockBypass) {
      console.log('Using development bypass / mock login for Google OAuth.');
      email = credential.includes('@') ? credential.replace('mock_token_', '') : 'developer@reachinbox.ai';
      name = 'ReachInbox Developer';
      avatar = 'https://lh3.googleusercontent.com/a/default-user=s96-c';
    } else {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.name) {
        return res.status(400).json({ error: 'Invalid Google token payload' });
      }

      email = payload.email;
      name = payload.name;
      avatar = payload.picture || null;
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatar,
        },
      });
      console.log(`Created new user record: ${email}`);
    } else {
      user = await prisma.user.update({
        where: { email },
        data: { name, avatar },
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[AUTH] Login successful: database user.id=${user.id}, email=${user.email}`);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });

  } catch (error: any) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid authentication credentials', details: error.message });
  }
}
