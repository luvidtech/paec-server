import express from 'express'
import { loginAdmin, logoutAdmin, verifyOtpAdmin } from '../../controllers/auth/adminAuthController.js'

const router = express()

router.post('/admin/login', loginAdmin)
router.post('/admin/verify-otp', verifyOtpAdmin)
router.post('/admin/logout', logoutAdmin)

export default router