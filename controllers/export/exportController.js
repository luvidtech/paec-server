import asyncHandler from "../../utils/asyncHandler.js";
import BaselineForm from "../../models/baselineFormModel.js";
import FollowupForm from "../../models/followupFormModel.js";
import XLSX from "xlsx";
import newLog from "../../utils/newLog.js";

export const exportForm = asyncHandler(async (req, res) => {
  try {
    const {
      formType, // 'baseline', 'followup', 'both'
      paecNo,
      patientName,
      uhid,
      fromDate,
      toDate,
      excludeFields = [], // Array of fields to exclude
    } = req.body;

    // Build query for baseline forms
    const baselineQuery = { "isDeleted.status": false };
    const followupQuery = { "isDeleted.status": false };

    // Apply filters
    if (paecNo) {
      baselineQuery["patientDetails.paecNo"] = {
        $regex: paecNo,
        $options: "i",
      };
      followupQuery["patientDetails.paecNo"] = {
        $regex: paecNo,
        $options: "i",
      };
    }

    if (patientName) {
      baselineQuery["patientDetails.name"] = {
        $regex: patientName,
        $options: "i",
      };
      followupQuery["patientDetails.name"] = {
        $regex: patientName,
        $options: "i",
      };
    }

    if (uhid) {
      baselineQuery["patientDetails.uhid"] = { $regex: uhid, $options: "i" };
      followupQuery["patientDetails.uhid"] = { $regex: uhid, $options: "i" };
    }

    if (fromDate || toDate) {
      const dateQuery = {};
      if (fromDate) dateQuery.$gte = new Date(fromDate);
      if (toDate) dateQuery.$lte = new Date(toDate);
      baselineQuery.visitDate = dateQuery;
      followupQuery.visitDate = dateQuery;
    }

    // Access control
    const accessTo = req.user.accessTo;
    if (accessTo === "own") {
      baselineQuery.createdBy = req.user._id;
      followupQuery.createdBy = req.user._id;
    } else if (accessTo === "center") {
      baselineQuery.center = req.user.center;
      followupQuery.center = req.user.center;
    }

    let baselineForms = [];
    let followupForms = [];

    // Fetch data based on form type
    if (formType === "baseline" || formType === "both") {
      baselineForms = await BaselineForm.find(baselineQuery)
        .populate("createdBy", "userName email")
        .populate("center", "name")
        .sort({ visitDate: -1 });
    }

    if (formType === "followup" || formType === "both") {
      followupForms = await FollowupForm.find(followupQuery)
        .populate("baselineForm", "patientDetails.paecNo patientDetails.name")
        .populate("createdBy", "userName email")
        .populate("center", "name")
        .sort({ visitDate: -1 });
    }

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();

    // Helper function to format date as dd-mm-yyyy
    const formatDate = (date) => {
      if (!date) return "NA";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "NA";
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    };

    // Helper function to handle empty values
    const handleEmptyValue = (value) => {
      if (value === null || value === undefined || value === "") return "NA";
      return value;
    };

    // Export baseline forms
    if (baselineForms.length > 0) {
      const baselineData = baselineForms.map((form) => {
        const row = {
          SNO: baselineForms.indexOf(form) + 1,
          PAECNo: handleEmptyValue(form.patientDetails?.paecNo),
          Name: handleEmptyValue(form.patientDetails?.name),
          UHID: handleEmptyValue(form.patientDetails?.uhid),
          Sex: handleEmptyValue(form.patientDetails?.sex),
          Age: handleEmptyValue(form.patientDetails?.age),
          DOB: formatDate(form.patientDetails?.dob),
          HouseNumber: handleEmptyValue(form.patientDetails?.address?.street),
          City: handleEmptyValue(form.patientDetails?.address?.city),
          State: handleEmptyValue(form.patientDetails?.address?.state),
          Cell1: handleEmptyValue(form.patientDetails?.contact?.cell1),
          Cell2: handleEmptyValue(form.patientDetails?.contact?.cell2),
          Landline: handleEmptyValue(form.patientDetails?.contact?.landline),
          VisitDate: formatDate(form.visitDate),
          "Form Type": "Baseline",
          "Created By": handleEmptyValue(form.createdBy?.userName),
          "Created Date": formatDate(form.createdAt),
          Center: handleEmptyValue(form.center?.name),
        };

        // Add diagnosis fields
        if (form.diagnosis) {
          row["Diagnosis Type"] = handleEmptyValue(
            form.diagnosis.diagnosisType
          );
          row["Isolated GHD"] = handleEmptyValue(form.diagnosis.isolatedGHD);
          row["Hypopituitarism"] = handleEmptyValue(
            form.diagnosis.hypopituitarism
          );
          row["Affected Axes Thyroid"] = handleEmptyValue(
            form.diagnosis.affectedAxes?.thyroid
          );
          row["Affected Axes Cortisol"] = handleEmptyValue(
            form.diagnosis.affectedAxes?.cortisol
          );
          row["Affected Axes Gonadal"] = handleEmptyValue(
            form.diagnosis.affectedAxes?.gonadal
          );
          row["Affected Axes DI"] = handleEmptyValue(
            form.diagnosis.affectedAxes?.di
          );
          row["MRI Abnormality"] = handleEmptyValue(
            form.diagnosis.mriAbnormality
          );
        }

        // Add history fields
        if (form.history) {
          row["ShortStatureNoticedAt"] = handleEmptyValue(
            form.history.shortStatureNoticedAt
          );
          if (form.history.birthHistory) {
            row["BirthWeight"] = handleEmptyValue(
              form.history.birthHistory.birthWeight
            );
            row["BirthLength"] = handleEmptyValue(
              form.history.birthHistory.birthLength
            );
            row["BirthDuration"] = handleEmptyValue(
              form.history.birthHistory.duration
            );
            row["DeliveryPlace"] = handleEmptyValue(
              form.history.birthHistory.deliveryPlace
            );
            row["DeliveryNature"] = handleEmptyValue(
              form.history.birthHistory.deliveryNature
            );
            row["BirthHypoxia"] = handleEmptyValue(
              form.history.birthHistory.birthHypoxia
            );
          }
          if (form.history.familyHistory) {
            row["FatherAge"] = handleEmptyValue(
              form.history.familyHistory.father?.age
            );
            row["FatherHeight"] = handleEmptyValue(
              form.history.familyHistory.father?.height
            );
            row["FatherIsMeasured"] = handleEmptyValue(
              form.history.familyHistory.father?.isMeasured
            );
            row["MotherAge"] = handleEmptyValue(
              form.history.familyHistory.mother?.age
            );
            row["MotherHeight"] = handleEmptyValue(
              form.history.familyHistory.mother?.isMeasured
            );
            row["MotherIsMeasured"] = handleEmptyValue(
              form.history.familyHistory.mother?.height
            );

            row["MPH"] = handleEmptyValue(form.history.familyHistory.mph);
            row["MPHSDS"] = handleEmptyValue(form.history.familyHistory.mphsds);
            row["ShortStatureInFamily"] = handleEmptyValue(
              form.history.familyHistory.shortStatureInFamily
            );
            row["ConsanguinityPresent"] = handleEmptyValue(
              form.history.familyHistory.consanguinity.present
            );
             row["ConsanguinityDegree"] = handleEmptyValue(
              form.history.familyHistory.consanguinity.degree
            );
            
            // Add siblings array
            if (form.history.familyHistory.siblings && 
                Array.isArray(form.history.familyHistory.siblings)) {
              
              // Process each sibling entry
              form.history.familyHistory.siblings.forEach((sibling, index) => {
                const relationKey = `SiblingRelation_${index + 1}`;
                const ageKey = `SiblingAge_${index + 1}`;
                const heightKey = `SiblingHeight_${index + 1}`;
                const weightKey = `SiblingWeight_${index + 1}`;
                
                row[relationKey] = handleEmptyValue(sibling.relation);
                row[ageKey] = handleEmptyValue(sibling.age);
                row[heightKey] = handleEmptyValue(sibling.height);
                row[weightKey] = handleEmptyValue(sibling.weight);
              });
              
              // Add total count of siblings
              row["Siblings"] = form.history.familyHistory.siblings.length;
            }

          }
          if (form.history.pubertyHistory) {
            row["ThelarcheAgeYears"] = handleEmptyValue(
              form.history.pubertyHistory.thelarche?.ageYears
            );
            row["ThelarcheAgeMonths"] = handleEmptyValue(
              form.history.pubertyHistory.thelarche?.ageMonths
            );

            row["MenarcheAgeYears"] = handleEmptyValue(
              form.history.pubertyHistory.menarche?.ageYears
            );
            row["MenarcheAgeMonths"] = handleEmptyValue(
              form.history.pubertyHistory.menarche?.ageMonths
            );
          }
        }

        // Add examination fields
        if (form.examination) {
            row["ExaminationDate"] = handleEmptyValue(
              form.examination.date
            );
          if (form.examination.measurements) {
            row["Height"] = handleEmptyValue(
              form.examination.measurements.height
            );
            row["HeightAge"] = handleEmptyValue(
              form.examination.measurements.heightAge
            );
            row["HeightSDS"] = handleEmptyValue(
              form.examination.measurements.heightSds
            );
            row["Weight"] = handleEmptyValue(
              form.examination.measurements.weight
            );
            row["WeightAge"] = handleEmptyValue(
              form.examination.measurements.weightAge
            );
            row["WeightSDS"] = handleEmptyValue(
              form.examination.measurements.weightSds
            );
            row["BMI"] = handleEmptyValue(form.examination.measurements.bmi);
            row["BMISDS"] = handleEmptyValue(
              form.examination.measurements.bmiSds
            );
          }
          if (form.examination.physicalFindings) {
            row["Face"] = handleEmptyValue(
              form.examination.physicalFindings.face
            );
            row["Thyroid"] = handleEmptyValue(
              form.examination.physicalFindings.thyroid
            );
            row["PubertalStatus"] = handleEmptyValue(
              form.examination.physicalFindings.pubertalStatus
            );
            row["AxillaryHair"] = handleEmptyValue(
              form.examination.physicalFindings.axillaryHair
            );
            row["PubicHair"] = handleEmptyValue(
              form.examination.physicalFindings.pubicHair
            );
            row["TesticularVolumeRight"] = handleEmptyValue(
              form.examination.physicalFindings.testicularVolume?.right
            );
            row["TesticularVolumeLeft"] = handleEmptyValue(
              form.examination.physicalFindings.testicularVolume?.left
            );
            row["Breast"] = handleEmptyValue(
              form.examination.physicalFindings.breast
            );
            row["SPL"] = handleEmptyValue(
              form.examination.physicalFindings.spl
            );
          }

           if (form.examination.pituitarySurgery) {
            row["PituitarySurgeryDiagnosisDate"] = handleEmptyValue(
              form.examination.pituitarySurgery.details.diagnosisDate
            );
            row["PituitarySurgeryCtDate"] = handleEmptyValue(
              form.examination.pituitarySurgery.details.ctDate
            );
            row["PituitarySurgeryNumberOfSurgeries"] = handleEmptyValue(
              form.examination.pituitarySurgery.details.numberOfSurgeries
            );
            row["PituitarySurgeryType"] = handleEmptyValue(
              form.examination.pituitarySurgery.details.surgeryType
            );
           
            row["PituitarySurgeryPlace"] = handleEmptyValue(
              form.examination.pituitarySurgery.details.place
            );
            row["PituitarySurgerySurgeon"] = handleEmptyValue(
              form.examination.pituitarySurgery.details.surgeon
            );
           
          }

          if (form.examination.pituitaryRadiation) {
            row["pituitaryRadiationPresent"] = handleEmptyValue(
              form.examination.pituitaryRadiation.pituitaryRadiationPresent
            );
            row["PituitaryRadiationType"] = handleEmptyValue(
              form.examination.pituitaryRadiation.pituitaryRadiationType
            );
            row["PituitaryRadiationStartDate"] = handleEmptyValue(
              form.examination.pituitaryRadiation.startDate
            );
           row["PituitaryRadiationEndDate"] = handleEmptyValue(
              form.examination.pituitaryRadiation.endDate
            );
           
            row["PituitaryRadiationTotalDose"] = handleEmptyValue(
              form.examination.pituitaryRadiation.totalDose
            );
             row["PituitaryRadiationLastDate"] = handleEmptyValue(
              form.examination.pituitaryRadiation.lastDate
            );
            
           
          }
        }

        // Add MRI fields
        if (form.mri) {
                      row["MRIDetailsPresent"] = handleEmptyValue(form.mri.mriDetailsPresent);

          row["MRIPerformed"] = handleEmptyValue(form.mri.performed);
          row["MRIDate"] = formatDate(form.mri.date);
          row["MRIContrastUsed"] = handleEmptyValue(form.mri.contrastUsed);
                    row["MRICoronalSagittalCuts"] = handleEmptyValue(form.mri.coronalSagittalCuts);

          row["MRIPlace"] = handleEmptyValue(form.mri.place);
          row["MRIFilmsAvailable"] = handleEmptyValue(
            form.mri.filmsAvailable
          );
          row["MRICDAvailable"] = handleEmptyValue(form.mri.cdAvailable);
          row["MRIScanned"] = handleEmptyValue(form.mri.scanned);

          
          if (form.mri.findings) {
            row["MRIFindingsPresent"] = handleEmptyValue(
              form.mri.findings.mriFindingsPresent
            );
            row["AnteriorPituitaryHypoplasia"] = handleEmptyValue(
              form.mri.findings.anteriorPituitaryHypoplasia
            );
            row["PituitaryStalkInterruption"] = handleEmptyValue(
              form.mri.findings.pituitaryStalkInterruption
            );
            row["EctopicPosteriorPituitary"] = handleEmptyValue(
              form.mri.findings.ectopicPosteriorPituitary
            );
            row["PituitarySizeMM"] = handleEmptyValue(
              form.mri.findings.pituitarySizeMM
            );
            row["Description"] = handleEmptyValue(
              form.mri.findings.otherFindings
            );
          }
        }

        // Add investigation fields
        if (form.investigations) {
        row["InvestigationsPresent"] = handleEmptyValue(form.investigations.investigationsPresent);
                row["InvestigationsDate"] = handleEmptyValue(form.investigations.date);


          if (form.investigations.hematology) {
            row["HematologyPresent"] = handleEmptyValue(form.investigations.hematology.hematologyPresent);
            row["HB"] = handleEmptyValue(form.investigations.hematology.hb);
            row["ESR"] = handleEmptyValue(form.investigations.hematology.esr);
            row["TLC"] = handleEmptyValue(form.investigations.hematology.tlc);
            if (form.investigations.hematology.dlc) {
                row["DLCPresent"] = handleEmptyValue(
                form.investigations.hematology.dlc.dlcPresent
              );
              row["DLCP"] = handleEmptyValue(
                form.investigations.hematology.dlc.p
              );
              row["DLCL"] = handleEmptyValue(
                form.investigations.hematology.dlc.l
              );
              row["DLCE"] = handleEmptyValue(
                form.investigations.hematology.dlc.e
              );
              row["DLCM"] = handleEmptyValue(
                form.investigations.hematology.dlc.m
              );
              row["DLCB"] = handleEmptyValue(
                form.investigations.hematology.dlc.b
              );
            }
            if (form.investigations.hematology.pbf) {
                row["PBFPresent"] = handleEmptyValue(
                form.investigations.hematology.pbf.pbfPresent
              );
              row["PBFCytic"] = handleEmptyValue(
                form.investigations.hematology.pbf.cytic
              );
              row["PBFChromic"] = handleEmptyValue(
                form.investigations.hematology.pbf.chromic
              );
            }
          }
          if (form.investigations.biochemistry) {
             row["BiochemistryPresent"] = handleEmptyValue(
              form.investigations.biochemistry.biochemistryPresent
            );
            row["SCreat"] = handleEmptyValue(
              form.investigations.biochemistry.sCreat
            );
            row["SGOT"] = handleEmptyValue(
              form.investigations.biochemistry.sgot
            );
            row["SGPT"] = handleEmptyValue(
              form.investigations.biochemistry.sgpt
            );
            row["SAlbumin"] = handleEmptyValue(
              form.investigations.biochemistry.sAlbumin
            );
            row["SGlob"] = handleEmptyValue(
              form.investigations.biochemistry.sGlob
            );
            row["SCa"] = handleEmptyValue(
              form.investigations.biochemistry.sCa
            );
            row["SPO4"] = handleEmptyValue(
              form.investigations.biochemistry.sPO4
            );
            row["SAP"] = handleEmptyValue(form.investigations.biochemistry.sap);
            row["SNa"] = handleEmptyValue(
              form.investigations.biochemistry.sNa
            );
            row["SK"] = handleEmptyValue(form.investigations.biochemistry.sK);
            row["FBS"] = handleEmptyValue(form.investigations.biochemistry.fbs);
            row["EGFR"] = handleEmptyValue(
              form.investigations.biochemistry.egfr
            );
            if (form.investigations.biochemistry.lipidProfile) {
               row["LipidProfilePresent"] = handleEmptyValue(
                form.investigations.biochemistry.lipidProfile.lipidProfilePresent
              );
              
                row["TC"] = handleEmptyValue(
                form.investigations.biochemistry.lipidProfile.tc
              );
              row["TG"] = handleEmptyValue(
                form.investigations.biochemistry.lipidProfile.tg
              );
              row["LDL"] = handleEmptyValue(
                form.investigations.biochemistry.lipidProfile.ldl
              );
              row["HDL"] = handleEmptyValue(
                form.investigations.biochemistry.lipidProfile.hdl
              );
              row["HBA1C"] = handleEmptyValue(
                form.investigations.biochemistry.lipidProfile.hba1c
              );
            }
          }
          if (form.investigations.urine) {
            row["UrinePresent"] = handleEmptyValue(
              form.investigations.urine.urinePresent
            );
            row["UrineLowestPH"] = handleEmptyValue(
              form.investigations.urine.lowestPh
            );
            row["UrineAlbumin"] = handleEmptyValue(
              form.investigations.urine.albumin
            );
            row["UrineGlucose"] = handleEmptyValue(
              form.investigations.urine.glucose
            );
            row["UrineMicroscopy"] = handleEmptyValue(
              form.investigations.urine.microscopy
            );
          }
          if (form.investigations.sttg) {
            row["SttgPresent"] = handleEmptyValue(
              form.investigations.sttg.sttgPresent
            );
            row["STTGValue"] = handleEmptyValue(
              form.investigations.sttg.value
            );
            row["STTGPlace"] = handleEmptyValue(
              form.investigations.sttg.place
            );
          }
          if (form.investigations.imaging) {
            row["ImagingPresent"] = handleEmptyValue(
              form.investigations.imaging.imagingPresent
            );
            row["XrayChest"] = handleEmptyValue(
              form.investigations.imaging.xrayChest
            );
            row["XraySkull"] = handleEmptyValue(
              form.investigations.imaging.xraySkull
            );
            if (form.investigations.imaging.boneAge) {
              row["BoneAgePresent"] = formatDate(
                form.investigations.imaging.boneAge.boneAgePresent
              );
              row["BoneAgeDate"] = formatDate(
                form.investigations.imaging.boneAge.date
              );
              row["BoneAgeValue"] = handleEmptyValue(
                form.investigations.imaging.boneAge.value
              );
              row["GPScoring"] = handleEmptyValue(
                form.investigations.imaging.boneAge.gpScoring
              );
            }
          }
        }

        // Add endocrine workup fields
        if (form.endocrineWorkup) {
            row["EndocrineWorkupPresent"] = handleEmptyValue(
              form.endocrineWorkup.endocrineWorkupPresent
            );
            row["EndocrineWorkupDate"] = handleEmptyValue(
              form.endocrineWorkup.date
            );
          if (form.endocrineWorkup.tests) {
                        row["TestsPresent"] = handleEmptyValue(form.endocrineWorkup.tests.testsPresent);

            row["T4"] = handleEmptyValue(form.endocrineWorkup.tests.t4);
            row["FreeT4"] = handleEmptyValue(
              form.endocrineWorkup.tests.freeT4
            );
            row["TSH"] = handleEmptyValue(form.endocrineWorkup.tests.tsh);
            row["LH"] = handleEmptyValue(form.endocrineWorkup.tests.lh);
            row["FSH"] = handleEmptyValue(form.endocrineWorkup.tests.fsh);
            row["PRL"] = handleEmptyValue(form.endocrineWorkup.tests.prl);
            row["ACTH"] = handleEmptyValue(form.endocrineWorkup.tests.acth);
            row["Cortisol8AM"] = handleEmptyValue(
              form.endocrineWorkup.tests.cortisol8am
            );
            row["IGF1"] = handleEmptyValue(form.endocrineWorkup.tests.igf1);
            row["Estradiol"] = handleEmptyValue(
              form.endocrineWorkup.tests.estradiol
            );
            row["Testosterone"] = handleEmptyValue(
              form.endocrineWorkup.tests.testosterone
            );
          }
          if (form.endocrineWorkup.ghStimulationTest) {
            row["GHStimulationTestPresent"] = handleEmptyValue(
              form.endocrineWorkup.ghStimulationTest.ghStimulationTestPresent
            );
            row["GHStimulationType"] = handleEmptyValue(
              form.endocrineWorkup.ghStimulationTest.ghStimulationType
            );
            row["GHStimulationDate"] = formatDate(
              form.endocrineWorkup.ghStimulationTest.date
            );
            row["GHStimulationPlace"] = handleEmptyValue(
              form.endocrineWorkup.ghStimulationTest.place
            );
            row["OutsidePlace"] = handleEmptyValue(
              form.endocrineWorkup.ghStimulationTest.outsidePlace
            );
            row["TestsDone"] = handleEmptyValue(
              form.endocrineWorkup.ghStimulationTest.testsDone
            );
            row["SingleTestType"] = handleEmptyValue(
              form.endocrineWorkup.ghStimulationTest.singleTestType
            );
            row["PeakGHLevel"] = handleEmptyValue(
              form.endocrineWorkup.ghStimulationTest.peakGHLevel
            );
            row["ExactPeakGH"] = handleEmptyValue(
              form.endocrineWorkup.ghStimulationTest.exactPeakGH
            );
            row["PeakGHTime"] = handleEmptyValue(
              form.endocrineWorkup.ghStimulationTest.peakGHTime
            );
            
            // Add GH stimulation test results array
            if (form.endocrineWorkup.ghStimulationTest.results && 
                Array.isArray(form.endocrineWorkup.ghStimulationTest.results)) {
              
              // Process each result entry
              form.endocrineWorkup.ghStimulationTest.results.forEach((result, index) => {
                const timeKey = `GHTestTime_${index + 1}`;
                const clonidineKey = `GHTestClonidine_${index + 1}`;
                const glucagonKey = `GHTestGlucagon_${index + 1}`;
                
                row[timeKey] = handleEmptyValue(result.time);
                row[clonidineKey] = handleEmptyValue(result.clonidineGH);
                row[glucagonKey] = handleEmptyValue(result.glucagonGH);
              });
              
              // Add total count of results
              row["GHTestResults"] = form.endocrineWorkup.ghStimulationTest.results.length;
            }
          }
        }

        // Add treatment fields
        if (form.treatment) {
            row["TreatmentDetailsPresent"] = handleEmptyValue(
              form.treatment.treatmentDetailsPresent
            );
          if (form.treatment.hypothyroidism) {
            row["HypothyroidismPresent"] = handleEmptyValue(
              form.treatment.hypothyroidism.present
            );
            row["HypothyroidismDiagnosisDate"] = formatDate(
              form.treatment.hypothyroidism.diagnosisDate
            );
            row["HypothyroidismTreatmentStartDate"] = formatDate(
              form.treatment.hypothyroidism.treatmentStartDate
            );
            row["HypothyroidismCurrentDose"] = handleEmptyValue(
              form.treatment.hypothyroidism.currentDose
            );
            row["HypothyroidismDoseChanged"] = handleEmptyValue(
              form.treatment.hypothyroidism.doseChanged
            );
            row["HypothyroidismLastT4"] = handleEmptyValue(
              form.treatment.hypothyroidism.lastT4
            );
            row["HypothyroidismSource"] = handleEmptyValue(
              form.treatment.hypothyroidism.source
            );
          }
          if (form.treatment.hypocortisolism) {
            row["HypocortisolismPresent"] = handleEmptyValue(
              form.treatment.hypocortisolism.present
            );
            row["HypocortisolismDiagnosisDate"] = formatDate(
              form.treatment.hypocortisolism.diagnosisDate
            );
            row["ACTHStimTest"] = handleEmptyValue(
              form.treatment.hypocortisolism.acthStimTest
            );
            row["TestDate"] = formatDate(
              form.treatment.hypocortisolism.testDate
            );
            row["PeakCortisol"] = handleEmptyValue(
              form.treatment.hypocortisolism.peakCortisol
            );
            row["HypocortisolismTreatmentStartDate"] = formatDate(
              form.treatment.hypocortisolism.treatmentStartDate
            );
            row["SteroidType"] = handleEmptyValue(
              form.treatment.hypocortisolism.steroidType
            );
            row["HypocortisolismCurrentDose"] = handleEmptyValue(
              form.treatment.hypocortisolism.currentDose
            );
            row["HypocortisolismFrequency"] = handleEmptyValue(
              form.treatment.hypocortisolism.frequency
            );
            row["HypocortisolismDailyDoseMG"] = handleEmptyValue(
              form.treatment.hypocortisolism.dailyDoseMG
            );
            row["HypocortisolismDoseChanged"] = handleEmptyValue(
              form.treatment.hypocortisolism.doseChanged
            );
            row["HypocortisolismSource"] = handleEmptyValue(
              form.treatment.hypocortisolism.source
            );
          }
          if (form.treatment.di) {
            row["DiabetesInsipidusPresent"] = handleEmptyValue(form.treatment.di.present);
            row["DDiabetesInsipidusDiagnosisDate"] = formatDate(
              form.treatment.di.diagnosisDate
            );
            row["Minirin"] = handleEmptyValue(form.treatment.di.minirin);
            row["MinirinDose"] = handleEmptyValue(form.treatment.di.dose);
            row["MinirinFrequency"] = handleEmptyValue(form.treatment.di.frequency);
          }
          if (form.treatment.hypogonadism) {
            row["HypogonadismPresent"] = handleEmptyValue(
              form.treatment.hypogonadism.present
            );
            row["HypogonadismDateOfDaignosis"] = formatDate(
              form.treatment.hypogonadism.diagnosisDate
            );
            row["HypogonadismDateofTreatment"] = formatDate(
              form.treatment.hypogonadism.treatmentStartDate
            );
            row["DateofReachingFullAdultDose"] = formatDate(
              form.treatment.hypogonadism.fullAdultDoseDate
            );
            row["HormoneType"] = handleEmptyValue(
              form.treatment.hypogonadism.hormoneType
            );
            row["DateofStartingMPA"] = formatDate(
              form.treatment.hypogonadism.mpaStartDate
            );
            row["HypogonadismCurrentDose"] = handleEmptyValue(
              form.treatment.hypogonadism.currentDose
            );
            row["HypogonadismDoseChanged"] = handleEmptyValue(
              form.treatment.hypogonadism.doseChanged
            );
          }
          if (form.treatment.supplements) {
            row["Calcium"] = handleEmptyValue(
              form.treatment.supplements.calcium
            );
            row["VitaminD"] = handleEmptyValue(
              form.treatment.supplements.vitaminD
            );
            row["Iron"] = handleEmptyValue(
              form.treatment.supplements.iron
            );
          }
          if (form.treatment.otherTreatments) {
            row["OtherTreatmentsPresent"] = handleEmptyValue(
              form.treatment.otherTreatments.otherTreatmentsPresent
            );
            row["Antiepileptics"] = handleEmptyValue(
              form.treatment.otherTreatments.antiepileptics
            );
            row["OtherDrugs"] = handleEmptyValue(
              form.treatment.otherTreatments.otherDrugs
            );
          }
        }

        // Add diagnosis fields
        if (form.diagnosis) {
          row["DiagnosisPresent"] = handleEmptyValue(form.diagnosis.diagnosisPresent);
          row["DiagnosisType"] = handleEmptyValue(form.diagnosis.diagnosisType);
          row["IsolatedGHD"] = handleEmptyValue(form.diagnosis.isolatedGHD);
          row["Hypopituitarism"] = handleEmptyValue(form.diagnosis.hypopituitarism);
          
          if (form.diagnosis.affectedAxes) {
            row["AffectedAxesPresent"] = handleEmptyValue(form.diagnosis.affectedAxes.affectedAxesPresent);
            row["Thyroid"] = handleEmptyValue(form.diagnosis.affectedAxes.thyroid);
            row["Cortisol"] = handleEmptyValue(form.diagnosis.affectedAxes.cortisol);
            row["Gonadal"] = handleEmptyValue(form.diagnosis.affectedAxes.gonadal);
            row["DI"] = handleEmptyValue(form.diagnosis.affectedAxes.di);
          }
          
          row["MRIAbnormality"] = handleEmptyValue(form.diagnosis.mriAbnormality);
        }

        // Add history of current illness
        row["HistoryOfCurrentIllness"] = handleEmptyValue(form.historyOfCurrentIllness);

        // Add remarks fields
        if (form.remarks) {
          row["BirthHistoryRemarks"] = handleEmptyValue(form.remarks.birthHistory);
          row["PubertyHistoryRemarks"] = handleEmptyValue(form.remarks.pubertyHistory);
          row["FamilyHistoryRemarks"] = handleEmptyValue(form.remarks.familyHistory);
          row["MeasurementsRemarks"] = handleEmptyValue(form.remarks.measurements);
          row["PhysicalFindingsRemarks"] = handleEmptyValue(form.remarks.physicalFindings);
          row["PituitarySurgeryRemarks"] = handleEmptyValue(form.remarks.pituitarySurgeryHistory);
          row["PituitaryRadiationRemarks"] = handleEmptyValue(form.remarks.pituitaryRadiation);
          
          // Add investigation remarks
          if (form.remarks.investigations) {
            row["HematologyRemarks"] = handleEmptyValue(form.remarks.investigations.hematology);
            row["DLCRemarks"] = handleEmptyValue(form.remarks.investigations.dlc);
            row["PBFRemarks"] = handleEmptyValue(form.remarks.investigations.pbf);
            row["BiochemistryRemarks"] = handleEmptyValue(form.remarks.investigations.biochemistry);
            row["UrineRemarks"] = handleEmptyValue(form.remarks.investigations.urine);
            row["SttgRemarks"] = handleEmptyValue(form.remarks.investigations.sttg);
            row["ImagingRemarks"] = handleEmptyValue(form.remarks.investigations.imaging);
            row["TestsRemarks"] = handleEmptyValue(form.remarks.investigations.tests);
            row["GHStimulationTestRemarks"] = handleEmptyValue(form.remarks.investigations.ghStimulationTest);
            row["TestResultsRemarks"] = handleEmptyValue(form.remarks.investigations.testResults);
            row["MRIFindingsRemarks"] = handleEmptyValue(form.remarks.investigations.mriFindings);
          }
          
          // Add diagnosis remarks
          if (form.remarks.diagnosis) {
            row["HypothyroidismRemarks"] = handleEmptyValue(form.remarks.diagnosis.hypothyroidism);
            row["HypocortisolismRemarks"] = handleEmptyValue(form.remarks.diagnosis.hypocortisolism);
            row["DiabetesInsipidusRemarks"] = handleEmptyValue(form.remarks.diagnosis.diabetesInsipidus);
            row["HypogonadismRemarks"] = handleEmptyValue(form.remarks.diagnosis.hypogonadism);
            row["OtherTreatmentsRemarks"] = handleEmptyValue(form.remarks.diagnosis.otherTreatments);
            row["AffectedAxesRemarks"] = handleEmptyValue(form.remarks.diagnosis.affectedAxis);
          }
        }

        // Remove excluded fields
        excludeFields.forEach((field) => {
          delete row[field];
        });

        return row;
      });

      const baselineWorksheet = XLSX.utils.json_to_sheet(baselineData);
      XLSX.utils.book_append_sheet(
        workbook,
        baselineWorksheet,
        "Baseline Forms"
      );
    }

    // Export followup forms
    if (followupForms.length > 0) {
      const followupData = followupForms.map((form) => {
        const row = {
          "S.NO": followupForms.indexOf(form) + 1,
          "PAEC No": handleEmptyValue(form.patientDetails?.paecNo),
          "Patient Name": handleEmptyValue(form.patientDetails?.name),
          UHID: handleEmptyValue(form.patientDetails?.uhid),
          Sex: handleEmptyValue(form.patientDetails?.sex),
          Age: handleEmptyValue(form.patientDetails?.age),
          DOB: formatDate(form.patientDetails?.dob),
          Address: handleEmptyValue(form.patientDetails?.address?.street),
          City: handleEmptyValue(form.patientDetails?.address?.city),
          State: handleEmptyValue(form.patientDetails?.address?.state),
          "Phone 1": handleEmptyValue(form.patientDetails?.contact?.cell1),
          "Phone 2": handleEmptyValue(form.patientDetails?.contact?.cell2),
          Landline: handleEmptyValue(form.patientDetails?.contact?.landline),
          "Visit Date": formatDate(form.visitDate),
          "Form Type": "Followup",
          "Baseline PAEC No": handleEmptyValue(
            form.baselineForm?.patientDetails?.paecNo
          ),
          "Created By": handleEmptyValue(form.createdBy?.userName),
          "Created Date": formatDate(form.createdAt),
          Center: handleEmptyValue(form.center?.name),
        };

        // Add diagnosis fields (same as baseline)
        if (form.diagnosis) {
          row["Diagnosis Type"] = handleEmptyValue(
            form.diagnosis.diagnosisType
          );
          row["Isolated GHD"] = handleEmptyValue(form.diagnosis.isolatedGHD);
          row["Hypopituitarism"] = handleEmptyValue(
            form.diagnosis.hypopituitarism
          );
          row["Affected Axes Thyroid"] = handleEmptyValue(
            form.diagnosis.affectedAxes?.thyroid
          );
          row["Affected Axes Cortisol"] = handleEmptyValue(
            form.diagnosis.affectedAxes?.cortisol
          );
          row["Affected Axes Gonadal"] = handleEmptyValue(
            form.diagnosis.affectedAxes?.gonadal
          );
          row["Affected Axes DI"] = handleEmptyValue(
            form.diagnosis.affectedAxes?.di
          );
          row["MRI Abnormality"] = handleEmptyValue(
            form.diagnosis.mriAbnormality
          );
        }

        // Add all other fields similar to baseline (abbreviated for brevity)
        // ... (same field mapping as baseline)

        // Remove excluded fields
        excludeFields.forEach((field) => {
          delete row[field];
        });

        return row;
      });

      const followupWorksheet = XLSX.utils.json_to_sheet(followupData);
      XLSX.utils.book_append_sheet(
        workbook,
        followupWorksheet,
        "Followup Forms"
      );
    }

    // Generate Excel file
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Log the export
    await newLog({
      user: req.user._id,
      action: "exported",
      module: "excel_export",
      modifiedData: {
        formType,
        totalBaseline: baselineForms.length,
        totalFollowup: followupForms.length,
        filters: { paecNo, patientName, uhid, fromDate, toDate },
      },
    });

    // Set response headers
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=paec_export_${formType}_${timestamp}.xlsx`
    );

    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
