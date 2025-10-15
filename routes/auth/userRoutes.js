import express from 'express'
import { loginUser, logoutUser, registerUser, getUsersByCenter, updateUserDetails, deleteUser } from '../../controllers/auth/userAuthController.js'
import { authenticateUser } from '../../utils/authMiddleware.js'

const router = express()

router.post('/login', loginUser)
router.get('/center/:id', authenticateUser, getUsersByCenter)
router.post('/register', authenticateUser, registerUser)
// router.post('/verify-otp', verifyOtpUser) // OTP flow removed
router.post('/logout', logoutUser)
router.patch('/update/:id', authenticateUser, updateUserDetails)
router.delete('/delete/:id', authenticateUser, deleteUser)

export default router