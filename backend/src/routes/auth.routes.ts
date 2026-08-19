import { Router } from 'express';
import { googleLogin } from '../controllers/auth.controller';

const router = Router();

router.post('/google-login', googleLogin);

export default router;
