import BaselineForm from '../../models/baselineFormModel.js'
import FollowupForm from '../../models/followupFormModel.js'
import Center from '../../models/centreModel.js'
import User from '../../models/userModel.js'
import Log from '../../models/logModel.js'

export const dashboard = async (req, res) => {
    try {
        // Get all forms with populated references
        const baselineForms = await BaselineForm.find({ 'isDeleted.status': false })
            // .populate('center', 'centerName centerCode')
            .populate('createdBy', 'userName')
            .lean()

        const followupForms = await FollowupForm.find({ 'isDeleted.status': false })
            .populate('baselineForm', 'patientDetails.paecNo patientDetails.name')
            // .populate('center', 'centerName centerCode')
            .populate('createdBy', 'userName')
            .lean()

        const centers = await Center.find({ 'isDeleted.status': false }).lean()

        // Calculate current date for age calculations
        const currentDate = new Date()

        // 1. PATIENT DEMOGRAPHICS & EPIDEMIOLOGY
        const demographics = {
            totalPatients: baselineForms.length,
            totalFollowups: followupForms.length,
            genderDistribution: {
                male: baselineForms.filter(f => f.patientDetails?.sex === 'Male').length,
                female: baselineForms.filter(f => f.patientDetails?.sex === 'Female').length,
                unspecified: baselineForms.filter(f => !f.patientDetails?.sex || !['Male', 'Female'].includes(f.patientDetails.sex)).length
            },
            ageDistribution: {
                '0-5': baselineForms.filter(f => {
                    const age = f.patientDetails?.age
                    return age && age >= 0 && age <= 5
                }).length,
                '6-10': baselineForms.filter(f => {
                    const age = f.patientDetails?.age
                    return age && age >= 6 && age <= 10
                }).length,
                '11-15': baselineForms.filter(f => {
                    const age = f.patientDetails?.age
                    return age && age >= 11 && age <= 15
                }).length,
                '16-20': baselineForms.filter(f => {
                    const age = f.patientDetails?.age
                    return age && age >= 16 && age <= 20
                }).length,
                '>20': baselineForms.filter(f => {
                    const age = f.patientDetails?.age
                    return age && age > 20
                }).length
            },
            stateWiseDistribution: baselineForms.reduce((acc, form) => {
                const state = form.patientDetails?.address?.state || 'Unknown'
                acc[state] = (acc[state] || 0) + 1
                return acc
            }, {}),
            centerWiseDistribution: baselineForms.reduce((acc, form) => {
                const centerName = form.center?.centerName || 'Unknown'
                acc[centerName] = (acc[centerName] || 0) + 1
                return acc
            }, {})
        }

        // 2. DIAGNOSIS & CLINICAL CHARACTERISTICS
        const diagnosis = {
            diagnosisTypes: baselineForms.reduce((acc, form) => {
                const type = form.diagnosis?.diagnosisType || 'Unknown'
                acc[type] = (acc[type] || 0) + 1
                return acc
            }, {}),
            isolatedGHD: {
                yes: baselineForms.filter(f => f.diagnosis?.isolatedGHD === 'Yes').length,
                no: baselineForms.filter(f => f.diagnosis?.isolatedGHD === 'No').length,
                unknown: baselineForms.filter(f => !f.diagnosis?.isolatedGHD || f.diagnosis.isolatedGHD === 'Unknown').length
            },
            hypopituitarism: {
                yes: baselineForms.filter(f => f.diagnosis?.hypopituitarism === 'Yes').length,
                no: baselineForms.filter(f => f.diagnosis?.hypopituitarism === 'No').length,
                unknown: baselineForms.filter(f => !f.diagnosis?.hypopituitarism || f.diagnosis.hypopituitarism === 'Unknown').length
            },
            affectedAxes: {
                thyroid: baselineForms.filter(f => f.diagnosis?.affectedAxes?.thyroid === 'Yes').length,
                cortisol: baselineForms.filter(f => f.diagnosis?.affectedAxes?.cortisol === 'Yes').length,
                gonadal: baselineForms.filter(f => f.diagnosis?.affectedAxes?.gonadal === 'Yes').length,
                di: baselineForms.filter(f => f.diagnosis?.affectedAxes?.di === 'Yes').length
            },
            mriAbnormalities: baselineForms.reduce((acc, form) => {
                const abnormality = form.diagnosis?.mriAbnormality || 'Normal'
                acc[abnormality] = (acc[abnormality] || 0) + 1
                return acc
            }, {})
        }

        // 3. TREATMENT PATTERNS & COMPLIANCE
        const treatment = {
            hypothyroidism: {
                total: baselineForms.filter(f => f.treatment?.hypothyroidism?.hypothyroidismPresent).length,
                onTreatment: baselineForms.filter(f =>
                    f.treatment?.hypothyroidism?.hypothyroidismPresent &&
                    f.treatment?.hypothyroidism?.currentDose
                ).length
            },
            hypocortisolism: {
                total: baselineForms.filter(f => f.treatment?.hypocortisolism?.hypocortisolismPresent).length,
                onTreatment: baselineForms.filter(f =>
                    f.treatment?.hypocortisolism?.hypocortisolismPresent &&
                    f.treatment?.hypocortisolism?.currentDose
                ).length
            },
            diabetesInsipidus: {
                total: baselineForms.filter(f => f.treatment?.di?.diabetesInsipidusPresent).length,
                onMinirin: baselineForms.filter(f =>
                    f.treatment?.di?.diabetesInsipidusPresent &&
                    f.treatment?.di?.minirin
                ).length
            },
            hypogonadism: {
                total: baselineForms.filter(f => f.treatment?.hypogonadism?.hypogonadismPresent).length,
                onTreatment: baselineForms.filter(f =>
                    f.treatment?.hypogonadism?.hypogonadismPresent &&
                    f.treatment?.hypogonadism?.currentDose
                ).length
            },
            supplements: {
                calcium: baselineForms.filter(f => f.treatment?.supplements?.calcium).length,
                vitaminD: baselineForms.filter(f => f.treatment?.supplements?.vitaminD).length,
                iron: baselineForms.filter(f => f.treatment?.supplements?.iron).length
            }
        }

        // 4. GH THERAPY ANALYSIS
        const ghTherapy = {
            totalOnGH: followupForms.filter(f => f.ghTherapy?.ghTherapyPresent).length,
            ghBrands: followupForms.reduce((acc, form) => {
                if (form.ghTherapy?.ghTherapyPresent && form.ghTherapy?.details?.brand) {
                    const brand = form.ghTherapy.details.brand
                    acc[brand] = (acc[brand] || 0) + 1
                }
                return acc
            }, {}),
            administrationMethods: followupForms.reduce((acc, form) => {
                if (form.ghTherapy?.ghTherapyPresent && form.ghTherapy?.details?.administrationMethod) {
                    const method = form.ghTherapy.details.administrationMethod
                    acc[method] = (acc[method] || 0) + 1
                }
                return acc
            }, {}),
            costCoverage: followupForms.reduce((acc, form) => {
                if (form.ghTherapy?.ghTherapyPresent && form.ghTherapy?.details?.costCoverage) {
                    const coverage = form.ghTherapy.details.costCoverage
                    acc[coverage] = (acc[coverage] || 0) + 1
                }
                return acc
            }, {}),
            compliance: {
                excellent: followupForms.filter(f =>
                    f.compliance?.compliancePresent &&
                    parseInt(f.compliance?.details?.daysMissedPerMonth || '0') <= 2
                ).length,
                good: followupForms.filter(f =>
                    f.compliance?.compliancePresent &&
                    parseInt(f.compliance?.details?.daysMissedPerMonth || '0') > 2 &&
                    parseInt(f.compliance?.details?.daysMissedPerMonth || '0') <= 5
                ).length,
                poor: followupForms.filter(f =>
                    f.compliance?.compliancePresent &&
                    parseInt(f.compliance?.details?.daysMissedPerMonth || '0') > 5
                ).length
            }
        }

        // 5. INVESTIGATIONS & LABORATORY DATA
        const investigations = {
            mriPerformed: baselineForms.filter(f => f.mri?.mriDetailsPresent && f.mri?.performed === 'Yes').length,
            mriFindings: baselineForms.reduce((acc, form) => {
                if (form.mri?.findings?.mriFindingsPresent) {
                    if (form.mri.findings.anteriorPituitaryHypoplasia === 'Yes') acc.anteriorPituitaryHypoplasia = (acc.anteriorPituitaryHypoplasia || 0) + 1
                    if (form.mri.findings.pituitaryStalkInterruption === 'Yes') acc.pituitaryStalkInterruption = (acc.pituitaryStalkInterruption || 0) + 1
                    if (form.mri.findings.ectopicPosteriorPituitary === 'Yes') acc.ectopicPosteriorPituitary = (acc.ectopicPosteriorPituitary || 0) + 1
                }
                return acc
            }, {}),
            ghStimulationTests: baselineForms.filter(f =>
                f.endocrineWorkup?.ghStimulationTest?.ghStimulationTestPresent
            ).length,
            ghStimulationTypes: baselineForms.reduce((acc, form) => {
                if (form.endocrineWorkup?.ghStimulationTest?.ghStimulationTestPresent) {
                    const type = form.endocrineWorkup.ghStimulationTest.ghStimulationType || 'Unknown'
                    acc[type] = (acc[type] || 0) + 1
                }
                return acc
            }, {}),
            boneAgeAssessments: baselineForms.filter(f =>
                f.investigations?.imaging?.boneAge?.boneAgePresent
            ).length
        }

        // 6. GROWTH & DEVELOPMENT METRICS
        const growthMetrics = {
            heightSdsDistribution: baselineForms.reduce((acc, form) => {
                if (form.examination?.measurements?.heightSds) {
                    const sds = parseFloat(form.examination.measurements.heightSds)
                    if (sds <= -3) acc['≤-3'] = (acc['≤-3'] || 0) + 1
                    else if (sds > -3 && sds <= -2) acc['-3 to -2'] = (acc['-3 to -2'] || 0) + 1
                    else if (sds > -2 && sds <= -1) acc['-2 to -1'] = (acc['-2 to -1'] || 0) + 1
                    else if (sds > -1 && sds <= 0) acc['-1 to 0'] = (acc['-1 to 0'] || 0) + 1
                    else acc['>0'] = (acc['>0'] || 0) + 1
                }
                return acc
            }, {}),
            pubertalStatus: baselineForms.reduce((acc, form) => {
                const status = form.examination?.physicalFindings?.pubertalStatus || 'Unknown'
                acc[status] = (acc[status] || 0) + 1
                return acc
            }, {})
        }

        // 7. TEMPORAL TRENDS
        const temporalTrends = {
            monthlyRegistrations: baselineForms.reduce((acc, form) => {
                const month = new Date(form.createdAt).toISOString().slice(0, 7) // YYYY-MM
                acc[month] = (acc[month] || 0) + 1
                return acc
            }, {}),
            monthlyFollowups: followupForms.reduce((acc, form) => {
                const month = new Date(form.createdAt).toISOString().slice(0, 7) // YYYY-MM
                acc[month] = (acc[month] || 0) + 1
                return acc
            }, {})
        }

        // 8. RESEARCH INSIGHTS
        const researchInsights = {
            averageAgeAtDiagnosis: baselineForms.reduce((sum, form) => {
                return sum + (form.patientDetails?.age || 0)
            }, 0) / baselineForms.length,
            familyHistory: {
                withConsanguinity: baselineForms.filter(f =>
                    f.history?.familyHistory?.consanguinity?.present === 'Yes'
                ).length,
                withShortStature: baselineForms.filter(f =>
                    f.history?.familyHistory?.shortStatureInFamily === 'Yes'
                ).length
            },
            birthHistory: {
                preterm: baselineForms.filter(f =>
                    f.history?.birthHistory?.duration === 'preterm'
                ).length,
                fullterm: baselineForms.filter(f =>
                    f.history?.birthHistory?.duration === 'fullterm'
                ).length,
                postterm: baselineForms.filter(f =>
                    f.history?.birthHistory?.duration === 'post term'
                ).length
            },
            treatmentOutcomes: {
                patientsWithFollowups: new Set(followupForms.map(f => f.baselineForm?.patientDetails?.paecNo)).size,
                averageFollowupDuration: followupForms.reduce((sum, form) => {
                    if (form.visitDetails?.currentVisitDate && form.baselineForm?.visitDate) {
                        const duration = new Date(form.visitDetails.currentVisitDate) - new Date(form.baselineForm.visitDate)
                        return sum + (duration / (1000 * 60 * 60 * 24 * 365)) // Convert to years
                    }
                    return sum
                }, 0) / followupForms.length
            }
        }

        // 9. CENTER PERFORMANCE METRICS
        const centerPerformance = centers.map(center => {
            const centerBaselineForms = baselineForms.filter(f => f.center?._id?.toString() === center._id.toString())
            const centerFollowupForms = followupForms.filter(f => f.center?._id?.toString() === center._id.toString())

            return {
                centerName: center.centerName,
                centerCode: center.centerCode,
                totalPatients: centerBaselineForms.length,
                totalFollowups: centerFollowupForms.length,
                averageAge: centerBaselineForms.reduce((sum, form) => sum + (form.patientDetails?.age || 0), 0) / centerBaselineForms.length || 0,
                genderDistribution: {
                    male: centerBaselineForms.filter(f => f.patientDetails?.sex === 'Male').length,
                    female: centerBaselineForms.filter(f => f.patientDetails?.sex === 'Female').length
                },
                diagnosisDistribution: centerBaselineForms.reduce((acc, form) => {
                    const diagnosis = form.diagnosis?.diagnosisType || 'Unknown'
                    acc[diagnosis] = (acc[diagnosis] || 0) + 1
                    return acc
                }, {}),
                ghTherapyPatients: centerFollowupForms.filter(f => f.ghTherapy?.ghTherapyPresent).length
            }
        })

        // 10. QUALITY METRICS
        const qualityMetrics = {
            completeRecords: baselineForms.filter(f =>
                f.patientDetails?.paecNo &&
                f.patientDetails?.name &&
                f.diagnosis?.diagnosisPresent
            ).length,
            mriCompletionRate: baselineForms.filter(f => f.mri?.mriDetailsPresent).length / baselineForms.length * 100,
            ghStimulationTestRate: baselineForms.filter(f =>
                f.endocrineWorkup?.ghStimulationTest?.ghStimulationTestPresent
            ).length / baselineForms.length * 100,
            followupRate: followupForms.length / baselineForms.length * 100
        }

        const dashboardData = {
            summary: {
                totalPatients: baselineForms.length,
                totalFollowups: followupForms.length,
                totalCenters: centers.length,
                dataLastUpdated: new Date().toISOString()
            },
            demographics,
            diagnosis,
            treatment,
            ghTherapy,
            investigations,
            growthMetrics,
            temporalTrends,
            researchInsights,
            centerPerformance,
            qualityMetrics
        }

        res.status(200).json(dashboardData)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}