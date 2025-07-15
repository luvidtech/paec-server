import express from 'express'
import { authenticateUser } from '../../utils/authMiddleware.js'
import { importForm, getImportTemplate } from '../../controllers/import/importController.js'

const router = express.Router()

router.post('/', authenticateUser, importForm)
router.get('/template', authenticateUser, getImportTemplate)

export default router