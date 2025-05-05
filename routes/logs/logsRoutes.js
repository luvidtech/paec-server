import express from 'express'
import { authenticateUser } from '../../utils/authMiddleware.js'
import { getLogs } from '../../controllers/logs/logsController.js'

const router = express.Router()

router.get('/', authenticateUser, getLogs)

export default router