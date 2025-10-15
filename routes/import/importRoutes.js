import express from 'express'
import { authenticateUser } from '../../utils/authMiddleware.js'
import { importForm, getImportTemplate, importNewExcelForm } from '../../controllers/import/importController.js'

const router = express.Router()

router.post('/', authenticateUser, importForm)
router.post('/new-excel', authenticateUser, importNewExcelForm)
router.get('/template', authenticateUser, getImportTemplate)

export default router