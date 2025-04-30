import Ghdform from "../../models/ghdform.js"
import Patientform from "../../models/patientform.js"
import asyncHandler from "../../utils/asyncHandler.js"


export const createGhdForm = async (req, res) => {
    try {
        // Verify patient exists
        const patient = await Patientform.findById(req.body.patient)
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' })
        }

        const formData = {
            ...req.body,
            visitDetails: {
                ...req.body.visitDetails,
                currentVisitDate: req.body.visitDetails?.currentVisitDate || new Date()
            }
        }

        const newFollowUp = new Ghdform(formData)
        const savedFollowUp = await newFollowUp.save()

        res.status(201).json(savedFollowUp)
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'A follow-up already exists for this patient on this date'
            })
        }
        res.status(400).json({ message: error.message })
    }
}


export const getGhdForm = asyncHandler(async (req, res, next) => {
    try {
        // Verify patient exists
        const patient = await Patientform.findById(req.body.patient)
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' })
        }

        const formData = {
            ...req.body,
            visitDetails: {
                ...req.body.visitDetails,
                currentVisitDate: req.body.visitDetails?.currentVisitDate || new Date()
            }
        }

        const newFollowUp = new Ghdform(formData)
        const savedFollowUp = await newFollowUp.save()

        res.status(201).json(savedFollowUp)
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'A follow-up already exists for this patient on this date'
            })
        }
        res.status(400).json({ message: error.message })
    }
})


export const getAllGhdFormForPatient = asyncHandler(async (req, res, next) => {
    try {
        const { patientId } = req.params
        const { page = 1, limit = 10 } = req.query

        const followUps = await Ghdform.find({ patient: patientId })
            .sort({ 'visitDetails.currentVisitDate': -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))

        const count = await Ghdform.countDocuments({ patient: patientId })

        res.json({
            followUps,
            totalPages: Math.ceil(count / parseInt(limit)),
            currentPage: parseInt(page),
            totalFollowUps: count
        })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }

})


export const getGhdFormUpById = async (req, res) => {
    try {
        const followUp = await Ghdform.findById(req.params.id)
            .populate('patient', 'patientDetails.name patientDetails.uhid')

        if (!followUp) {
            return res.status(404).json({ message: 'Follow-up not found' })
        }
        res.json(followUp)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}


export const updateGhdForm = async (req, res) => {
    try {
        // Check for date conflicts if date is being updated
        if (req.body.visitDetails?.currentVisitDate) {
            const existing = await Ghdform.findOne({
                patient: req.body.patient,
                'visitDetails.currentVisitDate': req.body.visitDetails.currentVisitDate,
                _id: { $ne: req.params.id }
            })

            if (existing) {
                return res.status(409).json({
                    message: 'Another follow-up exists for this patient on the new date'
                })
            }
        }

        const updatedFollowUp = await Ghdform.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )

        if (!updatedFollowUp) {
            return res.status(404).json({ message: 'Follow-up not found' })
        }
        res.json(updatedFollowUp)
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'Date conflict with another follow-up'
            })
        }
        res.status(400).json({ message: error.message })
    }
}


export const deleteGhdForm = async (req, res) => {
    try {
        const deletedFollowUp = await Ghdform.findByIdAndDelete(req.params.id)
        if (!deletedFollowUp) {
            return res.status(404).json({ message: 'Follow-up not found' })
        }
        res.json({ message: 'Follow-up deleted successfully' })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}
