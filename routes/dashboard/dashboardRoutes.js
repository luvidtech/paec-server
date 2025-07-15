import express from 'express'
import { dashboard } from '../../controllers/dashboard/dashboardController.js'
import { authenticateUser } from '../../utils/authMiddleware.js'

const router = express.Router()

router.get('/', authenticateUser, dashboard)

export default router