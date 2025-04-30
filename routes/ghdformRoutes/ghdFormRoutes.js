import express from 'express'
import {
    createGhdForm,
    getGhdForm,
    getAllGhdFormForPatient,
    getGhdFormUpById,
    updateGhdForm,
    deleteGhdForm
} from '../../controller/ghdform/ghdFormController.js'

const router = express.Router()

router.post('/', createGhdForm)
router.get('/patient/:patientId', getAllGhdFormForPatient)
router.get('/:id', getGhdFormUpById)
router.put('/:id', updateGhdForm)
router.delete('/:id', deleteGhdForm)

export default router