import mongoose from 'mongoose'

const followupFormSchema = new mongoose.Schema({
    baselineForm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BaselineForm",
    },
    visitDetails: {
        lastVisitDate: Date,
        currentVisitDate: {
            type: Date,
            required: true
        }
    },
    ghTherapy: {
        takingGH: String,
        details: {
            currentDose: String, // units per day
            brand: String,
            administrationMethod: String, // "Pen" or "Syringe"
            syringeUsage: String, // 1-7 or >7 injections per syringe
            costCoverage: String // "Self", "CGHS", "ESI", "EHS", "Govt", "PMRF", "Others"
        },
        remarks: String,
    },

    measurements: {
        height: String, // cms
        weight: String, // kgs
        bmi: String,
        heightSds: String,
        weightSds: String,
        bmiSds: String,
        remarks: String
    },

    pubertalStatus: {
        testicularVolume: {
            right: String, // ml
            left: String // ml
        },
        pubicHair: String, // "1", "2", "3", "4", "5"
        breastStage: String ,
        // "B1", "B2", "B3", "B4", "B5"
        remarks: String,
    },

    compliance: {
        missedDoses: String,
        details: {
            daysMissedPerMonth: String,
            daysMissedLast3Months: String,
            lastPAECVisit: Date,
            daysMissedPerWeek: String,
            totalDaysMissedSinceLastVisit: String,
            reasons: String
        },
        remarks: String,
    },

    sideEffects: {
        present: String,
        effects: {
            edemaFeet: String,
            headache: String,
            gynecomastia: String,
            blurringVision: String,
            hipJointPain: String
        },
        remarks: String,
    },

    associatedIllness: {
        present: String,
        details: String,
        otherComplaints: String,
        remarks: String,
    },

    growthVelocity: {
        last6Months: String,
        sinceGHStart: String,
        remarks: String,
    },

    investigations: {
        boneAge: {
            lastXRayDate: Date
        },
        labTests: {
            serumT4: {
                value: String, // ug/dl
                date: Date
            },
            igf1: {
                value: String, // mg/dl
                date: Date
            }
        },
        remarks: String,
    },

    advisedTreatment: {
        ghDoseCalculation: {
            currentWeight: String, // kg
            mgPerKgPerWeek: String,
            calculatedDose: String, // units/day
            roundedDose: String
        },
        accompanyingTreatments: {
            thyroxin: {
                dose: String, // ug/day
            },
            corticosteroids: {
                corticosteroidsType: String, // "Prednisone" or "HC"
                dose: String, // mg/day
                frequency: String // "Single dose" or "two doses"
            },
            minirin: {
                dose: String // mg/day
            },
            testosterone: {
                dose: String, // mg
                frequency: String // weeks between injections
            },
            pragynova: {
                dose: String // mg/day
            },
           
        },
         remarks: String,
    },
     remarks: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    remarks: {
        type: String
    },
    updatedBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isDeleted: {
        status: { type: Boolean, default: false },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedTime: { type: Date }
    },
},
    { timestamps: true })


const FollowupForm = mongoose.model('FollowupForm', followupFormSchema)

export default FollowupForm