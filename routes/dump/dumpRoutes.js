import express from 'express'
import { authenticateUser } from '../../utils/authMiddleware.js'
import { downloadDump, generateDump, getDump } from '../../controllers/dump/dumpController.js'

const router = express.Router()

router.post('/', authenticateUser, generateDump)
router.get('/', authenticateUser, getDump)
router.get('/:file', authenticateUser, downloadDump)

export default router