import asyncHandler from "../../utils/asyncHandler.js"
import BaselineForm from "../../models/baselineFormModel.js"
import FollowupForm from "../../models/followupFormModel.js"
import newLog from "../../utils/newLog.js"
import multer from "multer"
import XLSX from "xlsx"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, "../../uploads/imports")
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true })
        }
        cb(null, uploadPath)
    },
    filename: function (req, file, cb) {
        const uniqueName = `${Date.now()}-${file.originalname}`
        cb(null, uniqueName)
    }
})

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true)
        } else {
            cb(new Error('Only Excel files are allowed'), false)
        }
    }
}).single('excelFile')

export const importForm = asyncHandler(async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message })
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an Excel file' })
        }

        try {
            // Read the Excel file
            const workbook = XLSX.readFile(req.file.path)
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

            // Validate headers - only PAEC No is mandatory
            const headers = data[0]
            const hasPaecNo = headers.some(h => h && h.toString().toUpperCase().includes('PAEC NO'))

            if (!hasPaecNo) {
                return res.status(400).json({
                    message: 'PAEC No is required in the Excel file'
                })
            }

            const results = {
                total: 0,
                baselineCreated: 0,
                baselineUpdated: 0,
                errors: []
            }

            // Process each row (skip header row)
            for (let i = 1; i < data.length; i++) {
                const row = data[i]
                if (!row || row.every(cell => !cell)) continue // Skip empty rows

                try {
                    // Create a map of headers to values
                    const headerMap = {}
                    headers.forEach((header, index) => {
                        if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
                            headerMap[header.toString().trim()] = row[index]
                        }
                    })

                    // Only PAEC No is mandatory
                    const paecNo = headerMap['PAEC No'] || headerMap['PAEC NO'] || headerMap['paec no']
                    if (!paecNo) {
                        results.errors.push({
                            row: i + 1,
                            error: 'PAEC No is required'
                        })
                        continue
                    }

                    results.total++

                    // Check if baseline exists
                    const existingBaseline = await BaselineForm.findOne({
                        'patientDetails.paecNo': paecNo,
                        'isDeleted.status': false
                    })

                    // Handle baseline form only (simplified for essential fields)
                    const baselineData = {
                        patientDetails: {
                            paecNo: paecNo
                        },
                        createdBy: req.user._id,
                        center: req.user.center,
                        visitDate: new Date()
                    }

                    // Map essential fields from Excel to baseline data
                    if (headerMap['PATIENT NAME']) baselineData.patientDetails.name = headerMap['PATIENT NAME']
                    if (headerMap['AGE']) baselineData.patientDetails.age = parseInt(headerMap['AGE']) || 0
                    if (headerMap['SEX']) baselineData.patientDetails.sex = headerMap['SEX']
                    if (headerMap['UHID']) baselineData.patientDetails.uhid = headerMap['UHID']

                    // Address field
                    if (headerMap['Address']) {
                        baselineData.patientDetails.address = {
                            street: headerMap['Address'] || ''
                        }
                    }

                    // Contact fields
                    if (headerMap['Phone no1']) {
                        baselineData.patientDetails.contact = {
                            cell1: headerMap['Phone no1'] || ''
                        }
                        if (headerMap['Phone no2']) {
                            baselineData.patientDetails.contact.cell2 = headerMap['Phone no2']
                        }
                        if (headerMap['Phone 3']) {
                            baselineData.patientDetails.contact.landline = headerMap['Phone 3']
                        }
                    }

                    // Diagnosis field
                    if (headerMap['FINAL DIAGNOSIS 1']) {
                        baselineData.diagnosis = {
                            diagnosisType: 'Congenital',
                            isolatedGHD: headerMap['FINAL DIAGNOSIS 1'] || '',
                            hypopituitarism: headerMap['FINAL DIAGNOSIS 1'] || ''
                        }
                    }

                    if (existingBaseline) {
                        // Update existing baseline - only update fields that are provided
                        const updateData = {}

                        // Update patient details
                        if (baselineData.patientDetails) {
                            Object.keys(baselineData.patientDetails).forEach(key => {
                                if (baselineData.patientDetails[key] !== undefined) {
                                    if (!updateData.patientDetails) updateData.patientDetails = {}
                                    updateData.patientDetails[key] = baselineData.patientDetails[key]
                                }
                            })
                        }

                        // Update other fields
                        if (baselineData.visitDate) updateData.visitDate = baselineData.visitDate
                        if (baselineData.diagnosis) updateData.diagnosis = baselineData.diagnosis

                        Object.assign(existingBaseline, updateData)
                        existingBaseline.updatedBy.push({
                            user: req.user._id,
                            updatedAt: new Date()
                        })
                        await existingBaseline.save()
                        results.baselineUpdated++
                    } else {
                        // Create new baseline
                        const newBaseline = new BaselineForm(baselineData)
                        await newBaseline.save()
                        results.baselineCreated++
                    }

                } catch (error) {
                    results.errors.push({
                        row: i + 1,
                        error: error.message
                    })
                }
            }

            // Log the import
            await newLog({
                user: req.user._id,
                action: 'imported',
                module: 'excel_import',
                modifiedData: {
                    totalProcessed: results.total,
                    baselineCreated: results.baselineCreated,
                    baselineUpdated: results.baselineUpdated,
                    errors: results.errors.length
                }
            })

            // Clean up uploaded file
            fs.unlinkSync(req.file.path)

            res.json({
                message: 'Import completed',
                results
            })

        } catch (error) {
            // Clean up uploaded file on error
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path)
            }
            res.status(500).json({ message: error.message })
        }
    })
})

// Get import template
export const getImportTemplate = asyncHandler(async (req, res) => {
    const templateData = [
        [
            'S.NO', 'PATIENT NAME', 'SEX', 'AGE', 'PAEC No', 'FINAL DIAGNOSIS 1', 'Address', 'Phone no1', 'Phone no2', 'Phone 3', 'UHID'
        ],
        [
            1, 'John Doe', 'Male', 14, 'PAEC001', 'Isolated GHD', '123 Main St, New Delhi', '9876543210', '9876543211', '01123456789', 'UHID123456'
        ],
        [
            2, 'Jane Smith', 'Female', 12, 'PAEC002', 'Hypopituitarism', '456 Oak Ave, Mumbai', '9876543212', '9876543213', '01123456790', 'UHID123457'
        ]
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(templateData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=baseline_import_template.xlsx')
    res.send(buffer)
})