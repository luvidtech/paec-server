import express from 'express'
import { loginUser, verifyOtpUser, logoutUser, registerUser, getUsersByCenter, updateUserDetails } from '../../controllers/auth/userAuthController.js'
import { authenticateUser } from '../../utils/authMiddleware.js'

const router = express()

router.post('/login', loginUser)
router.get('/center/:id', authenticateUser, getUsersByCenter)
router.post('/register', authenticateUser, registerUser)
router.post('/verify-otp', verifyOtpUser)
router.post('/logout', logoutUser)
router.patch('/update/:id', authenticateUser, updateUserDetails)

export default router