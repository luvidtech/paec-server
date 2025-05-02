import express from 'express'
import { loginUser, verifyOtpUser, logoutUser, registerUser } from '../../controllers/auth/userAuthController.js'
import { authenticateUser } from '../../utils/authMiddleware.js'

const router = express()

router.post('/login', loginUser)
router.post('/register', authenticateUser, registerUser)
router.post('/verify-otp', verifyOtpUser)
router.post('/logout', logoutUser)

export default router