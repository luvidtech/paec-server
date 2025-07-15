import BaselineForm from "../../models/baselineFormModel.js"
import FollowupForm from "../../models/followupFormModel.js"
import asyncHandler from "../../utils/asyncHandler.js"
import { validationResult } from 'express-validator'
import HttpError from "../../utils/httpErrorMiddleware.js"
import newLog from "../../utils/newLog.js"
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Create Baseline Form
export const createBaselineForm = asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() })
    }

    try {
        const { patientDetails } = req.body

        const paecNo = patientDetails?.paecNo

        if (!paecNo) {
            return res.status(400).json({ message: 'paecNo is required in patientDetails' })
        }

        const existingForm = await BaselineForm.findOne({
            'patientDetails.paecNo': paecNo,
            'isDeleted.status': false
        })

        if (existingForm) {
            return res.status(400).json({
                message: 'File already exists',
                field: { 'patientDetails.paecNo': paecNo }
            })
        }

        // Handle MRI image uploads
        let mriImages = []
        if (req.files && Object.keys(req.files).length > 0) {
            const mriFolder = path.join(__dirname, "../../uploads/mri")
            if (!fs.existsSync(mriFolder)) {
                fs.mkdirSync(mriFolder, { recursive: true })
            }

            // Process MRI images
            const mriFiles = req.files.mriImages
            if (mriFiles && Array.isArray(mriFiles)) {
                for (const file of mriFiles) {
                    const originalName = file.originalname.split(" ").join("-").toLowerCase()
                    const uniqueId = uuidv4()
                    const paecNo = patientDetails?.paecNo || 'unknown'
                    const newFileName = `${paecNo}_${uniqueId}${path.extname(originalName)}`
                    const filePath = path.join(mriFolder, newFileName)

                    // Check if the file exists before renaming it
                    if (fs.existsSync(file.path)) {
                        fs.renameSync(file.path, filePath) // Move the file to the final location
                        mriImages.push(`/mri/${newFileName}`) // Add to array
                    } else {
                        return res.status(400).json({ message: "File not found for upload" })
                    }
                }
            }
        }

        const formData = {
            ...req.body,
            createdBy: req.user._id,
            center: req.user.center
        }

        // Add MRI images to form data if any were uploaded
        if (mriImages.length > 0) {
            if (!formData.mri) {
                formData.mri = {}
            }
            formData.mri.mriImages = mriImages
        }

        const newForm = new BaselineForm(formData)
        const savedForm = await newForm.save()

        await newLog({
            user: req.user._id,
            action: 'created',
            module: 'baselineform',
            modifiedData: {
                paecNo: patientDetails.paecNo,
                patientName: patientDetails.name
            }
        })


        res.status(201).json(savedForm)
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                message: 'File already exists',
                field: error.keyValue
            })
        }
        res.status(400).json({ message: error.message })
    }
})



