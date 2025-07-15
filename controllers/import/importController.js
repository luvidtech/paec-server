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
                followupCreated: 0,
                followupSkipped: 0,
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
                        'patientDetails.paecNo': rowData.paecNo,
                        'isDeleted.status': false
                    })

                    if (rowData.formType && rowData.formType.toString().toLowerCase().includes('followup')) {
                        // Handle followup form
                        if (!existingBaseline) {
                            results.followupSkipped++
                            results.errors.push({
                                row: i + 1,
                                error: `Baseline form not found for PAEC No: ${rowData.paecNo}`
                            })
                            continue
                        }

                        // Create followup form
                        const followupData = {
                            baselineForm: existingBaseline._id,
                            patientDetails: {
                                paecNo: paecNo
                            },
                            createdBy: req.user._id,
                            center: req.user.center
                        }

                        // Map all available fields from Excel to followup data
                        if (headerMap['UHID']) followupData.patientDetails.uhid = headerMap['UHID']
                        if (headerMap['PATIENT NAME'] || headerMap['Patient Name']) followupData.patientDetails.name = headerMap['PATIENT NAME'] || headerMap['Patient Name']
                        if (headerMap['AGE']) followupData.patientDetails.age = parseInt(headerMap['AGE']) || 0
                        if (headerMap['SEX']) followupData.patientDetails.sex = headerMap['SEX']
                        if (headerMap['DOB'] || headerMap['Date of Birth']) followupData.patientDetails.dob = new Date(headerMap['DOB'] || headerMap['Date of Birth'])

                        // Address fields
                        if (headerMap['Address'] || headerMap['ADDRESS']) {
                            followupData.patientDetails.address = {
                                street: headerMap['Address'] || headerMap['ADDRESS'] || ''
                            }
                            if (headerMap['City']) followupData.patientDetails.address.city = headerMap['City']
                            if (headerMap['State']) followupData.patientDetails.address.state = headerMap['State']
                        }

                        // Contact fields
                        if (headerMap['Phone no1'] || headerMap['Phone 1'] || headerMap['Cell 1']) {
                            followupData.patientDetails.contact = {
                                cell1: headerMap['Phone no1'] || headerMap['Phone 1'] || headerMap['Cell 1'] || ''
                            }
                            if (headerMap['Phone no2'] || headerMap['Phone 2'] || headerMap['Cell 2']) {
                                followupData.patientDetails.contact.cell2 = headerMap['Phone no2'] || headerMap['Phone 2'] || headerMap['Cell 2']
                            }
                            if (headerMap['Phone 3'] || headerMap['Landline']) {
                                followupData.patientDetails.contact.landline = headerMap['Phone 3'] || headerMap['Landline']
                            }
                        }

                        // Visit date
                        if (headerMap['Visit Date'] || headerMap['VISIT DATE']) {
                            followupData.visitDate = new Date(headerMap['Visit Date'] || headerMap['VISIT DATE'])
                        } else {
                            followupData.visitDate = new Date()
                        }

                        // Diagnosis fields
                        if (headerMap['FINAL DIAGNOSIS 1'] || headerMap['Diagnosis'] || headerMap['DIAGNOSIS']) {
                            followupData.diagnosis = {
                                diagnosisType: 'Congenital',
                                isolatedGHD: headerMap['FINAL DIAGNOSIS 1'] || headerMap['Diagnosis'] || headerMap['DIAGNOSIS'] || '',
                                hypopituitarism: headerMap['FINAL DIAGNOSIS 1'] || headerMap['Diagnosis'] || headerMap['DIAGNOSIS'] || ''
                            }
                        }

                        const newFollowup = new FollowupForm(followupData)
                        await newFollowup.save()
                        results.followupCreated++

                    } else {
                        // Handle baseline form
                        const baselineData = {
                            patientDetails: {
                                paecNo: paecNo
                            },
                            createdBy: req.user._id,
                            center: req.user.center
                        }

                        // Map all available fields from Excel to baseline data
                        if (headerMap['UHID']) baselineData.patientDetails.uhid = headerMap['UHID']
                        if (headerMap['PATIENT NAME'] || headerMap['Patient Name']) baselineData.patientDetails.name = headerMap['PATIENT NAME'] || headerMap['Patient Name']
                        if (headerMap['AGE']) baselineData.patientDetails.age = parseInt(headerMap['AGE']) || 0
                        if (headerMap['SEX']) baselineData.patientDetails.sex = headerMap['SEX']
                        if (headerMap['DOB'] || headerMap['Date of Birth']) baselineData.patientDetails.dob = new Date(headerMap['DOB'] || headerMap['Date of Birth'])

                        // Address fields
                        if (headerMap['Address'] || headerMap['ADDRESS']) {
                            baselineData.patientDetails.address = {
                                street: headerMap['Address'] || headerMap['ADDRESS'] || ''
                            }
                            if (headerMap['City']) baselineData.patientDetails.address.city = headerMap['City']
                            if (headerMap['State']) baselineData.patientDetails.address.state = headerMap['State']
                        }

                        // Contact fields
                        if (headerMap['Phone no1'] || headerMap['Phone 1'] || headerMap['Cell 1']) {
                            baselineData.patientDetails.contact = {
                                cell1: headerMap['Phone no1'] || headerMap['Phone 1'] || headerMap['Cell 1'] || ''
                            }
                            if (headerMap['Phone no2'] || headerMap['Phone 2'] || headerMap['Cell 2']) {
                                baselineData.patientDetails.contact.cell2 = headerMap['Phone no2'] || headerMap['Phone 2'] || headerMap['Cell 2']
                            }
                            if (headerMap['Phone 3'] || headerMap['Landline']) {
                                baselineData.patientDetails.contact.landline = headerMap['Phone 3'] || headerMap['Landline']
                            }
                        }

                        // Visit date
                        if (headerMap['Visit Date'] || headerMap['VISIT DATE']) {
                            baselineData.visitDate = new Date(headerMap['Visit Date'] || headerMap['VISIT DATE'])
                        } else {
                            baselineData.visitDate = new Date()
                        }

                        // Diagnosis fields
                        if (headerMap['FINAL DIAGNOSIS 1'] || headerMap['Diagnosis'] || headerMap['DIAGNOSIS']) {
                            baselineData.diagnosis = {
                                diagnosisType: 'Congenital',
                                isolatedGHD: headerMap['FINAL DIAGNOSIS 1'] || headerMap['Diagnosis'] || headerMap['DIAGNOSIS'] || '',
                                hypopituitarism: headerMap['FINAL DIAGNOSIS 1'] || headerMap['Diagnosis'] || headerMap['DIAGNOSIS'] || ''
                            }
                        }

                        // MRI fields
                        if (headerMap['MRI Performed'] || headerMap['MRI PERFORMED']) {
                            if (!baselineData.mri) baselineData.mri = {}
                            baselineData.mri.performed = headerMap['MRI Performed'] || headerMap['MRI PERFORMED']
                        }
                        if (headerMap['MRI Date'] || headerMap['MRI DATE']) {
                            if (!baselineData.mri) baselineData.mri = {}
                            baselineData.mri.date = new Date(headerMap['MRI Date'] || headerMap['MRI DATE'])
                        }

                        // History fields
                        if (headerMap['Birth Weight'] || headerMap['BIRTH WEIGHT']) {
                            if (!baselineData.history) baselineData.history = {}
                            if (!baselineData.history.birthHistory) baselineData.history.birthHistory = {}
                            baselineData.history.birthHistory.birthWeight = parseFloat(headerMap['Birth Weight'] || headerMap['BIRTH WEIGHT']) || 0
                        }
                        if (headerMap['Birth Length'] || headerMap['BIRTH LENGTH']) {
                            if (!baselineData.history) baselineData.history = {}
                            if (!baselineData.history.birthHistory) baselineData.history.birthHistory = {}
                            baselineData.history.birthHistory.birthLength = parseFloat(headerMap['Birth Length'] || headerMap['BIRTH LENGTH']) || 0
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
                            if (baselineData.mri) updateData.mri = baselineData.mri
                            if (baselineData.history) updateData.history = baselineData.history

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
                    followupCreated: results.followupCreated,
                    followupSkipped: results.followupSkipped,
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
            'S.NO', 'PAEC No', 'PATIENT NAME', 'UHID', 'SEX', 'AGE', 'DOB', 'Address', 'City', 'State',
            'Phone no1', 'Phone no2', 'Phone 3', 'Visit Date', 'Form Type',
            'FINAL DIAGNOSIS 1', 'Diagnosis Type',
            'Birth Weight', 'Birth Length', 'Birth Duration', 'Delivery Place', 'Delivery Nature',
            'Father Age', 'Father Height', 'Mother Age', 'Mother Height', 'MPH',
            'Short Stature Noticed At', 'Thelarche Age', 'Menarche Age',
            'Height', 'Height Age', 'Height SDS', 'Weight', 'Weight Age', 'Weight SDS', 'BMI', 'BMI SDS',
            'Face', 'Thyroid', 'Pubertal Status', 'Axillary Hair', 'Pubic Hair', 'Testicular Volume Right', 'Testicular Volume Left', 'Breast', 'SPL',
            'MRI Performed', 'MRI Date', 'MRI Contrast Used', 'MRI Place', 'MRI Films Available', 'MRI CD Available', 'MRI Scanned',
            'Anterior Pituitary Hypoplasia', 'Pituitary Stalk Interruption', 'Ectopic Posterior Pituitary', 'Pituitary Size MM', 'Other MRI Findings',
            'HB', 'ESR', 'TLC', 'DLC P', 'DLC L', 'DLC E', 'DLC M', 'DLC B', 'PBF Cytic', 'PBF Chromic',
            'S Creat', 'SGOT', 'SGPT', 'S Albumin', 'S Glob', 'S Ca', 'S PO4', 'SAP', 'S Na', 'S K', 'FBS', 'EGFR',
            'Urine Lowest PH', 'Urine Albumin', 'Urine Glucose', 'Urine Microscopy',
            'STTG Value', 'STTG Place', 'Xray Chest', 'Xray Skull', 'Bone Age Date', 'Bone Age Value', 'GP Scoring',
            'T4', 'Free T4', 'TSH', 'LH', 'FSH', 'PRL', 'ACTH', 'Cortisol 8AM', 'IGF1', 'Estradiol', 'Testosterone',
            'GH Stimulation Type', 'GH Stimulation Date', 'GH Stimulation Place', 'Outside Place', 'Tests Done', 'Single Test Type', 'Peak GH Level', 'Exact Peak GH', 'Peak GH Time',
            'Hypothyroidism Present', 'Hypothyroidism Diagnosis Date', 'Hypothyroidism Treatment Start Date', 'Hypothyroidism Current Dose', 'Hypothyroidism Dose Changed', 'Hypothyroidism Last T4', 'Hypothyroidism Source',
            'Hypocortisolism Present', 'Hypocortisolism Diagnosis Date', 'ACTH Stim Test', 'Test Date', 'Peak Cortisol', 'Hypocortisolism Treatment Start Date', 'Steroid Type', 'Current Dose', 'Frequency', 'Daily Dose MG', 'Hypocortisolism Dose Changed', 'Hypocortisolism Source',
            'DI Present', 'DI Diagnosis Date', 'Minirin', 'DI Dose', 'DI Frequency',
            'Hypogonadism Present', 'Hypogonadism Diagnosis Date', 'Hypogonadism Treatment Start Date', 'Full Adult Dose Date', 'Hormone Type', 'MPA Start Date', 'Hypogonadism Current Dose', 'Hypogonadism Dose Changed',
            'Calcium Supplement', 'Vitamin D Supplement', 'Iron Supplement', 'Antiepileptics', 'Other Drugs',
            'Diagnosis Type', 'Isolated GHD', 'Hypopituitarism', 'Affected Axes Thyroid', 'Affected Axes Cortisol', 'Affected Axes Gonadal', 'Affected Axes DI', 'MRI Abnormality'
        ],
        [
            1, 'PAEC001', 'John Doe', 'UHID123456', 'Male', 14, '2010-05-15', '123 Main St', 'New Delhi', 'Delhi',
            '9876543210', '9876543211', '01123456789', '2024-01-15', 'Baseline',
            'Isolated GHD', 'Congenital',
            2.5, 45, 'Full Term', 'Hospital', 'Normal',
            45, 170, 40, 160, 165,
            '2 years', 12, 14,
            140, 12, -2.5, 35, 12, -1.8, 17.9, -1.2,
            'Normal', 'Normal', 'Prepubertal', 'Absent', 'I', '2ml', '2ml', 'I', 'Normal',
            'Yes', '2024-01-10', 'Yes', 'AIIMS', 'Yes', 'No', 'Yes',
            'Present', 'Absent', 'Present', 3.5, 'Normal pituitary gland',
            12.5, 15, 8000, 60, 30, 5, 3, 2, 'Normo', 'Normo',
            0.8, 25, 30, 4.2, 3.1, 9.5, 4.2, 200, 140, 4.0, 85, 90,
            6.5, 'Negative', 'Negative', 'Normal',
            'Normal', 'AIIMS', 'Normal', 'Normal', '2024-01-10', '12 years', true,
            8.5, 1.2, 2.5, 1.2, 3.5, 15, 25, 12.5, 180, 15, 0.8,
            'Clonidine', '2024-01-12', 'AIIMS', '', 2, '', '<10', 8.5, '30 min',
            'Yes', '2024-01-01', '2024-01-02', '50 mcg', 'No', 8.5, 'Hospital Supply',
            'No', '', '', '', '', '', '', '', '', '', '',
            'No', '', '', '', '', '',
            'No', '', '', '', '', '', '', '',
            true, true, false, false, '',
            'Congenital', 'Yes', 'No', 'Yes', 'No', 'No', 'No', 'Present'
        ],
        [
            2, 'PAEC002', 'Jane Smith', 'UHID123457', 'Female', 12, '2012-03-20', '456 Oak Ave', 'Mumbai', 'Maharashtra',
            '9876543212', '9876543213', '01123456790', '2024-01-16', 'Followup',
            'Hypopituitarism', 'Congenital',
            2.8, 48, 'Full Term', 'Hospital', 'Normal',
            42, 168, 38, 158, 163,
            '3 years', 11, 13,
            135, 11, -2.8, 32, 11, -2.0, 17.5, -1.5,
            'Normal', 'Normal', 'Prepubertal', 'Absent', 'I', '', '', 'I', 'Normal',
            'Yes', '2024-01-11', 'Yes', 'AIIMS', 'Yes', 'No', 'Yes',
            'Present', 'Present', 'Present', 2.8, 'Abnormal findings',
            11.8, 18, 7500, 55, 35, 6, 2, 2, 'Normo', 'Normo',
            0.7, 22, 28, 4.0, 3.0, 9.2, 4.0, 180, 138, 3.8, 82, 88,
            6.8, 'Negative', 'Negative', 'Normal',
            'Normal', 'AIIMS', 'Normal', 'Normal', '2024-01-11', '11 years', true,
            7.8, 1.0, 3.2, 1.5, 4.2, 18, 30, 11.8, 175, 12, 0.6,
            'Glucagon', '2024-01-13', 'AIIMS', '', 1, 'Glucagon', '<7', 6.5, '90 min',
            'Yes', '2024-01-01', '2024-01-02', '75 mcg', 'No', 7.8, 'Hospital Supply',
            'No', '', '', '', '', '', '', '', '', '', '',
            'No', '', '', '', '', '', '', '', '',
            'No', '', '', '', '', '', '', '',
            true, true, true, false, '',
            'Congenital', 'No', 'Yes', 'Yes', 'Yes', 'No', 'No', 'Present'
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