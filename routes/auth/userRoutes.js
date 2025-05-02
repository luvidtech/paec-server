import express from 'express'
import { loginUser, verifyOtpUser, logoutUser, registerUser } from '../../controllers/auth/userAuthController.js'

const router = express()

router.post('/login', loginUser)
router.post('/register', registerUser)
router.post('/admin/verify-otp', verifyOtpUser)
router.post('/admin/logout', logoutUser)

export default router