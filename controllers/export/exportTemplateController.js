import asyncHandler from "../../utils/asyncHandler.js"
import BaselineForm from "../../models/baselineFormModel.js"
import XLSX from "xlsx"
import newLog from "../../utils/newLog.js"

// Exports BaselineForm data in the same format accepted by import template
export const exportImportTemplateFormat = asyncHandler(async (req, res) => {
    const {
        paecNo,
        patientName,
        uhid,
        fromDate,
        toDate,
    } = req.body || {}

    // Build query with access control
    const query = { "isDeleted.status": false }

    // Access control
    const accessTo = req.user?.accessTo
    if (accessTo === "own") {
        query.createdBy = req.user._id
    } else if (accessTo === "center") {
        query.center = req.user.center
    }

    // Filters
    if (Array.isArray(paecNo) && paecNo.length > 0) {
        query["patientDetails.paecNo"] = { $in: paecNo }
    } else if (paecNo) {
        query["patientDetails.paecNo"] = { $regex: paecNo, $options: "i" }
    }

    if (Array.isArray(patientName) && patientName.length > 0) {
        query.$or = [
            ...(query.$or || []),
            ...patientName.map(val => ({
                "patientDetails.name": { $regex: val, $options: "i" }
            }))
        ]
    } else if (patientName) {
        query["patientDetails.name"] = { $regex: patientName, $options: "i" }
    }

    if (Array.isArray(uhid) && uhid.length > 0) {
        query.$or = [
            ...(query.$or || []),
            ...uhid.map(val => ({
                "patientDetails.uhid": { $regex: val, $options: "i" }
            }))
        ]
    } else if (uhid) {
        query["patientDetails.uhid"] = { $regex: uhid, $options: "i" }
    }

    if (fromDate || toDate) {
        const dateQuery = {}
        if (fromDate) dateQuery.$gte = new Date(fromDate)
        if (toDate) dateQuery.$lte = new Date(toDate)
        query.createdAt = dateQuery
    }

    const baselineForms = await BaselineForm.find(query)
        .populate("createdBy", "userName email")
        .populate("center", "name")
        .sort({ createdAt: -1 })

    // Prepare worksheet headers to include all data used by new import
    const headers = [
        // Core identifiers
        "PAEC", "Name", "DOB", "AgeBL", "Sex M1 F2",
        // Diagnosis mapping
        "Diagnosis", "Congenital 1 AquTumor 2", "Pre GH-IGHD 1 MPHD 2",
        // Family history
        "MotherHt", "FatherHt", "MPH", "MPH SDS",
        // Measurements at baseline
        "HtBL", "Ht BL SDS", "wt0", "Wt0 SDS", "bmi0", "bmi0 SDS", "aagebl",
        // Dates
        "Date of Diagnosis",
        // Bone age fragments
        "ba0", "ba1", "ba2", "ba3", "ba4", "ba5", "ba6", "ba7", "BA8",
        // Puberty status
        "inducedpub Y 1 N 2", "delayedpub Y 1 N 2", "spontpub Y 1 N 2",
        "PUBSTATUS0", "PUBSTATUS1", "pubsts2", "pubstatus3", "pubsts4", "PUBSTS5", "PUBSTS6", "PUBST7",
        // GH Stimulation Test
        "GHST First date", "ClonidinePeakGH", "Clonidine Peak GH Time", "GlucagonpeakGHlevel", "Glucagon Peak Time",
        // MRI
        "MRI Yes 1 or no 2", "MRIfindings", "antepit", "pitstalk", "ectoposte",
        // Treatments
        "PreGH-Hypothyroidism Y 1 N 2", "Start Date Thyronorm", "Post GH-Hypothyroid Y 1 N 2",
        "PreGH-Hypocort  Y 1 N 2", "StartDate-Steroid", "PostGH-Hypocort Y 1 N 2",
        "PreGH-Hypogonadism Y 1 N 2", "StartDate-Hypogonadism", "PostGH-Hypogonadism Y 1 N 2",
        "Pre-GH Minirin Y 1 N 2", "StartDate-Minirin", "PostGH-Minirin Y 1 N 2",
        // Additional helpful fields
        "UHID", "Address", "Phone no1", "Phone no2", "Phone 3"
    ]

    const rows = [headers]

    baselineForms.forEach((form) => {
        const pd = form.patientDetails || {}
        const diag = form.diagnosis || {}
        const fam = form.history?.familyHistory || {}
        const meas = form.examination?.measurements || {}
        const exam = form.examination || {}
        const imaging = form.examination?.imaging || {}
        const boneAge = imaging?.boneAge || {}
        const phys = form.examination?.physicalFindings || {}
        const ghst = form.endocrineWorkup?.ghStimulationTest || {}
        const mri = form.mri || {}
        const mriFind = mri.findings || {}
        const treat = form.treatment || {}
        const hypo = treat.hypothyroidism || {}
        const cort = treat.hypocortisolism || {}
        const gono = treat.hypogonadism || {}
        const di = treat.di || {}

        const address = [pd.address?.street, pd.address?.city, pd.address?.state]
            .filter(Boolean).join(", ")

        // Helpers
        const sexCode = pd.sex === "Male" ? 1 : pd.sex === "Female" ? 2 : ""
        const congCode = diag.diagnosisType === "Congenital" ? 1 : diag.diagnosisType === "Acquired" ? 2 : ""
        const preIGHDvsMPHD = (diag.isolatedGHD === "Yes" || diag.isolatedGHD === true) ? 1
            : (diag.hypopituitarism === "Yes" || diag.hypopituitarism === true) ? 2 : ""

        // Puberty encoding
        let induced = "2", delayed = "2", spont = "2"
        if (phys.pubertalStatus === "Induced") induced = "1"
        if (phys.pubertalStatus === "Delayed") delayed = "1"
        if (phys.pubertalStatus === "Pubertal") spont = "1"

        // GHST results (pick first seen values)
        const firstClonidine = (ghst.results || []).find(r => r.clonidineGH)
        const firstGlucagon = (ghst.results || []).find(r => r.glucagonGH)

        // MRI code
        const mriCode = mri.performed === "Yes" ? 1 : mri.performed === "No" ? 2 : ""

        rows.push([
            // Identifiers
            pd.paecNo || "",
            pd.name || "",
            pd.dob || "",
            pd.age || "",
            sexCode,
            // Diagnosis
            diag.mriAbnormality || "",
            congCode,
            preIGHDvsMPHD,
            // Family history
            fam.mother?.height || "",
            fam.father?.height || "",
            fam.mph || "",
            fam.mphSds || "",
            // Measurements
            meas.height || "",
            meas.heightSds || "",
            meas.weight || "",
            meas.weightSds || "",
            meas.bmi || "",
            meas.bmiSds || "",
            meas.heightAge || "",
            // Dates
            exam.date || form.visitDate || "",
            // Bone age - store full value in BA8; fragments empty if unknown
            "", "", "", "", "", "", "", "", boneAge.value || "",
            // Puberty
            induced, delayed, spont,
            phys.pubicHair || "",
            phys.breast || "",
            "", "", "", "", "", "",
            // GHST
            ghst.date || "",
            firstClonidine?.clonidineGH || "",
            firstClonidine?.time || "",
            firstGlucagon?.glucagonGH || "",
            firstGlucagon?.time || "",
            // MRI
            mriCode,
            mriFind.otherFindings || "",
            mriFind.anteriorPituitaryHypoplasia || "",
            mriFind.pituitaryStalkInterruption || "",
            mriFind.ectopicPosteriorPituitary || "",
            // Treatments
            (hypo.hypothyroidismPresent ? "1" : "2"),
            hypo.treatmentStartDate || "",
            (hypo.hypothyroidismPresent ? "1" : "2"),
            (cort.hypocortisolismPresent ? "1" : "2"),
            cort.treatmentStartDate || "",
            (cort.hypocortisolismPresent ? "1" : "2"),
            (gono.hypogonadismPresent ? "1" : "2"),
            gono.treatmentStartDate || "",
            (gono.hypogonadismPresent ? "1" : "2"),
            (di.iabetesInsipidusPresent ? "1" : "2"),
            di.treatmentStartDate || di.diagnosisDate || "",
            (di.iabetesInsipidusPresent ? "1" : "2"),
            // Extras
            pd.uhid || "",
            address,
            pd.contact?.cell1 || "",
            pd.contact?.cell2 || "",
            pd.contact?.landline || "",
        ])
    })

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template")

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    await newLog({
        user: req.user._id,
        action: "export",
        module: "baselineform",
        modifiedData: {
            format: "import-template",
            totalBaseline: baselineForms.length,
            filters: { paecNo, patientName, uhid, fromDate, toDate }
        }
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", `attachment; filename=baseline_analysis_export_${timestamp}.xlsx`)
    res.send(buffer)
})


