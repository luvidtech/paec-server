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
            currentDose: Number, // units per day
            brand: String,
            administrationMethod: String, // "Pen" or "Syringe"
            syringeUsage: String, // 1-7 or >7 injections per syringe
            costCoverage: String // "Self", "CGHS", "ESI", "EHS", "Govt", "PMRF", "Others"
        },
        remarks: String,
    },

    measurements: {
        height: Number, // cms
        weight: Number, // kgs
        bmi: Number,
        heightSds: Number,
        weightSds: Number,
        bmiSds: Number,
        remarks: String
    },

    pubertalStatus: {
        testicularVolume: {
            right: Number, // ml
            left: Number // ml
        },
        pubicHair: String, // "1", "2", "3", "4", "5"
        breastStage: String ,
        // "B1", "B2", "B3", "B4", "B5"
        remarks: String,
    },

    compliance: {
        missedDoses: String,
        details: {
            daysMissedPerMonth: Number,
            daysMissedLast3Months: Number,
            lastPAECVisit: Date,
            daysMissedPerWeek: Number,
            totalDaysMissedSinceLastVisit: Number,
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
        last6Months: Number,
        sinceGHStart: Number,
        remarks: String,
    },

    investigations: {
        boneAge: {
            lastXRayDate: Date
        },
        labTests: {
            serumT4: {
                value: Number, // ug/dl
                date: Date
            },
            igf1: {
                value: Number, // mg/dl
                date: Date
            }
        },
        remarks: String,
    },

    advisedTreatment: {
        ghDoseCalculation: {
            currentWeight: Number, // kg
            mgPerKgPerWeek: Number,
            calculatedDose: Number, // units/day
            roundedDose: Number
        },
        accompanyingTreatments: {
            thyroxin: {
                dose: Number, // ug/day
            },
            corticosteroids: {
                corticosteroidsType: String, // "Prednisone" or "HC"
                dose: Number, // mg/day
                frequency: String // "Single dose" or "two doses"
            },
            minirin: {
                dose: Number // mg/day
            },
            testosterone: {
                dose: Number, // mg
                frequency: Number // weeks between injections
            },
            pragynova: {
                dose: Number // mg/day
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