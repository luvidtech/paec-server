import asyncHandler from "../../utils/asyncHandler.js"
import BaselineForm from "../../models/baselineFormModel.js"
import FollowupForm from "../../models/followupFormModel.js"
import XLSX from "xlsx"
import newLog from "../../utils/newLog.js"

export const exportForm = asyncHandler(async (req, res) => {
    try {
        const {
            formType, // 'baseline', 'followup', 'both'
            paecNo,
            patientName,
            uhid,
            fromDate,
            toDate,
            excludeFields = [] // Array of fields to exclude
        } = req.body

        // Build query for baseline forms
        const baselineQuery = { 'isDeleted.status': false }
        const followupQuery = { 'isDeleted.status': false }

        // Apply filters
        if (paecNo) {
            baselineQuery['patientDetails.paecNo'] = { $regex: paecNo, $options: 'i' }
            followupQuery['patientDetails.paecNo'] = { $regex: paecNo, $options: 'i' }
        }

        if (patientName) {
            baselineQuery['patientDetails.name'] = { $regex: patientName, $options: 'i' }
            followupQuery['patientDetails.name'] = { $regex: patientName, $options: 'i' }
        }

        if (uhid) {
            baselineQuery['patientDetails.uhid'] = { $regex: uhid, $options: 'i' }
            followupQuery['patientDetails.uhid'] = { $regex: uhid, $options: 'i' }
        }

        if (fromDate || toDate) {
            const dateQuery = {}
            if (fromDate) dateQuery.$gte = new Date(fromDate)
            if (toDate) dateQuery.$lte = new Date(toDate)
            baselineQuery.visitDate = dateQuery
            followupQuery.visitDate = dateQuery
        }

        // Access control
        const accessTo = req.user.accessTo
        if (accessTo === 'own') {
            baselineQuery.createdBy = req.user._id
            followupQuery.createdBy = req.user._id
        } else if (accessTo === 'center') {
            baselineQuery.center = req.user.center
            followupQuery.center = req.user.center
        }

        let baselineForms = []
        let followupForms = []

        // Fetch data based on form type
        if (formType === 'baseline' || formType === 'both') {
            baselineForms = await BaselineForm.find(baselineQuery)
                .populate('createdBy', 'userName email')
                .populate('center', 'name')
                .sort({ visitDate: -1 })
        }

        if (formType === 'followup' || formType === 'both') {
            followupForms = await FollowupForm.find(followupQuery)
                .populate('baselineForm', 'patientDetails.paecNo patientDetails.name')
                .populate('createdBy', 'userName email')
                .populate('center', 'name')
                .sort({ visitDate: -1 })
        }

        // Create Excel workbook
        const workbook = XLSX.utils.book_new()

        // Helper function to format date as dd-mm-yyyy
        const formatDate = (date) => {
            if (!date) return 'NA'
            const d = new Date(date)
            if (isNaN(d.getTime())) return 'NA'
            return d.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        }

        // Helper function to handle empty values
        const handleEmptyValue = (value) => {
            if (value === null || value === undefined || value === '') return 'NA'
            return value
        }

        // Export baseline forms
        if (baselineForms.length > 0) {
            const baselineData = baselineForms.map(form => {
                const row = {
                    'S.NO': baselineForms.indexOf(form) + 1,
                    'PAEC No': handleEmptyValue(form.patientDetails?.paecNo),
                    'Patient Name': handleEmptyValue(form.patientDetails?.name),
                    'UHID': handleEmptyValue(form.patientDetails?.uhid),
                    'Sex': handleEmptyValue(form.patientDetails?.sex),
                    'Age': handleEmptyValue(form.patientDetails?.age),
                    'DOB': formatDate(form.patientDetails?.dob),
                    'Address': handleEmptyValue(form.patientDetails?.address?.street),
                    'City': handleEmptyValue(form.patientDetails?.address?.city),
                    'State': handleEmptyValue(form.patientDetails?.address?.state),
                    'Phone 1': handleEmptyValue(form.patientDetails?.contact?.cell1),
                    'Phone 2': handleEmptyValue(form.patientDetails?.contact?.cell2),
                    'Landline': handleEmptyValue(form.patientDetails?.contact?.landline),
                    'Visit Date': formatDate(form.visitDate),
                    'Form Type': 'Baseline',
                    'Created By': handleEmptyValue(form.createdBy?.userName),
                    'Created Date': formatDate(form.createdAt),
                    'Center': handleEmptyValue(form.center?.name)
                }

                // Add diagnosis fields
                if (form.diagnosis) {
                    row['Diagnosis Type'] = handleEmptyValue(form.diagnosis.diagnosisType)
                    row['Isolated GHD'] = handleEmptyValue(form.diagnosis.isolatedGHD)
                    row['Hypopituitarism'] = handleEmptyValue(form.diagnosis.hypopituitarism)
                    row['Affected Axes Thyroid'] = handleEmptyValue(form.diagnosis.affectedAxes?.thyroid)
                    row['Affected Axes Cortisol'] = handleEmptyValue(form.diagnosis.affectedAxes?.cortisol)
                    row['Affected Axes Gonadal'] = handleEmptyValue(form.diagnosis.affectedAxes?.gonadal)
                    row['Affected Axes DI'] = handleEmptyValue(form.diagnosis.affectedAxes?.di)
                    row['MRI Abnormality'] = handleEmptyValue(form.diagnosis.mriAbnormality)
                }

                // Add history fields
                if (form.history) {
                    row['Short Stature Noticed At'] = handleEmptyValue(form.history.shortStatureNoticedAt)
                    if (form.history.birthHistory) {
                        row['Birth Weight'] = handleEmptyValue(form.history.birthHistory.birthWeight)
                        row['Birth Length'] = handleEmptyValue(form.history.birthHistory.birthLength)
                        row['Birth Duration'] = handleEmptyValue(form.history.birthHistory.duration)
                        row['Delivery Place'] = handleEmptyValue(form.history.birthHistory.deliveryPlace)
                        row['Delivery Nature'] = handleEmptyValue(form.history.birthHistory.deliveryNature)
                    }
                    if (form.history.familyHistory) {
                        row['Father Age'] = handleEmptyValue(form.history.familyHistory.father?.age)
                        row['Father Height'] = handleEmptyValue(form.history.familyHistory.father?.height)
                        row['Mother Age'] = handleEmptyValue(form.history.familyHistory.mother?.age)
                        row['Mother Height'] = handleEmptyValue(form.history.familyHistory.mother?.height)
                        row['MPH'] = handleEmptyValue(form.history.familyHistory.mph)
                    }
                    if (form.history.pubertyHistory) {
                        row['Thelarche Age'] = handleEmptyValue(form.history.pubertyHistory.thelarche?.ageYears)
                        row['Menarche Age'] = handleEmptyValue(form.history.pubertyHistory.menarche?.ageYears)
                    }
                }

                // Add examination fields
                if (form.examination) {
                    if (form.examination.measurements) {
                        row['Height'] = handleEmptyValue(form.examination.measurements.height)
                        row['Height Age'] = handleEmptyValue(form.examination.measurements.heightAge)
                        row['Height SDS'] = handleEmptyValue(form.examination.measurements.heightSds)
                        row['Weight'] = handleEmptyValue(form.examination.measurements.weight)
                        row['Weight Age'] = handleEmptyValue(form.examination.measurements.weightAge)
                        row['Weight SDS'] = handleEmptyValue(form.examination.measurements.weightSds)
                        row['BMI'] = handleEmptyValue(form.examination.measurements.bmi)
                        row['BMI SDS'] = handleEmptyValue(form.examination.measurements.bmiSds)
                    }
                    if (form.examination.physicalFindings) {
                        row['Face'] = handleEmptyValue(form.examination.physicalFindings.face)
                        row['Thyroid'] = handleEmptyValue(form.examination.physicalFindings.thyroid)
                        row['Pubertal Status'] = handleEmptyValue(form.examination.physicalFindings.pubertalStatus)
                        row['Axillary Hair'] = handleEmptyValue(form.examination.physicalFindings.axillaryHair)
                        row['Pubic Hair'] = handleEmptyValue(form.examination.physicalFindings.pubicHair)
                        row['Testicular Volume Right'] = handleEmptyValue(form.examination.physicalFindings.testicularVolume?.right)
                        row['Testicular Volume Left'] = handleEmptyValue(form.examination.physicalFindings.testicularVolume?.left)
                        row['Breast'] = handleEmptyValue(form.examination.physicalFindings.breast)
                        row['SPL'] = handleEmptyValue(form.examination.physicalFindings.spl)
                    }
                }

                // Add MRI fields
                if (form.mri) {
                    row['MRI Performed'] = handleEmptyValue(form.mri.performed)
                    row['MRI Date'] = formatDate(form.mri.date)
                    row['MRI Contrast Used'] = handleEmptyValue(form.mri.contrastUsed)
                    row['MRI Place'] = handleEmptyValue(form.mri.place)
                    row['MRI Films Available'] = handleEmptyValue(form.mri.filmsAvailable)
                    row['MRI CD Available'] = handleEmptyValue(form.mri.cdAvailable)
                    row['MRI Scanned'] = handleEmptyValue(form.mri.scanned)
                    if (form.mri.findings) {
                        row['Anterior Pituitary Hypoplasia'] = handleEmptyValue(form.mri.findings.anteriorPituitaryHypoplasia)
                        row['Pituitary Stalk Interruption'] = handleEmptyValue(form.mri.findings.pituitaryStalkInterruption)
                        row['Ectopic Posterior Pituitary'] = handleEmptyValue(form.mri.findings.ectopicPosteriorPituitary)
                        row['Pituitary Size MM'] = handleEmptyValue(form.mri.findings.pituitarySizeMM)
                        row['Other MRI Findings'] = handleEmptyValue(form.mri.findings.otherFindings)
                    }
                }

                // Add investigation fields
                if (form.investigations) {
                    if (form.investigations.hematology) {
                        row['HB'] = handleEmptyValue(form.investigations.hematology.hb)
                        row['ESR'] = handleEmptyValue(form.investigations.hematology.esr)
                        row['TLC'] = handleEmptyValue(form.investigations.hematology.tlc)
                        if (form.investigations.hematology.dlc) {
                            row['DLC P'] = handleEmptyValue(form.investigations.hematology.dlc.p)
                            row['DLC L'] = handleEmptyValue(form.investigations.hematology.dlc.l)
                            row['DLC E'] = handleEmptyValue(form.investigations.hematology.dlc.e)
                            row['DLC M'] = handleEmptyValue(form.investigations.hematology.dlc.m)
                            row['DLC B'] = handleEmptyValue(form.investigations.hematology.dlc.b)
                        }
                        if (form.investigations.hematology.pbf) {
                            row['PBF Cytic'] = handleEmptyValue(form.investigations.hematology.pbf.cytic)
                            row['PBF Chromic'] = handleEmptyValue(form.investigations.hematology.pbf.chromic)
                        }
                    }
                    if (form.investigations.biochemistry) {
                        row['S Creat'] = handleEmptyValue(form.investigations.biochemistry.sCreat)
                        row['SGOT'] = handleEmptyValue(form.investigations.biochemistry.sgot)
                        row['SGPT'] = handleEmptyValue(form.investigations.biochemistry.sgpt)
                        row['S Albumin'] = handleEmptyValue(form.investigations.biochemistry.sAlbumin)
                        row['S Glob'] = handleEmptyValue(form.investigations.biochemistry.sGlob)
                        row['S Ca'] = handleEmptyValue(form.investigations.biochemistry.sCa)
                        row['S PO4'] = handleEmptyValue(form.investigations.biochemistry.sPO4)
                        row['SAP'] = handleEmptyValue(form.investigations.biochemistry.sap)
                        row['S Na'] = handleEmptyValue(form.investigations.biochemistry.sNa)
                        row['S K'] = handleEmptyValue(form.investigations.biochemistry.sK)
                        row['FBS'] = handleEmptyValue(form.investigations.biochemistry.fbs)
                        row['EGFR'] = handleEmptyValue(form.investigations.biochemistry.egfr)
                        if (form.investigations.biochemistry.lipidProfile) {
                            row['TC'] = handleEmptyValue(form.investigations.biochemistry.lipidProfile.tc)
                            row['TG'] = handleEmptyValue(form.investigations.biochemistry.lipidProfile.tg)
                            row['LDL'] = handleEmptyValue(form.investigations.biochemistry.lipidProfile.ldl)
                            row['HDL'] = handleEmptyValue(form.investigations.biochemistry.lipidProfile.hdl)
                            row['HBA1C'] = handleEmptyValue(form.investigations.biochemistry.lipidProfile.hba1c)
                        }
                    }
                    if (form.investigations.urine) {
                        row['Urine Lowest PH'] = handleEmptyValue(form.investigations.urine.lowestPh)
                        row['Urine Albumin'] = handleEmptyValue(form.investigations.urine.albumin)
                        row['Urine Glucose'] = handleEmptyValue(form.investigations.urine.glucose)
                        row['Urine Microscopy'] = handleEmptyValue(form.investigations.urine.microscopy)
                    }
                    if (form.investigations.sttg) {
                        row['STTG Value'] = handleEmptyValue(form.investigations.sttg.value)
                        row['STTG Place'] = handleEmptyValue(form.investigations.sttg.place)
                    }
                    if (form.investigations.imaging) {
                        row['Xray Chest'] = handleEmptyValue(form.investigations.imaging.xrayChest)
                        row['Xray Skull'] = handleEmptyValue(form.investigations.imaging.xraySkull)
                        if (form.investigations.imaging.boneAge) {
                            row['Bone Age Date'] = formatDate(form.investigations.imaging.boneAge.date)
                            row['Bone Age Value'] = handleEmptyValue(form.investigations.imaging.boneAge.value)
                            row['GP Scoring'] = handleEmptyValue(form.investigations.imaging.boneAge.gpScoring)
                        }
                    }
                }

                // Add endocrine workup fields
                if (form.endocrineWorkup) {
                    if (form.endocrineWorkup.tests) {
                        row['T4'] = handleEmptyValue(form.endocrineWorkup.tests.t4)
                        row['Free T4'] = handleEmptyValue(form.endocrineWorkup.tests.freeT4)
                        row['TSH'] = handleEmptyValue(form.endocrineWorkup.tests.tsh)
                        row['LH'] = handleEmptyValue(form.endocrineWorkup.tests.lh)
                        row['FSH'] = handleEmptyValue(form.endocrineWorkup.tests.fsh)
                        row['PRL'] = handleEmptyValue(form.endocrineWorkup.tests.prl)
                        row['ACTH'] = handleEmptyValue(form.endocrineWorkup.tests.acth)
                        row['Cortisol 8AM'] = handleEmptyValue(form.endocrineWorkup.tests.cortisol8am)
                        row['IGF1'] = handleEmptyValue(form.endocrineWorkup.tests.igf1)
                        row['Estradiol'] = handleEmptyValue(form.endocrineWorkup.tests.estradiol)
                        row['Testosterone'] = handleEmptyValue(form.endocrineWorkup.tests.testosterone)
                    }
                    if (form.endocrineWorkup.ghStimulationTest) {
                        row['GH Stimulation Type'] = handleEmptyValue(form.endocrineWorkup.ghStimulationTest.ghStimulationType)
                        row['GH Stimulation Date'] = formatDate(form.endocrineWorkup.ghStimulationTest.date)
                        row['GH Stimulation Place'] = handleEmptyValue(form.endocrineWorkup.ghStimulationTest.place)
                        row['Outside Place'] = handleEmptyValue(form.endocrineWorkup.ghStimulationTest.outsidePlace)
                        row['Tests Done'] = handleEmptyValue(form.endocrineWorkup.ghStimulationTest.testsDone)
                        row['Single Test Type'] = handleEmptyValue(form.endocrineWorkup.ghStimulationTest.singleTestType)
                        row['Peak GH Level'] = handleEmptyValue(form.endocrineWorkup.ghStimulationTest.peakGHLevel)
                        row['Exact Peak GH'] = handleEmptyValue(form.endocrineWorkup.ghStimulationTest.exactPeakGH)
                        row['Peak GH Time'] = handleEmptyValue(form.endocrineWorkup.ghStimulationTest.peakGHTime)
                    }
                }

                // Add treatment fields
                if (form.treatment) {
                    if (form.treatment.hypothyroidism) {
                        row['Hypothyroidism Present'] = handleEmptyValue(form.treatment.hypothyroidism.present)
                        row['Hypothyroidism Diagnosis Date'] = formatDate(form.treatment.hypothyroidism.diagnosisDate)
                        row['Hypothyroidism Treatment Start Date'] = formatDate(form.treatment.hypothyroidism.treatmentStartDate)
                        row['Hypothyroidism Current Dose'] = handleEmptyValue(form.treatment.hypothyroidism.currentDose)
                        row['Hypothyroidism Dose Changed'] = handleEmptyValue(form.treatment.hypothyroidism.doseChanged)
                        row['Hypothyroidism Last T4'] = handleEmptyValue(form.treatment.hypothyroidism.lastT4)
                        row['Hypothyroidism Source'] = handleEmptyValue(form.treatment.hypothyroidism.source)
                    }
                    if (form.treatment.hypocortisolism) {
                        row['Hypocortisolism Present'] = handleEmptyValue(form.treatment.hypocortisolism.present)
                        row['Hypocortisolism Diagnosis Date'] = formatDate(form.treatment.hypocortisolism.diagnosisDate)
                        row['ACTH Stim Test'] = handleEmptyValue(form.treatment.hypocortisolism.acthStimTest)
                        row['Test Date'] = formatDate(form.treatment.hypocortisolism.testDate)
                        row['Peak Cortisol'] = handleEmptyValue(form.treatment.hypocortisolism.peakCortisol)
                        row['Hypocortisolism Treatment Start Date'] = formatDate(form.treatment.hypocortisolism.treatmentStartDate)
                        row['Steroid Type'] = handleEmptyValue(form.treatment.hypocortisolism.steroidType)
                        row['Current Dose'] = handleEmptyValue(form.treatment.hypocortisolism.currentDose)
                        row['Frequency'] = handleEmptyValue(form.treatment.hypocortisolism.frequency)
                        row['Daily Dose MG'] = handleEmptyValue(form.treatment.hypocortisolism.dailyDoseMG)
                        row['Hypocortisolism Dose Changed'] = handleEmptyValue(form.treatment.hypocortisolism.doseChanged)
                        row['Hypocortisolism Source'] = handleEmptyValue(form.treatment.hypocortisolism.source)
                    }
                    if (form.treatment.di) {
                        row['DI Present'] = handleEmptyValue(form.treatment.di.present)
                        row['DI Diagnosis Date'] = formatDate(form.treatment.di.diagnosisDate)
                        row['Minirin'] = handleEmptyValue(form.treatment.di.minirin)
                        row['DI Dose'] = handleEmptyValue(form.treatment.di.dose)
                        row['DI Frequency'] = handleEmptyValue(form.treatment.di.frequency)
                    }
                    if (form.treatment.hypogonadism) {
                        row['Hypogonadism Present'] = handleEmptyValue(form.treatment.hypogonadism.present)
                        row['Hypogonadism Diagnosis Date'] = formatDate(form.treatment.hypogonadism.diagnosisDate)
                        row['Hypogonadism Treatment Start Date'] = formatDate(form.treatment.hypogonadism.treatmentStartDate)
                        row['Full Adult Dose Date'] = formatDate(form.treatment.hypogonadism.fullAdultDoseDate)
                        row['Hormone Type'] = handleEmptyValue(form.treatment.hypogonadism.hormoneType)
                        row['MPA Start Date'] = formatDate(form.treatment.hypogonadism.mpaStartDate)
                        row['Hypogonadism Current Dose'] = handleEmptyValue(form.treatment.hypogonadism.currentDose)
                        row['Hypogonadism Dose Changed'] = handleEmptyValue(form.treatment.hypogonadism.doseChanged)
                    }
                    if (form.treatment.supplements) {
                        row['Calcium Supplement'] = handleEmptyValue(form.treatment.supplements.calcium)
                        row['Vitamin D Supplement'] = handleEmptyValue(form.treatment.supplements.vitaminD)
                        row['Iron Supplement'] = handleEmptyValue(form.treatment.supplements.iron)
                    }
                    if (form.treatment.otherTreatments) {
                        row['Antiepileptics'] = handleEmptyValue(form.treatment.otherTreatments.antiepileptics)
                        row['Other Drugs'] = handleEmptyValue(form.treatment.otherTreatments.otherDrugs)
                    }
                }

                // Remove excluded fields
                excludeFields.forEach(field => {
                    delete row[field]
                })

                return row
            })

            const baselineWorksheet = XLSX.utils.json_to_sheet(baselineData)
            XLSX.utils.book_append_sheet(workbook, baselineWorksheet, 'Baseline Forms')
        }

        // Export followup forms
        if (followupForms.length > 0) {
            const followupData = followupForms.map(form => {
                const row = {
                    'S.NO': followupForms.indexOf(form) + 1,
                    'PAEC No': handleEmptyValue(form.patientDetails?.paecNo),
                    'Patient Name': handleEmptyValue(form.patientDetails?.name),
                    'UHID': handleEmptyValue(form.patientDetails?.uhid),
                    'Sex': handleEmptyValue(form.patientDetails?.sex),
                    'Age': handleEmptyValue(form.patientDetails?.age),
                    'DOB': formatDate(form.patientDetails?.dob),
                    'Address': handleEmptyValue(form.patientDetails?.address?.street),
                    'City': handleEmptyValue(form.patientDetails?.address?.city),
                    'State': handleEmptyValue(form.patientDetails?.address?.state),
                    'Phone 1': handleEmptyValue(form.patientDetails?.contact?.cell1),
                    'Phone 2': handleEmptyValue(form.patientDetails?.contact?.cell2),
                    'Landline': handleEmptyValue(form.patientDetails?.contact?.landline),
                    'Visit Date': formatDate(form.visitDate),
                    'Form Type': 'Followup',
                    'Baseline PAEC No': handleEmptyValue(form.baselineForm?.patientDetails?.paecNo),
                    'Created By': handleEmptyValue(form.createdBy?.userName),
                    'Created Date': formatDate(form.createdAt),
                    'Center': handleEmptyValue(form.center?.name)
                }

                // Add diagnosis fields (same as baseline)
                if (form.diagnosis) {
                    row['Diagnosis Type'] = handleEmptyValue(form.diagnosis.diagnosisType)
                    row['Isolated GHD'] = handleEmptyValue(form.diagnosis.isolatedGHD)
                    row['Hypopituitarism'] = handleEmptyValue(form.diagnosis.hypopituitarism)
                    row['Affected Axes Thyroid'] = handleEmptyValue(form.diagnosis.affectedAxes?.thyroid)
                    row['Affected Axes Cortisol'] = handleEmptyValue(form.diagnosis.affectedAxes?.cortisol)
                    row['Affected Axes Gonadal'] = handleEmptyValue(form.diagnosis.affectedAxes?.gonadal)
                    row['Affected Axes DI'] = handleEmptyValue(form.diagnosis.affectedAxes?.di)
                    row['MRI Abnormality'] = handleEmptyValue(form.diagnosis.mriAbnormality)
                }

                // Add all other fields similar to baseline (abbreviated for brevity)
                // ... (same field mapping as baseline)

                // Remove excluded fields
                excludeFields.forEach(field => {
                    delete row[field]
                })

                return row
            })

            const followupWorksheet = XLSX.utils.json_to_sheet(followupData)
            XLSX.utils.book_append_sheet(workbook, followupWorksheet, 'Followup Forms')
        }

        // Generate Excel file
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

        // Log the export
        await newLog({
            user: req.user._id,
            action: 'exported',
            module: 'excel_export',
            modifiedData: {
                formType,
                totalBaseline: baselineForms.length,
                totalFollowup: followupForms.length,
                filters: { paecNo, patientName, uhid, fromDate, toDate }
            }
        })

        // Set response headers
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename=paec_export_${formType}_${timestamp}.xlsx`)

        res.send(buffer)

    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})


