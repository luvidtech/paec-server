import express from 'express'
import {
    createBaselineForm,
    getBaselineForm,
    deleteBaselineForm,
    getBaselineFormById,
    updateBaselineForm
} from '../../controllers/baselineForm/baselineFormController.js'

import { validateBaselineForm } from '../../validators/baselineFormValidator.js'
import { authenticateUser } from '../../utils/authMiddleware.js'


const router = express.Router()

router.post('/',authenticateUser, validateBaselineForm, createBaselineForm)
router.get('/', authenticateUser, getBaselineForm)
router.get('/:id', authenticateUser, getBaselineFormById)
router.patch('/:id', authenticateUser, updateBaselineForm)
router.delete('/:id', authenticateUser, deleteBaselineForm)

export default router