export const getBaselineForm = asyncHandler(async (req, res) => {
    try {
        const {
            page,
            limit,
            sex,
            minAge,
            uhid,
            name,
            visitDate
        } = req.query


        const query = { 'isDeleted.status': false }

        // Access-based filtering
        const accessTo = req.user.accessTo
        if (accessTo === 'own') {
            query['createdBy'] = req.user._id
        } else if (accessTo === 'center') {
            query['center'] = req.user.center
        }

        if (sex) query['patientDetails.sex'] = sex
        if (minAge) query['patientDetails.age'] = { $gte: parseInt(minAge) }
        if (uhid) query['patientDetails.uhid'] = uhid
        if (name) query['patientDetails.name'] = { $regex: name, $options: 'i' }

        if (visitDate) {
            const parsedDate = new Date(visitDate)
            const nextDate = new Date(parsedDate)
            nextDate.setDate(parsedDate.getDate() + 1)

            query['visitDate'] = {
                $gte: parsedDate,
                $lt: nextDate
            }
        }

        const forms = await BaselineForm.find(query)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .exec()

        const count = await BaselineForm.countDocuments(query)

        res.json({
            forms,
            totalPages: Math.ceil(count / parseInt(limit)),
            currentPage: parseInt(page)
        })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})



export const getBaselineFormById = asyncHandler(async (req, res) => {
    try {
        const form = await BaselineForm.findById(req.params.id)

        if (!form) {
            return res.status(404).json({ message: 'Form not found' })
        }

        // Access control
        const accessTo = req.user.accessTo
        const isOwner = form.createdBy.toString() === req.user._id.toString()
        const isSameCenter = form.center?.toString() === req.user.center?.toString()

        if (
            accessTo !== 'all' &&
            !(accessTo === 'own' && isOwner) &&
            !(accessTo === 'center' && isSameCenter)
        ) {
            return res.status(403).json({ message: 'Access denied' })
        }

        const followupForms = await FollowupForm.find({
            baselineForm: req.params.id,
            'isDeleted.status': false
        }).sort({ visitDate: -1 })

        res.json({
            baselineForm: form,
            followups: followupForms
        })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

// Search Baseline Form
export const searchBaselineForm = asyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            paecNo,
            uhid,
            name
        } = req.query

        const query = { 'isDeleted.status': false }

        // Access-based filtering
        const accessTo = req.user.accessTo
        if (accessTo === 'own') {
            query['createdBy'] = req.user._id
        } else if (accessTo === 'center') {
            query['center'] = req.user.center
        }

        // Build search query
        const searchConditions = []
        
        if (paecNo) {
            searchConditions.push({
                'patientDetails.paecNo': { $regex: paecNo, $options: 'i' }
            })
        }
        
        if (uhid) {
            searchConditions.push({
                'patientDetails.uhid': { $regex: uhid, $options: 'i' }
            })
        }
        
        if (name) {
            searchConditions.push({
                'patientDetails.name': { $regex: name, $options: 'i' }
            })
        }

        // If search conditions exist, add them to the main query
        if (searchConditions.length > 0) {
            query.$or = searchConditions
        }

        // Validate that at least one search parameter is provided
        if (searchConditions.length === 0) {
            return res.status(400).json({ 
                message: 'At least one search parameter (paecNo, uhid, or name) is required' 
            })
        }

        const forms = await BaselineForm.find(query)
            .populate('createdBy', 'name email')
            .populate('center', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .exec()

        const count = await BaselineForm.countDocuments(query)

        res.json({
            forms,
            totalPages: Math.ceil(count / parseInt(limit)),
            currentPage: parseInt(page),
            totalResults: count,
            searchParams: {
                paecNo: paecNo || null,
                uhid: uhid || null,
                name: name || null
            }
        })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})



// Update Baseline Form
export const updateBaselineForm = asyncHandler(async (req, res) => {
    try {
        const formId = req.params.id
        const { patientDetails } = req.body

        // If uhid is being updated, check for conflict
        if (patientDetails?.uhid) {
            const existing = await BaselineForm.findOne({
                _id: { $ne: formId },
                'patientDetails.uhid': patientDetails.uhid,
                'isDeleted.status': false
            })

            if (existing) {
                return res.status(400).json({
                    message: 'UHID already exists in another active record',
                    field: { 'patientDetails.uhid': patientDetails.uhid }
                })
            }
        }

        const form = await BaselineForm.findById(formId)

        if (!form) {
            return res.status(404).json({ message: 'Form not found' })
        }

        // Clone for diff comparison
        const oldForm = form.toObject()

        // Handle MRI image uploads for updates
        let newMriImages = []
        if (req.files && Object.keys(req.files).length > 0) {
            const mriFolder = path.join(__dirname, "../../uploads/mri")
            if (!fs.existsSync(mriFolder)) {
                fs.mkdirSync(mriFolder, { recursive: true })
            }

            // Process MRI images
            const mriFiles = req.files.mriImages
            if (mriFiles && Array.isArray(mriFiles)) {
                for (const file of mriFiles) {
                    const originalName = file.originalname.split(" ").join("-").toLowerCase()
                    const uniqueId = uuidv4()
                    const paecNo = patientDetails?.paecNo || form.patientDetails?.paecNo || 'unknown'
                    const newFileName = `${paecNo}_${uniqueId}${path.extname(originalName)}`
                    const filePath = path.join(mriFolder, newFileName)

                    // Check if the file exists before renaming it
                    if (fs.existsSync(file.path)) {
                        fs.renameSync(file.path, filePath) // Move the file to the final location
                        newMriImages.push(`/mri/${newFileName}`) // Add to array
                    } else {
                        return res.status(400).json({ message: "File not found for upload" })
                    }
                }
            }
        }

        // Push to updatedBy array
        form.updatedBy.push({
            user: req.user._id,
            updatedAt: new Date()
        })

        // Apply updates
        Object.assign(form, req.body)

        // Add new MRI images to existing array
        if (newMriImages.length > 0) {
            if (!form.mri) {
                form.mri = {}
            }
            if (!form.mri.mriImages) {
                form.mri.mriImages = []
            }
            // Merge new images with existing ones
            form.mri.mriImages = [...form.mri.mriImages, ...newMriImages]
        }

        const updatedForm = await form.save()

        // Prepare modifiedData for logging
        const modifiedData = {}
        const oldUHID = oldForm.patientDetails?.uhid
        const newUHID = req.body.patientDetails?.uhid
        if (oldUHID && newUHID && oldUHID !== newUHID) {
            modifiedData.uhid = { from: oldUHID, to: newUHID }
        }

        const oldName = oldForm.patientDetails?.name
        const newName = req.body.patientDetails?.name
        if (oldName && newName && oldName !== newName) {
            modifiedData.name = { from: oldName, to: newName }
        }

        // Add other fields to log if needed

        if (Object.keys(modifiedData).length > 0) {
            await newLog({
                user: req.user._id,
                action: 'updated',
                module: 'baselineform',
                modifiedData
            })
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



// Delete Baseline form
export const deleteBaselineForm = asyncHandler(async (req, res, next) => {
    const form = await BaselineForm.findById({ _id: req.params.id, 'isDeleted.status': false })

    if (form) {
        const deletedBy = req.user ? req.user._id : null
        const deletedTime = Date.now()

        // Delete MRI images if they exist
        if (form.mri && form.mri.mriImages && form.mri.mriImages.length > 0) {
            for (const imagePath of form.mri.mriImages) {
                const fullPath = path.join(__dirname, "../../uploads", imagePath)
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath)
                }
            }
        }

        // Mark baseline as deleted
        form.isDeleted = {
            status: true,
            deletedBy,
            deletedTime
        }

        // Mark associated follow-ups as deleted
        await FollowupForm.updateMany(
            { baselineForm: req.params.id, 'isDeleted.status': false },
            {
                $set: {
                    'isDeleted.status': true,
                    'isDeleted.deletedBy': deletedBy,
                    'isDeleted.deletedTime': deletedTime
                }
            }
        )

        await form.save()

        await newLog({
            user: deletedBy,
            action: 'deleted',
            module: 'baselineform',
            modifiedData: {
                baselineFormId: req.params.id,
                deletedFollowups: true,
                deletedTime
            }
        })

        res.status(200).json({ message: "Baseline form and related follow-ups deleted" })
    } else {
        return next(new HttpError("Baseline form not found", 404))
    }
})
