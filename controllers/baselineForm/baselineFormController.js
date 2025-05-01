import BaselineForm from "../../models/baselineFormModel.js"
import Patientform from "../../models/patientform.js"
import asyncHandler from "../../utils/asyncHandler.js"

// Create new patient form
export const createBaselineForm = asyncHandler(async (req, res) => {
    try {
        const formData = req.body
        const newForm = new BaselineForm(formData)
        const savedForm = await newForm.save()
        res.status(201).json(savedForm)
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                message: 'Duplicate key error',
                field: error.keyValue
            })
        }
        res.status(400).json({ message: error.message })
    }
})

// Get all patient forms
export const getAllPatientForms = asyncHandler(async (req, res) => {
    try {
        const forms = await Patientform.find()
        res.json(forms)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

// Get filtered patient forms
export const getFilteredPatientForms = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 10, sex, minAge } = req.query
        const query = {}

        if (sex) query['patientDetails.sex'] = sex
        if (minAge) query['patientDetails.age'] = { $gte: parseInt(minAge) }

        const forms = await Patientform.find(query)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .exec()

        const count = await Patientform.countDocuments(query)

        res.json({
            forms,
            totalPages: Math.ceil(count / parseInt(limit)),
            currentPage: parseInt(page)
        })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

// Get single patient form by ID
export const getPatientFormById = asyncHandler(async (req, res) => {
    try {
        const form = await Patientform.findById(req.params.id)
        if (!form) {
            return res.status(404).json({ message: 'Form not found' })
        }
        res.json(form)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

// Get patient forms by UHID
export const getPatientFormsByUhid = asyncHandler(async (req, res) => {
    try {
        const forms = await Patientform.find({ 'patientDetails.uhid': req.params.uhid })
        res.json(forms)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

// Update patient form
export const updatePatientForm = asyncHandler(async (req, res) => {
    try {
        const updatedForm = await Patientform.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )
        if (!updatedForm) {
            return res.status(404).json({ message: 'Form not found' })
        }
        res.json(updatedForm)
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                message: 'Duplicate key error',
                field: error.keyValue
            })
        }
        res.status(400).json({ message: error.message })
    }
})

// Delete patient form
export const deletePatientForm = asyncHandler(async (req, res) => {
    try {
        const deletedForm = await Patientform.findByIdAndDelete(req.params.id)
        if (!deletedForm) {
            return res.status(404).json({ message: 'Form not found' })
        }
        res.json({ message: 'Form deleted successfully' })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})