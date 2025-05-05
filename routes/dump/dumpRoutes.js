import express from 'express'
import { authenticateUser } from '../../utils/authMiddleware.js'
import { generateDump } from '../../controllers/dump/dumpController.js'

const router = express.Router()

router.post('/', authenticateUser, generateDump)

export default router