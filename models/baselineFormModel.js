import mongoose from 'mongoose'

const baselineFormSchema = new mongoose.Schema({
    center: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Center",
    },
    patientDetails: {
        paecNo: String,
        uhid: {
            type: String
        },
        name: {
            type: String
        },
        dob: Date,
        age: Number,
        sex: String, // "Male" or "Female"
        address: {
            street: String,
            city: String,
            state: String
        },
        contact: {
            landline: String,
            cell1: String,
            cell2: String
        }
    },

    visitDate: {
        type: Date,
    },

    history: {
        shortStatureNoticedAt: String,
        birthHistory: {
            duration: String, // "fullterm", "preterm", "post term"
            deliveryPlace: String, // "home", "nursing home", "govt hospital", etc.
            deliveryNature: String, // "normal", "breech", "forceps", "LSCS"
            birthWeight: Number,
            birthLength: Number,
            birthHypoxia: Boolean
        },
        pubertyHistory: {
            thelarche: {
                ageYears: Number,
                ageMonths: Number
            },
            menarche: {
                ageYears: Number,
                ageMonths: Number
            }
        },
        familyHistory: {
            father: {
                age: Number,
                height: Number,
                isMeasured: Boolean
            },
            mother: {
                age: Number,
                height: Number,
                isMeasured: Boolean
            },
            mph: Number,
            mphSds: Number,
            siblings: [{
                relation: String,
                age: Number,
                height: Number,
                weight: Number
            }],
            shortStatureInFamily: Boolean,
            consanguinity: {
                present: Boolean,
                degree: String // "1", "2", "3", "others"
            }
        }
    },

    examination: {
        date: Date,
        measurements: {
            height: Number,
            heightAge: Number,
            heightSds: Number,
            weight: Number,
            weightAge: Number,
            weightSds: Number,
            bmi: Number,
            bmiSds: Number
        },
        physicalFindings: {
            face: String, // "Doll like", "Cherubic", etc.
            thyroid: String, // "normal", "diffuse goiter", etc.
            pubertalStatus: String, // "Prepubertal", "Peri-pubertal", "Pubertal"
            axillaryHair: String, // "absent", "sparse", "adult type"
            pubicHair: String, // "I", "II", etc.
            testicularVolume: {
                right: String,
                left: String
            },
            breast: String, // "I", "II", etc.
            spl: String
        },
        pituitarySurgery: {
            history: Boolean,
            details: {
                diagnosisDate: Date,
                ctDate: Date,
                numberOfSurgeries: Number,
                surgeryType: String, // "TNTS", "Transcranial"
                surgeryDates: [Date],
                place: String,
                surgeon: String
            }
        },
        pituitaryRadiation: {
            history: Boolean,
            type: String, // "Gamma knife", "conventional"
            startDate: Date,
            endDate: Date,
            totalDose: Number,
            lastDate: Date
        }
    },

    investigations: {
        date: Date,
        hematology: {
            hb: Number,
            esr: Number,
            tlc: Number,
            dlc: {
                p: Number,
                l: Number,
                e: Number,
                m: Number,
                b: Number
            },
            pbf: {
                cytic: String, // "normo", "hypo", "megaloblastic"
                chromic: String // "normo", "hypochromic"
            }
        },
        biochemistry: {
            sCreat: Number,
            sgot: Number,
            sgpt: Number,
            sAlbumin: Number,
            sCa: Number,
            sPO4: Number,
            sap: Number,
            sNa: Number,
            sK: Number,
            fbs: Number
        },
        urine: {
            lowestPh: Number,
            albumin: Boolean,
            glucose: Boolean,
            microscopy: String
        },
        sttg: {
            value: String,
            place: String // "AIIMS", "LPL", "Outside"
        },
        imaging: {
            xrayChest: String, // "normal", "abnormal"
            xraySkull: String, // "normal", "abnormal"
            boneAge: {
                date: Date,
                value: String,
                gpScoring: Boolean
            }
        }
    },

    endocrineWorkup: {
        date: Date,
        tests: {
            t4: Number,
            freeT4: Number,
            tsh: Number,
            lh: Number,
            fsh: Number,
            prl: Number,
            acth: Number,
            cortisol8am: Number,
            igf1: Number,
            estradiol: Number,
            testosterone: Number
        },
        ghStimulationTest: {
            type: String, // "Clonidine", "Glucagon"
            date: Date,
            place: String, // "AIIMS", "Outside"
            outsidePlace: String,
            results: [{
                time: String, // "0 min", "30 min", etc.
                clonidineGH: Number,
                glucagonGH: Number
            }],
            testsDone: Number, // 1 or 2
            singleTestType: String, // if testsDone=1
            peakGHLevel: String, // "<10", "<7", "<5"
            exactPeakGH: Number,
            peakGHTime: String
        }
    },

    mri: {
        performed: Boolean,
        date: Date,
        contrastUsed: Boolean,
        coronalSagittalCuts: Boolean,
        place: String, // "AIIMS", "outside"
        filmsAvailable: Boolean,
        cdAvailable: Boolean,
        scanned: Boolean,
        findings: {
            anteriorPituitaryHypoplasia: Boolean,
            pituitaryStalkInterruption: Boolean,
            ectopicPosteriorPituitary: Boolean,
            pituitarySizeMM: Number,
            otherFindings: String
        }
    },

    treatment: {
        hypothyroidism: {
            present: Boolean,
            diagnosisDate: Date,
            treatmentStartDate: Date,
            currentDose: String,
            doseChanged: Boolean,
            lastT4: Number,
            source: String // "purchased", "hospital supply"
        },
        hypocortisolism: {
            present: Boolean,
            diagnosisDate: Date,
            acthStimTest: Boolean,
            testDate: Date,
            peakCortisol: Number,
            treatmentStartDate: Date,
            steroidType: String, // "Prednisolone", "hydrocortisone"
            currentDose: String,
            frequency: String, // "OD", "BD", "TDS"
            dailyDoseMG: Number,
            doseChanged: Boolean,
            source: String // "purchased", "hospital supply"
        },
        di: {
            present: Boolean,
            diagnosisDate: Date,
            minirin: Boolean,
            dose: String, // "half", "full", "double"
            frequency: Number // 1, 2, 3
        },
        hypogonadism: {
            present: Boolean,
            diagnosisDate: Date,
            treatmentStartDate: Date,
            fullAdultDoseDate: Date,
            hormoneType: String, // "Testosterone", "estradiol"
            mpaStartDate: Date,
            currentDose: String,
            doseChanged: Boolean
        },
        supplements: {
            calcium: Boolean,
            vitaminD: Boolean,
            iron: Boolean
        },
        otherTreatments: {
            antiepileptics: Boolean,
            otherDrugs: String
        }
    },

    diagnosis: {
        type: String, // "Congenital", "Acquired"
        isolatedGHD: Boolean,
        hypopituitarism: Boolean,
        affectedAxes: {
            thyroid: Boolean,
            cortisol: Boolean,
            gonadal: Boolean,
            di: Boolean
        },
        mriAbnormality: Boolean
    },
    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    isDeleted: {
        status: { type: Boolean, default: false },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedTime: { type: Date }
    },
},
    { timestamps: true })

const BaselineForm = mongoose.model('BaselineForm', baselineFormSchema)

export default BaselineForm