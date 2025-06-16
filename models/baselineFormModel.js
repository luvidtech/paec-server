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
            birthHypoxia: String
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
                isMeasured: String
            },
            mother: {
                age: Number,
                height: Number,
                isMeasured: String
            },
            mph: Number,
            mphSds: Number,
            siblings: [{
                relation: String,
                age: Number,
                height: Number,
                weight: Number
            }],
            shortStatureInFamily: String,
            consanguinity: {
                present: String,
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
            history: String,
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
            history: String,
            pituitaryRadiationType: String, // "Gamma knife", "conventional"
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
            sGlob:Number,
            sCa: Number,
            sPO4: Number,
            sap: Number,
            sNa: Number,
            sK: Number,
            fbs: Number,
            egfr: Number,
remarks: String,
lipidProfile: {
  
  tc: Number,
  tg: Number,
  ldl: Number,
  hdl: Number,
  hba1c: Number
}
        },
        urine: {
            lowestPh: Number,
            albumin: String,
            glucose: String,
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
            ghStimulationType: String, // "Clonidine", "Glucagon"
            date: Date,
            place: String, // "AIIMS", "Outside"
            outsidePlace: String,
            results: [{
                time: String, // "0 min", "30 min", etc.
                clonidineGH: Number,
                glucagonGH: Number
            }],
            testsDone: String, // 1 or 2
            singleTestType: String, // if testsDone=1
            peakGHLevel: String, // "<10", "<7", "<5"
            exactPeakGH: Number,
            peakGHTime: String
        }
    },

    mri: {
        performed: String,
        date: Date,
        contrastUsed: String,
        coronalSagittalCuts: String,
        place: String, // "AIIMS", "outside"
        filmsAvailable: String,
        cdAvailable: String,
        scanned: String,
        findings: {
            anteriorPituitaryHypoplasia: String,
            pituitaryStalkInterruption: String,
            ectopicPosteriorPituitary: String,
            pituitarySizeMM: Number,
            otherFindings: String
        }
    },

    treatment: {
        hypothyroidism: {
            present: String,
            diagnosisDate: Date,
            treatmentStartDate: Date,
            currentDose: String,
            doseChanged: String,
            lastT4: Number,
            source: String // "purchased", "hospital supply"
        },
        hypocortisolism: {
            present: String,
            diagnosisDate: Date,
            acthStimTest: String,
            testDate: Date,
            peakCortisol: Number,
            treatmentStartDate: Date,
            steroidType: String, // "Prednisolone", "hydrocortisone"
            currentDose: String,
            frequency: String, // "OD", "BD", "TDS"
            dailyDoseMG: Number,
            doseChanged: String,
            source: String // "purchased", "hospital supply"
        },
        di: {
            present: String,
            diagnosisDate: Date,
            minirin: String,
            dose: String, // "half", "full", "double"
            frequency: Number // 1, 2, 3
        },
        hypogonadism: {
            present: String,
            diagnosisDate: Date,
            treatmentStartDate: Date,
            fullAdultDoseDate: Date,
            hormoneType: String, // "Testosterone", "estradiol"
            mpaStartDate: Date,
            currentDose: String,
            doseChanged: String
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
        diagnosisType: String, // "Congenital", "Acquired"
        isolatedGHD: String,
        hypopituitarism: String,
        affectedAxes: {
            thyroid: String,
            cortisol: String,
            gonadal: String,
            di: String
        },
        mriAbnormality: String
    },
    
    remarks: {
      birthHistory: String,
      pubertyHistory: String,
      familyHistory: String,
      measurements: String,
      physicalFindings: String,
      pituitarySurgeryHistory: String,
      pituitaryRadiation: String,
      investigations: {
        hematology: String,
        dlc: String,
        pbf: String,
        biochemistry: String,
        urine: String,
        sttg: String,
        imaging: String,
        tests: String,
        ghStimulationTest: String,
        testResults: String,
        
        mriFindings: String
      },
      diagnosis: {
        hypothyroidism: String,
        hypocortisolism: String,
        diabetesInsipidus: String,
        hypogonadism: String,
        otherTreatments: String,
        affectedAxis: String
      }
    },
    historyOfCurrentIllness: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
   
    updatedBy: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            updatedAt: { type: Date, default: Date.now }
        }
    ],
    isDeleted: {
        status: { type: Boolean, default: false },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedTime: { type: Date }
    },
},
    { timestamps: true })

const BaselineForm = mongoose.model('BaselineForm', baselineFormSchema)

export default BaselineForm