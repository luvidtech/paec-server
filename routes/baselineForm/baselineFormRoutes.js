import express from 'express'
import {
    createBaselineForm,
    getBaselineForm,
    deleteBaselineForm,
    getBaselineFormById,
    updateBaselineForm
} from '../../controllers/baselineForm/baselineFormController.js'

import { validateBaselineForm } from '../../validators/baselineFormValidator.js'


const router = express.Router()

router.post('/', validateBaselineForm, createBaselineForm)
router.get('/', getBaselineForm)
router.get('/:id', getBaselineFormById)
router.patch('/:id', updateBaselineForm)
router.delete('/:id', deleteBaselineForm)

export default router