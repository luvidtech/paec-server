import express from 'express'
import { authenticateUser } from '../../utils/authMiddleware.js'
import { exportForm } from '../../controllers/export/exportController.js'
import { exportImportTemplateFormat } from '../../controllers/export/exportTemplateController.js'

const router = express.Router()

router.post('/', authenticateUser, exportForm)
router.post('/analysis', authenticateUser, exportImportTemplateFormat)

export default router