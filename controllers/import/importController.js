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

                    // Normalize PAEC No and prepare data (create or update)
                    const normalizedPaecNo = String(paecNo).trim()

                    // Handle baseline form only (simplified for essential fields)
                    const baselineData = {
                        patientDetails: {
                            paecNo: normalizedPaecNo
                        },
                        visitDate: new Date().toString()
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

                    // Check if baseline exists first to track create vs update
                    const existingBaseline = await BaselineForm.findOne({
                        'patientDetails.paecNo': normalizedPaecNo,
                        'isDeleted.status': false
                    })

                    if (existingBaseline) {
                        // Update existing baseline
                        console.log(`📝 UPDATING existing record for PAEC ${normalizedPaecNo}`)
                        console.log(`Before update - Sex: ${existingBaseline.patientDetails?.sex}`)
                        Object.assign(existingBaseline, baselineData)
                        existingBaseline.updatedBy.push({
                            user: req.user._id,
                            updatedAt: new Date()
                        })
                        await existingBaseline.save()
                        console.log(`After update - Sex: ${existingBaseline.patientDetails?.sex}`)
                        results.baselineUpdated++
                    } else {
                        // Create new baseline
                        console.log(`✨ CREATING new record for PAEC ${normalizedPaecNo}`)
                        baselineData.createdBy = req.user._id
                        baselineData.center = req.user.center
                        const newBaseline = new BaselineForm(baselineData)
                        await newBaseline.save()
                        console.log(`Created with Sex: ${newBaseline.patientDetails?.sex}`)
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
                action: 'created',
                module: 'baselineform',
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


export const importNewExcelForm = asyncHandler(async (req, res) => {
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
            const hasPaecNo = headers.some(h => h && h.toString().toUpperCase().includes('PAEC'))

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

                    // Debug: log the header map for first few rows
                    if (i <= 3) {
                        console.log(`Row ${i} headers found:`, Object.keys(headerMap))
                        console.log(`Row ${i} data:`, headerMap)
                    }

                    // Only PAEC No is mandatory
                    const paecNo = headerMap['PAEC'] || headerMap['PAEC NO'] || headerMap['paec no']
                    if (!paecNo) {
                        results.errors.push({
                            row: i + 1,
                            error: 'PAEC No is required'
                        })
                        continue
                    }

                    results.total++

                    // Normalize PAEC No and prepare the base document
                    const normalizedPaecNo = String(paecNo).trim()

                    // Handle baseline form with all Excel fields
                    const baselineData = {
                        patientDetails: {
                            paecNo: normalizedPaecNo
                        },
                        visitDate: new Date().toString()
                    }

                    // Map patient details with debugging
                    console.log(`\n=== Processing PAEC ${normalizedPaecNo} ===`)

                    if (headerMap['Name']) {
                        baselineData.patientDetails.name = headerMap['Name']
                        console.log(`✓ Name: ${headerMap['Name']}`)
                    } else {
                        console.log(`✗ Name not found`)
                    }

                    if (headerMap['DOB']) {
                        baselineData.patientDetails.dob = headerMap['DOB']
                        console.log(`✓ DOB: ${headerMap['DOB']}`)
                    } else {
                        console.log(`✗ DOB not found`)
                    }

                    if (headerMap['AgeBL']) {
                        baselineData.patientDetails.age = headerMap['AgeBL']
                        console.log(`✓ Age: ${headerMap['AgeBL']}`)
                    } else {
                        console.log(`✗ AgeBL not found`)
                    }

                    if (headerMap['Sex M1 F2']) {
                        const sex = headerMap['Sex M1 F2']
                        console.log(`✓ Sex found - Value: ${sex}, Type: ${typeof sex}`)
                        if (sex === 1 || sex === '1') {
                            baselineData.patientDetails.sex = 'Male'
                            console.log(`✓ Mapped to: Male`)
                        } else if (sex === 2 || sex === '2') {
                            baselineData.patientDetails.sex = 'Female'
                            console.log(`✓ Mapped to: Female`)
                        } else {
                            console.log(`✗ Sex value ${sex} not recognized (should be 1 or 2)`)
                        }
                    } else {
                        console.log(`✗ Sex M1 F2 header not found`)
                    }

                    console.log(`Final patientDetails:`, JSON.stringify(baselineData.patientDetails, null, 2))

                    // Add a summary of all sections being processed
                    const sections = []
                    if (baselineData.patientDetails) sections.push('PatientDetails')
                    if (baselineData.diagnosis) sections.push('Diagnosis')
                    if (baselineData.history) sections.push('History')
                    if (baselineData.examination) sections.push('Examination')
                    if (baselineData.endocrineWorkup) sections.push('EndocrineWorkup')
                    if (baselineData.mri) sections.push('MRI')
                    if (baselineData.treatment) sections.push('Treatment')
                    console.log(`📊 Sections being processed: ${sections.join(', ')}`)

                    // Map diagnosis information
                    if (headerMap['Diagnosis'] || headerMap['Congenital 1 AquTumor 2'] || headerMap['Pre GH-IGHD 1 MPHD 2']) {
                        baselineData.diagnosis = {
                            diagnosisPresent: true,
                            diagnosisType: (headerMap['Congenital 1 AquTumor 2'] === 1 || headerMap['Congenital 1 AquTumor 2'] === '1') ? 'Congenital' : 'Acquired',
                            isolatedGHD: (headerMap['Pre GH-IGHD 1 MPHD 2'] === 1 || headerMap['Pre GH-IGHD 1 MPHD 2'] === '1') ? 'Yes' : 'No',
                            hypopituitarism: (headerMap['Pre GH-IGHD 1 MPHD 2'] === 2 || headerMap['Pre GH-IGHD 1 MPHD 2'] === '2') ? 'Yes' : 'No',
                            mriAbnormality: headerMap['Diagnosis'] || ''
                        }
                        console.log(`✓ Diagnosis mapped: ${JSON.stringify(baselineData.diagnosis)}`)
                    }

                    // Map history information
                    if (headerMap['MotherHt'] || headerMap['FatherHt'] || headerMap['MPH'] || headerMap['MPH SDS']) {
                        baselineData.history = {
                            familyHistory: {
                                familyHistoryPresent: true,
                                father: {
                                    height: headerMap['FatherHt'] || '',
                                    isMeasured: headerMap['FatherHt'] ? 'Yes' : 'No'
                                },
                                mother: {
                                    height: headerMap['MotherHt'] || '',
                                    isMeasured: headerMap['MotherHt'] ? 'Yes' : 'No'
                                },
                                mph: headerMap['MPH'] || '',
                                mphSds: headerMap['MPH SDS'] || ''
                            }
                        }
                    }

                    // Map examination and measurements
                    if (headerMap['HtBL'] || headerMap['Ht BL SDS'] || headerMap['Wt0'] || headerMap['Wt0 SDS'] || headerMap['bmi0'] || headerMap['bmi0 SDS']) {
                        baselineData.examination = {
                            examinationPresent: true,
                            date: headerMap['Date of Diagnosis'] || new Date().toString(),
                            measurements: {
                                measurementsPresent: true,
                                height: headerMap['HtBL'] || '',
                                heightAge: headerMap['aagebl'] || '',
                                heightSds: headerMap['Ht BL SDS'] || '',
                                weight: headerMap['wt0'] || '',
                                weightSds: headerMap['Wt0 SDS'] || '',
                                bmi: headerMap['bmi0'] || '',
                                bmiSds: headerMap['bmi0 SDS'] || ''
                            }
                        }
                        console.log(`✓ Examination mapped with height: ${headerMap['HtBL']}, weight: ${headerMap['wt0']}`)
                    }

                    // Map bone age data
                    if (headerMap['ba0'] || headerMap['ba1'] || headerMap['ba2'] || headerMap['ba3'] || headerMap['ba4'] || headerMap['ba5'] || headerMap['ba6'] || headerMap['ba7'] || headerMap['BA8']) {
                        if (!baselineData.examination) baselineData.examination = { examinationPresent: true }
                        if (!baselineData.examination.imaging) baselineData.examination.imaging = { imagingPresent: true }

                        baselineData.examination.imaging.boneAge = {
                            boneAgePresent: true,
                            date: headerMap['Date of Diagnosis'] || new Date().toString(),
                            value: `${headerMap['ba0'] || ''}${headerMap['ba1'] || ''}${headerMap['ba2'] || ''}${headerMap['ba3'] || ''}${headerMap['ba4'] || ''}${headerMap['ba5'] || ''}${headerMap['ba6'] || ''}${headerMap['ba7'] || ''}${headerMap['BA8'] || ''}`.replace(/^0+/, '') || '0',
                            gpScoring: true
                        }
                    }

                    // Map puberty status
                    if (headerMap['inducedpub Y 1 N 2'] || headerMap['delayedpub Y 1 N 2'] || headerMap['spontpub Y 1 N 2'] || headerMap['PUBSTATUS0'] || headerMap['PUBSTATUS1'] || headerMap['pubsts2'] || headerMap['pubstatus3'] || headerMap['pubsts4'] || headerMap['PUBSTS5'] || headerMap['PUBSTS6'] || headerMap['PUBST7']) {
                        if (!baselineData.examination) baselineData.examination = { examinationPresent: true }
                        if (!baselineData.examination.physicalFindings) baselineData.examination.physicalFindings = { physicalFindingsPresent: true }

                        let pubertalStatus = 'Prepubertal'
                        if (headerMap['spontpub Y 1 N 2'] === '1') pubertalStatus = 'Pubertal'
                        else if (headerMap['delayedpub Y 1 N 2'] === '1') pubertalStatus = 'Delayed'
                        else if (headerMap['inducedpub Y 1 N 2'] === '1') pubertalStatus = 'Induced'

                        baselineData.examination.physicalFindings.pubertalStatus = pubertalStatus
                        baselineData.examination.physicalFindings.pubicHair = headerMap['PUBSTATUS0'] || 'I'
                        baselineData.examination.physicalFindings.breast = headerMap['PUBSTATUS0'] || 'I'
                        baselineData.examination.physicalFindings.testicularVolume = {
                            right: headerMap['PUBSTATUS0'] || '1',
                            left: headerMap['PUBSTATUS0'] || '1'
                        }
                    }

                    // Map GH stimulation test
                    if (headerMap['GHST First date'] || headerMap['ClonidinePeakGH'] || headerMap['Clonidine Peak GH Time'] || headerMap['GlucagonpeakGHlevel'] || headerMap['Glucagon Peak Time']) {
                        baselineData.endocrineWorkup = {
                            endocrineWorkupPresent: true,
                            date: headerMap['GHST First date'] || new Date().toString(),
                            ghStimulationTest: {
                                ghStimulationTestPresent: true,
                                date: headerMap['GHST First date'] || new Date().toString(),
                                place: 'AIIMS',
                                results: []
                            }
                        }

                        // Add Clonidine results if available
                        if (headerMap['ClonidinePeakGH'] && headerMap['Clonidine Peak GH Time']) {
                            baselineData.endocrineWorkup.ghStimulationTest.results.push({
                                time: headerMap['Clonidine Peak GH Time'] || '0 min',
                                clonidineGH: headerMap['ClonidinePeakGH'] || '',
                                glucagonGH: ''
                            })
                        }

                        // Add Glucagon results if available
                        if (headerMap['GlucagonpeakGHlevel'] && headerMap['Glucagon Peak Time']) {
                            baselineData.endocrineWorkup.ghStimulationTest.results.push({
                                time: headerMap['Glucagon Peak Time'] || '0 min',
                                clonidineGH: '',
                                glucagonGH: headerMap['GlucagonpeakGHlevel'] || ''
                            })
                        }

                        // Set peak GH level
                        if (headerMap['ClonidinePeakGH'] || headerMap['GlucagonpeakGHlevel']) {
                            const peakGH = Math.max(
                                parseFloat(headerMap['ClonidinePeakGH'] || '0'),
                                parseFloat(headerMap['GlucagonpeakGHlevel'] || '0')
                            )
                            baselineData.endocrineWorkup.ghStimulationTest.peakGHLevel = peakGH < 10 ? '<10' : peakGH < 7 ? '<7' : peakGH < 5 ? '<5' : peakGH.toString()
                            baselineData.endocrineWorkup.ghStimulationTest.exactPeakGH = peakGH.toString()
                        }
                    }

                    // Map MRI findings
                    if (headerMap['MRI Yes 1 or no 2'] || headerMap['MRIfindings'] || headerMap['antepit'] || headerMap['pitstalk'] || headerMap['ectoposte']) {
                        baselineData.mri = {
                            mriDetailsPresent: true,
                            performed: headerMap['MRI Yes 1 or no 2'] === '1' ? 'Yes' : 'No',
                            date: headerMap['Date of Diagnosis'] || new Date().toString(),
                            findings: {
                                mriFindingsPresent: true,
                                anteriorPituitaryHypoplasia: headerMap['antepit'] || '',
                                pituitaryStalkInterruption: headerMap['pitstalk'] || '',
                                ectopicPosteriorPituitary: headerMap['ectoposte'] || '',
                                otherFindings: headerMap['MRIfindings'] || ''
                            }
                        }
                    }

                    // Map treatment information
                    baselineData.treatment = {
                        treatmentDetailsPresent: true
                    }

                    // Hypothyroidism
                    if (headerMap['PreGH-Hypothyroidism Y 1 N 2'] || headerMap['Start Date Thyronorm'] || headerMap['Post GH-Hypothyroid Y 1 N 2']) {
                        const preGH = headerMap['PreGH-Hypothyroidism Y 1 N 2']
                        const postGH = headerMap['Post GH-Hypothyroid Y 1 N 2']
                        baselineData.treatment.hypothyroidism = {
                            hypothyroidismPresent: (preGH === 1 || preGH === '1') || (postGH === 1 || postGH === '1'),
                            diagnosisDate: headerMap['Date of Diagnosis'] || '',
                            treatmentStartDate: headerMap['Start Date Thyronorm'] || '',
                            currentDose: '25mcg',
                            source: 'hospital supply'
                        }
                        console.log(`✓ Hypothyroidism mapped: PreGH=${preGH}, PostGH=${postGH}, StartDate=${headerMap['Start Date Thyronorm']}`)
                    }

                    // Hypocortisolism
                    if (headerMap['PreGH-Hypocort  Y 1 N 2'] || headerMap['StartDate-Steroid'] || headerMap['PostGH-Hypocort Y 1 N 2']) {
                        const preGHCort = headerMap['PreGH-Hypocort  Y 1 N 2']
                        const postGHCort = headerMap['PostGH-Hypocort Y 1 N 2']
                        baselineData.treatment.hypocortisolism = {
                            hypocortisolismPresent: (preGHCort === 1 || preGHCort === '1') || (postGHCort === 1 || postGHCort === '1'),
                            diagnosisDate: headerMap['Date of Diagnosis'] || '',
                            treatmentStartDate: headerMap['StartDate-Steroid'] || '',
                            steroidType: 'Prednisolone',
                            currentDose: '5mg',
                            frequency: 'OD',
                            dailyDoseMG: '5',
                            source: 'hospital supply'
                        }
                        console.log(`✓ Hypocortisolism mapped: PreGH=${preGHCort}, PostGH=${postGHCort}`)
                    }

                    // Hypogonadism
                    if (headerMap['PreGH-Hypogonadism Y 1 N 2'] || headerMap['StartDate-Hypogonadism'] || headerMap['PostGH-Hypogonadism Y 1 N 2']) {
                        baselineData.treatment.hypogonadism = {
                            hypogonadismPresent: headerMap['PreGH-Hypogonadism Y 1 N 2'] === '1' || headerMap['PostGH-Hypogonadism Y 1 N 2'] === '1',
                            diagnosisDate: headerMap['Date of Diagnosis'] || '',
                            treatmentStartDate: headerMap['StartDate-Hypogonadism'] || '',
                            hormoneType: 'Testosterone'
                        }
                    }

                    // Diabetes Insipidus
                    if (headerMap['Pre-GH Minirin Y 1 N 2'] || headerMap['StartDate-Minirin'] || headerMap['PostGH-Minirin Y 1 N 2']) {
                        baselineData.treatment.di = {
                            iabetesInsipidusPresent: headerMap['Pre-GH Minirin Y 1 N 2'] === '1' || headerMap['PostGH-Minirin Y 1 N 2'] === '1',
                            diagnosisDate: headerMap['Date of Diagnosis'] || '',
                            minirin: 'Yes',
                            dose: 'full',
                            frequency: '1'
                        }
                    }

                    // Map height and weight measurements over time
                    const heightMeasurements = []
                    const weightMeasurements = []

                    // Height measurements
                    for (let j = 0; j <= 8; j++) {
                        const ageKey = j === 0 ? 'aagebl' : `age${j}`
                        const heightKey = j === 0 ? 'HtBL' : j === 1 ? 'Ht1YR' : j === 1.5 ? 'Ht1.5YR' : j === 2 ? 'Ht2.5YR' : j === 3 ? 'Ht3.5YR' : j === 4 ? 'Ht4.5YR' : j === 5 ? 'Ht5YR' : j === 6 ? 'Ht6YR' : j === 7 ? 'Ht7YR' : `ht${j}yr`
                        const heightSdsKey = j === 0 ? 'Ht BL SDS' : j === 1 ? 'Ht 1YR  SDS' : ''

                        if (headerMap[ageKey] && headerMap[heightKey]) {
                            heightMeasurements.push({
                                age: headerMap[ageKey],
                                height: headerMap[heightKey],
                                heightSds: headerMap[heightSdsKey] || ''
                            })
                        }
                    }

                    // Weight measurements
                    for (let j = 0; j <= 8; j++) {
                        const weightKey = j === 0 ? 'wt0' : `wt${j}`
                        const weightSdsKey = j === 0 ? 'Wt0 SDS' : j === 1 ? 'Wt1 Sds' : ''
                        const bmiKey = j === 0 ? 'bmi0' : `bmi${j}`
                        const bmiSdsKey = j === 0 ? 'bmi0 SDS' : j === 1 ? 'bmi1 sds' : ''

                        if (headerMap[weightKey]) {
                            weightMeasurements.push({
                                age: j === 0 ? headerMap['aagebl'] : j.toString(),
                                weight: headerMap[weightKey],
                                weightSds: headerMap[weightSdsKey] || '',
                                bmi: headerMap[bmiKey] || '',
                                bmiSds: headerMap[bmiSdsKey] || ''
                            })
                        }
                    }

                    // Store measurements in remarks for now (can be enhanced later)
                    if (heightMeasurements.length > 0 || weightMeasurements.length > 0) {
                        if (!baselineData.remarks) baselineData.remarks = {}
                        baselineData.remarks.measurements = `Height measurements: ${JSON.stringify(heightMeasurements)}, Weight measurements: ${JSON.stringify(weightMeasurements)}`
                    }

                    // Check if baseline exists first to track create vs update
                    const existingBaseline = await BaselineForm.findOne({
                        'patientDetails.paecNo': normalizedPaecNo,
                        'isDeleted.status': false
                    })

                    if (existingBaseline) {
                        // Update existing baseline
                        console.log(`📝 UPDATING existing record for PAEC ${normalizedPaecNo}`)
                        console.log(`Before update - Sex: ${existingBaseline.patientDetails?.sex}`)
                        Object.assign(existingBaseline, baselineData)
                        existingBaseline.updatedBy.push({
                            user: req.user._id,
                            updatedAt: new Date()
                        })
                        await existingBaseline.save()
                        console.log(`After update - Sex: ${existingBaseline.patientDetails?.sex}`)
                        results.baselineUpdated++
                    } else {
                        // Create new baseline
                        console.log(`✨ CREATING new record for PAEC ${normalizedPaecNo}`)
                        baselineData.createdBy = req.user._id
                        baselineData.center = req.user.center
                        const newBaseline = new BaselineForm(baselineData)
                        await newBaseline.save()
                        console.log(`Created with Sex: ${newBaseline.patientDetails?.sex}`)
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
                action: 'created',
                module: 'baselineform',
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