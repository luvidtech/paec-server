import BaselineForm from "../../models/baselineFormModel.js"
import FollowupForm from "../../models/followupFormModel.js"
import asyncHandler from "../../utils/asyncHandler.js"


export const createFollowupForm = async (req, res) => {
    try {
        // Verify patient exists
        const patient = await BaselineForm.findById({ _id: req.body.baselineForm, 'isDeleted.status': false })
        if (!patient) {
            return res.status(404).json({ message: 'Baseline record not found' })
        }

        // Check if the currentVisitDate is the same as lastVisitDate
        if (req.body.visitDetails?.currentVisitDate === patient.visitDetails?.lastVisitDate) {
            return res.status(400).json({
                message: 'currentVisitDate cannot be the same as lastVisitDate for this follow-up'
            })
        }

        // Check if another follow-up exists for this patient on the same currentVisitDate
        const existingFollowUp = await FollowupForm.findOne({
            baselineForm: req.body.baselineForm,
            'visitDetails.currentVisitDate': req.body.visitDetails.currentVisitDate,
            'isDeleted.status': false
        })

        if (existingFollowUp) {
            return res.status(409).json({
                message: 'A follow-up already exists for this patient on this date'
            })
        }

        // Set the currentVisitDate to today's date if not provided
        const formData = {
            ...req.body,
            visitDetails: {
                ...req.body.visitDetails,
                currentVisitDate: req.body.visitDetails?.currentVisitDate || new Date()
            }
        }

        const newFollowUp = new FollowupForm(formData)
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



export const getFollowupForm = asyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            baselineForm,
            startDate,
            endDate,
            uhid,
            name
        } = req.query

        const matchStage = {
            'isDeleted.status': false
        }

        if (baselineForm) {
            matchStage.baselineForm = new mongoose.Types.ObjectId(baselineForm)
        }

        if (startDate || endDate) {
            matchStage['visitDetails.currentVisitDate'] = {}
            if (startDate) matchStage['visitDetails.currentVisitDate'].$gte = new Date(startDate)
            if (endDate) matchStage['visitDetails.currentVisitDate'].$lte = new Date(endDate)
        }

        const pipeline = [
            { $match: matchStage },

            // Lookup with filter on BaselineForm.isDeleted.status
            {
                $lookup: {
                    from: 'baselineforms',
                    let: { bfId: '$baselineForm' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$bfId'] }, 'isDeleted.status': false } }
                    ],
                    as: 'baselineFormData'
                }
            },
            { $unwind: '$baselineFormData' },

            // Filter by UHID and name
            {
                $match: {
                    ...(uhid && { 'baselineFormData.patientDetails.uhid': uhid }),
                    ...(name && { 'baselineFormData.patientDetails.name': { $regex: name, $options: 'i' } })
                }
            },

            // Pagination and total count
            {
                $facet: {
                    data: [
                        { $sort: { createdAt: -1 } },
                        { $skip: (parseInt(page) - 1) * parseInt(limit) },
                        { $limit: parseInt(limit) }
                    ],
                    count: [
                        { $count: 'total' }
                    ]
                }
            }
        ]

        const result = await FollowupForm.aggregate(pipeline)

        const forms = result[0]?.data || []
        const total = result[0]?.count[0]?.total || 0

        res.json({
            forms,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            totalRecords: total
        })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})





export const getFollowupFormById = async (req, res) => {
    try {
        const followUp = await FollowupForm.findById({
            _id: req.params.id, 'isDeleted.status': false
        })
            .populate('baselineForm', 'patientDetails.name patientDetails.uhid')

        if (!followUp) {
            return res.status(404).json({ message: 'Follow-up not found' })
        }
        res.json(followUp)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}


export const updateFollowupForm = async (req, res) => {
    try {
        // Check if the associated BaselineForm is deleted
        const baselineForm = await BaselineForm.findById(req.body.baselineForm)

        if (!baselineForm || baselineForm.isDeleted.status === true) {
            return res.status(400).json({
                message: 'Cannot update follow-up: The associated BaselineForm is deleted'
            })
        }

        // Check for date conflicts if date is being updated
        if (req.body.visitDetails?.currentVisitDate) {
            const existing = await FollowupForm.findOne({
                patient: req.body.patient,
                'visitDetails.currentVisitDate': req.body.visitDetails.currentVisitDate,
                _id: { $ne: req.params.id }, 'isDeleted.status': false
            })

            if (existing) {
                return res.status(409).json({
                    message: 'Another follow-up exists for this patient on the new date'
                })
            }
        }

        const updatedFollowUp = await FollowupForm.findByIdAndUpdate(
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
};



export const deleteFollowupForm = async (req, res) => {
    try {
        const followUp = await FollowupForm.findById({_id: req.params.id, 'isDeleted.status': false})

        if (!followUp) {
            return res.status(404).json({ message: 'Follow-up not found' })
        }

        // Mark the follow-up as deleted (soft delete)
        followUp.isDeleted.status = true
        followUp.isDeleted.deletedBy = req.user ? req.user._id : null // Assuming the user ID is in req.user
        followUp.isDeleted.deletedTime = Date.now()

        // Save the updated follow-up form
        await followUp.save()

        res.json({ message: 'Follow-up deleted successfully' })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
};

