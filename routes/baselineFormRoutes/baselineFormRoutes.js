import express from 'express'
import {
    createPatientForm,
    getFilteredPatientForms,
    getPatientFormById,
    getPatientFormsByUhid,
    updatePatientForm,
    deletePatientForm
} from '../../controller/patientform/patientformController.js'

const router = express.Router()

router.post('/', createPatientForm)
router.get('/filter', getFilteredPatientForms)
router.get('/:id', getPatientFormById)
router.get('/uhid/:uhid', getPatientFormsByUhid)
router.put('/:id', updatePatientForm)
router.delete('/:id', deletePatientForm)

export default router