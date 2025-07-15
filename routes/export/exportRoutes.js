import express from 'express'
import { authenticateUser } from '../../utils/authMiddleware.js'
import { exportForm } from '../../controllers/export/exportController.js'

const router = express.Router()

router.post('/', authenticateUser, exportForm)

export default router