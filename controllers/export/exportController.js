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

    // PAEC No filter (array or string)
    if (Array.isArray(paecNo) && paecNo.length > 0) {
      baselineQuery["patientDetails.paecNo"] = { $in: paecNo };
    } else if (paecNo) {
      baselineQuery["patientDetails.paecNo"] = { $regex: paecNo, $options: "i" };
    }

    // Name filter (array or string)
    if (Array.isArray(patientName) && patientName.length > 0) {
      baselineQuery["$or"] = [
        ...(baselineQuery["$or"] || []),
        ...patientName.map(val => ({
          "patientDetails.name": { $regex: val, $options: "i" }
        }))
      ];
    } else if (patientName) {
      baselineQuery["patientDetails.name"] = { $regex: patientName, $options: "i" };
    }

    // UHID filter (array or string)
    if (Array.isArray(uhid) && uhid.length > 0) {
      baselineQuery["$or"] = [
        ...(baselineQuery["$or"] || []),
        ...uhid.map(val => ({
          "patientDetails.uhid": { $regex: val, $options: "i" }
        }))
      ];
    } else if (uhid) {
      baselineQuery["patientDetails.uhid"] = { $regex: uhid, $options: "i" };
    }

    if (fromDate || toDate) {
      const dateQuery = {};
      if (fromDate) dateQuery.$gte = new Date(fromDate);
      if (toDate) dateQuery.$lte = new Date(toDate);
      baselineQuery.visitDate = dateQuery;
      followupQuery["visitDetails.currentVisitDate"] = dateQuery;
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
      // Check total followup forms in database
      const totalFollowupForms = await FollowupForm.countDocuments({ "isDeleted.status": false });
      console.log("Total followup forms in database:", totalFollowupForms);
      
      // First, get all followup forms without filters
      let followupFormsQuery = FollowupForm.find({ "isDeleted.status": false })
        .populate("baselineForm", "patientDetails center")
        .populate("createdBy", "userName email")
        .sort({ "visitDetails.currentVisitDate": -1 });

      // Apply access control
      if (accessTo === "own") {
        followupFormsQuery = followupFormsQuery.where("createdBy", req.user._id);
      } else if (accessTo === "center") {
        // For center access, we need to filter after population since center is in baseline form
        // We'll handle this in the JavaScript filtering
      }

      followupForms = await followupFormsQuery.exec();

      // Apply filters after population
      if (Array.isArray(paecNo) && paecNo.length > 0) {
        followupForms = followupForms.filter(form =>
          paecNo.some(val =>
            form.baselineForm?.patientDetails?.paecNo?.toLowerCase().includes(val.toLowerCase())
          )
        );
      } else if (paecNo) {
        followupForms = followupForms.filter(form =>
          form.baselineForm?.patientDetails?.paecNo?.toLowerCase().includes(paecNo.toLowerCase())
        );
      }

      if (Array.isArray(patientName) && patientName.length > 0) {
        followupForms = followupForms.filter(form =>
          patientName.some(val =>
            form.baselineForm?.patientDetails?.name?.toLowerCase().includes(val.toLowerCase())
          )
        );
      } else if (patientName) {
        followupForms = followupForms.filter(form =>
          form.baselineForm?.patientDetails?.name?.toLowerCase().includes(patientName.toLowerCase())
        );
      }

      if (Array.isArray(uhid) && uhid.length > 0) {
        followupForms = followupForms.filter(form =>
          uhid.some(val =>
            form.baselineForm?.patientDetails?.uhid?.toLowerCase().includes(val.toLowerCase())
          )
        );
      } else if (uhid) {
        followupForms = followupForms.filter(form =>
          form.baselineForm?.patientDetails?.uhid?.toLowerCase().includes(uhid.toLowerCase())
        );
      }

      if (fromDate || toDate) {
        followupForms = followupForms.filter(form => {
          const visitDate = new Date(form.visitDetails?.currentVisitDate);
          if (fromDate && visitDate < new Date(fromDate)) return false;
          if (toDate && visitDate > new Date(toDate)) return false;
          return true;
        });
      }

      // Apply center access control after population
      if (accessTo === "center") {
        followupForms = followupForms.filter(form => 
          form.baselineForm?.center?.toString() === req.user.center?.toString()
        );
      }
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
          "SNO": baselineForms.indexOf(form) + 1,
          "PAECNo": handleEmptyValue(form.patientDetails?.paecNo),
          "Name": handleEmptyValue(form.patientDetails?.name),
          "UHID": handleEmptyValue(form.patientDetails?.uhid),
          "Sex": handleEmptyValue(form.patientDetails?.sex),
          "Age": handleEmptyValue(form.patientDetails?.age),
          "DOB": formatDate(form.patientDetails?.dob),
          "HouseNumber": handleEmptyValue(form.patientDetails?.address?.street),
          "City": handleEmptyValue(form.patientDetails?.address?.city),
          "State": handleEmptyValue(form.patientDetails?.address?.state),
          "Cell1": handleEmptyValue(form.patientDetails?.contact?.cell1),
          "Cell2": handleEmptyValue(form.patientDetails?.contact?.cell2),
          "Landline": handleEmptyValue(form.patientDetails?.contact?.landline),
          "VisitDate": formatDate(form.visitDate),
          "Form Type": "Baseline",
          "Created By": handleEmptyValue(form.createdBy?.userName),
          "Created Date": formatDate(form.createdAt),
          Center: handleEmptyValue(form.center?.name),
        };


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
              
              const clonidineTimes = ["0", "30", "60", "90", "120", "150"];
              const glucagonTimes = ["0", "30", "60", "90", "120", "150", "180"];
              const resultMap = {};
              form.endocrineWorkup.ghStimulationTest.results.forEach((result) => {
                let timeNum = "NA";
                if (typeof result.time === "string") {
                  const match = result.time.match(/(\d+)/);
                  if (match) timeNum = match[1];
                }
                resultMap[timeNum] = result;
              });
              clonidineTimes.forEach(timeNum => {
                const result = resultMap[timeNum] || {};
                const clonidineKey = `GHTestClonidine${timeNum}`;
                row[clonidineKey] = handleEmptyValue(result.clonidineGH);
              });
              glucagonTimes.forEach(timeNum => {
                const result = resultMap[timeNum] || {};
                const glucagonKey = `GHTestGlucagon${timeNum}`;
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
            row["DiabetesInsipidusDiagnosisDate"] = formatDate(
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
    console.log("Followup forms found:", followupForms.length);
    if (followupForms.length > 0) {
      const followupData = followupForms.map((form) => {
        const row = {
          "S.NO": followupForms.indexOf(form) + 1,
          "PAECNo": handleEmptyValue(form.baselineForm?.patientDetails?.paecNo),
          "Name": handleEmptyValue(form.baselineForm?.patientDetails?.name),
          "UHID": handleEmptyValue(form.baselineForm?.patientDetails?.uhid),
          "Sex": handleEmptyValue(form.baselineForm?.patientDetails?.sex),
          "Age": handleEmptyValue(form.baselineForm?.patientDetails?.age),
          "DOB": formatDate(form.baselineForm?.patientDetails?.dob),
          "HouseNumber": handleEmptyValue(form.baselineForm?.patientDetails?.address?.street),
          "City": handleEmptyValue(form.baselineForm?.patientDetails?.address?.city),
          "State": handleEmptyValue(form.baselineForm?.patientDetails?.address?.state),
          "Cell1": handleEmptyValue(form.baselineForm?.patientDetails?.contact?.cell1),
          "Cell2": handleEmptyValue(form.baselineForm?.patientDetails?.contact?.cell2),
          "Landline": handleEmptyValue(form.baselineForm?.patientDetails?.contact?.landline),
          "Form Type": "Followup",
          "BaselinePAECNo": handleEmptyValue(
            form.baselineForm?.patientDetails?.paecNo
          ),
          "Created By": handleEmptyValue(form.createdBy?.userName),
          "Created Date": formatDate(form.createdAt),
          // "Center": handleEmptyValue(form.baselineForm?.center?.name),
        };

        // Add visit details
        if (form.visitDetails) {
          row["LastVisitDate"] = formatDate(form.baselineForm?.visitDate);
          row["CurrentVisitDate"] = formatDate(form.visitDetails.currentVisitDate);
        }

        // Add GH therapy details
        if (form.ghTherapy) {
          row["GHTherapyPresent"] = handleEmptyValue(form.ghTherapy.ghTherapyPresent);
          
          if (form.ghTherapy.details) {
            row["GHCurrentDose"] = handleEmptyValue(form.ghTherapy.details.currentDose);
            row["GHBrand"] = handleEmptyValue(form.ghTherapy.details.brand);
            row["GHAdministrationMethod"] = handleEmptyValue(form.ghTherapy.details.administrationMethod);
            row["GHSyringeUsage"] = handleEmptyValue(form.ghTherapy.details.syringeUsage);
            row["GHCostCoverage"] = handleEmptyValue(form.ghTherapy.details.costCoverage);
          }
          
          row["GHTherapyRemarks"] = handleEmptyValue(form.ghTherapy.remarks);
        }

        // Add measurements
        if (form.measurements) {
          row["MeasurementsPresent"] = handleEmptyValue(form.measurements.measurementsPresent);
          row["Height"] = handleEmptyValue(form.measurements.height);
          row["Weight"] = handleEmptyValue(form.measurements.weight);
          row["BMI"] = handleEmptyValue(form.measurements.bmi);
          row["HeightSDS"] = handleEmptyValue(form.measurements.heightSds);
          row["WeightSDS"] = handleEmptyValue(form.measurements.weightSds);
          row["BMISDS"] = handleEmptyValue(form.measurements.bmiSds);
          row["MeasurementsRemarks"] = handleEmptyValue(form.measurements.remarks);
        }

        // Add pubertal status
        if (form.pubertalStatus) {
          row["PubertalStatusPresent"] = handleEmptyValue(form.pubertalStatus.pubertalStatusPresent);
          
          if (form.pubertalStatus.testicularVolume) {
            row["TesticularVolumeRight"] = handleEmptyValue(form.pubertalStatus.testicularVolume.right);
            row["TesticularVolumeLeft"] = handleEmptyValue(form.pubertalStatus.testicularVolume.left);
          }
          
          row["PubicHair"] = handleEmptyValue(form.pubertalStatus.pubicHair);
          row["BreastStage"] = handleEmptyValue(form.pubertalStatus.breastStage);
          row["PubertalStatusRemarks"] = handleEmptyValue(form.pubertalStatus.remarks);
        }

        // Add compliance
        if (form.compliance) {
          row["CompliancePresent"] = handleEmptyValue(form.compliance.compliancePresent);
          row["MissedDoses"] = handleEmptyValue(form.compliance.missedDoses);
          
          if (form.compliance.details) {
            row["DaysMissedPerMonth"] = handleEmptyValue(form.compliance.details.daysMissedPerMonth);
            row["DaysMissedLast3Months"] = handleEmptyValue(form.compliance.details.daysMissedLast3Months);
            row["LastPAECVisit"] = handleEmptyValue(form.compliance.details.lastPAECVisit);
            row["DaysMissedPerWeek"] = handleEmptyValue(form.compliance.details.daysMissedPerWeek);
            row["TotalDaysMissedSinceLastVisit"] = handleEmptyValue(form.compliance.details.totalDaysMissedSinceLastVisit);
            row["ComplianceReasons"] = handleEmptyValue(form.compliance.details.reasons);
          }
          
          row["ComplianceRemarks"] = handleEmptyValue(form.compliance.remarks);
        }

        // Add side effects
        if (form.sideEffects) {
          row["SideEffectsPresent"] = handleEmptyValue(form.sideEffects.sideEffectsPresent);
          
          if (form.sideEffects.effects) {
            row["EdemaFeet"] = handleEmptyValue(form.sideEffects.effects.edemaFeet);
            row["Headache"] = handleEmptyValue(form.sideEffects.effects.headache);
            row["Gynecomastia"] = handleEmptyValue(form.sideEffects.effects.gynecomastia);
            row["BlurringVision"] = handleEmptyValue(form.sideEffects.effects.blurringVision);
            row["HipJointPain"] = handleEmptyValue(form.sideEffects.effects.hipJointPain);
          }
          
          row["SideEffectsRemarks"] = handleEmptyValue(form.sideEffects.remarks);
        }

        // Add associated illness
        if (form.associatedIllness) {
          row["AssociatedIllnessPresent"] = handleEmptyValue(form.associatedIllness.associatedIllnessPresent);
          row["AssociatedIllnessDetails"] = handleEmptyValue(form.associatedIllness.details);
          row["OtherComplaints"] = handleEmptyValue(form.associatedIllness.otherComplaints);
          row["AssociatedIllnessRemarks"] = handleEmptyValue(form.associatedIllness.remarks);
        }

        // Add growth velocity
        if (form.growthVelocity) {
          row["GrowthVelocityPresent"] = handleEmptyValue(form.growthVelocity.growthVelocityPresent);
          row["Last6Months"] = handleEmptyValue(form.growthVelocity.last6Months);
          row["SinceGHStart"] = handleEmptyValue(form.growthVelocity.sinceGHStart);
          row["GrowthVelocityRemarks"] = handleEmptyValue(form.growthVelocity.remarks);
        }

        // Add investigations
        if (form.investigations) {
          row["InvestigationsPresent"] = handleEmptyValue(form.investigations.investigationsPresent);
          
          if (form.investigations.boneAge) {
            row["LastXRayDate"] = handleEmptyValue(form.investigations.boneAge.lastXRayDate);
          }
          
          if (form.investigations.labTests) {
            if (form.investigations.labTests.serumT4) {
              row["SerumT4Value"] = handleEmptyValue(form.investigations.labTests.serumT4.value);
              row["SerumT4Date"] = handleEmptyValue(form.investigations.labTests.serumT4.date);
            }
            
            if (form.investigations.labTests.igf1) {
              row["IGF1Value"] = handleEmptyValue(form.investigations.labTests.igf1.value);
              row["IGF1Date"] = handleEmptyValue(form.investigations.labTests.igf1.date);
            }
          }
          
          row["InvestigationsRemarks"] = handleEmptyValue(form.investigations.remarks);
        }

        // Add advised treatment
        if (form.advisedTreatment) {
          row["AdvisedTreatmentPresent"] = handleEmptyValue(form.advisedTreatment.advisedTreatmentPresent);
          
          if (form.advisedTreatment.ghDoseCalculation) {
            row["CurrentWeight"] = handleEmptyValue(form.advisedTreatment.ghDoseCalculation.currentWeight);
            row["MgPerKgPerWeek"] = handleEmptyValue(form.advisedTreatment.ghDoseCalculation.mgPerKgPerWeek);
            row["CalculatedDose"] = handleEmptyValue(form.advisedTreatment.ghDoseCalculation.calculatedDose);
            row["RoundedDose"] = handleEmptyValue(form.advisedTreatment.ghDoseCalculation.roundedDose);
          }
          
          if (form.advisedTreatment.accompanyingTreatments) {
            if (form.advisedTreatment.accompanyingTreatments.thyroxin) {
              row["ThyroxinDose"] = handleEmptyValue(form.advisedTreatment.accompanyingTreatments.thyroxin.dose);
            }
            
            if (form.advisedTreatment.accompanyingTreatments.corticosteroids) {
              row["CorticosteroidsType"] = handleEmptyValue(form.advisedTreatment.accompanyingTreatments.corticosteroids.corticosteroidsType);
              row["CorticosteroidsDose"] = handleEmptyValue(form.advisedTreatment.accompanyingTreatments.corticosteroids.dose);
              row["CorticosteroidsFrequency"] = handleEmptyValue(form.advisedTreatment.accompanyingTreatments.corticosteroids.frequency);
            }
            
            if (form.advisedTreatment.accompanyingTreatments.minirin) {
              row["MinirinDose"] = handleEmptyValue(form.advisedTreatment.accompanyingTreatments.minirin.dose);
            }
            
            if (form.advisedTreatment.accompanyingTreatments.testosterone) {
              row["TestosteroneDose"] = handleEmptyValue(form.advisedTreatment.accompanyingTreatments.testosterone.dose);
              row["TestosteroneFrequency"] = handleEmptyValue(form.advisedTreatment.accompanyingTreatments.testosterone.frequency);
            }
            
            if (form.advisedTreatment.accompanyingTreatments.pragynova) {
              row["PragynovaDose"] = handleEmptyValue(form.advisedTreatment.accompanyingTreatments.pragynova.dose);
            }
          }
          
          row["AdvisedTreatmentRemarks"] = handleEmptyValue(form.advisedTreatment.remarks);
        }

       

        // Remove excluded fields
        excludeFields.forEach((field) => {
          delete row[field];
        });

        return row;
      });

      if (followupData.length > 0) {
        const followupWorksheet = XLSX.utils.json_to_sheet(followupData);
        XLSX.utils.book_append_sheet(
          workbook,
          followupWorksheet,
          "Followup Forms"
        );
      }
    }

    // Check if workbook has any sheets
    if (workbook.SheetNames.length === 0) {
      return res.status(400).json({ 
        message: "No data found for export. Please check your filters or ensure data exists." 
      });
    }

    // Generate Excel file
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Log the export
    await newLog({
      user: req.user._id,
      action: "export",
      module: "baselineform",
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
