import express from 'express'
import {
    createBaselineForm,
    getBaselineForm,
    deleteBaselineForm,
    getBaselineFormById,
    updateBaselineForm
} from '../../controllers/baselineForm/baselineFormController.js'
import upload from "../../utils/multer.js"


import { validateBaselineForm } from '../../validators/baselineFormValidator.js'
import { authenticateUser } from '../../utils/authMiddleware.js'


const router = express.Router()

router.post('/', authenticateUser, upload.fields([
    { name: "mriImages", maxCount: 10 },
]), validateBaselineForm, createBaselineForm)
router.get('/', authenticateUser, getBaselineForm)
router.get('/:id', authenticateUser, getBaselineFormById)
router.patch('/:id', authenticateUser, upload.fields([
    { name: "mriImages", maxCount: 10 },
]), updateBaselineForm)
router.delete('/:id', authenticateUser, deleteBaselineForm)

export default router