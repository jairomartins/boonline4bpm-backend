//Controller of Incident Reports

const multer = require('multer')
const path  = require('fs')

const { json } = require('body-parser')
const IncidentReport = require('../model/boletim')


// Create or Update Incident Report
exports.createOrUpdateIncidentReport = async (req, res) => {

    const incidentReportData = req.body.incidentReport;
    incidentReportData._id ? console.log("Updating Incident Report...") : console.log("Creating new Incident Report...");   
    // logic to update an existing Incident Report if _id is provided (when incidentReportData._id exists in the request body)
    if (incidentReportData._id) {
        try{
            const updatedIncidentReport = await IncidentReport.findByIdAndUpdate(
            incidentReportData._id,
            incidentReportData,
            { new: true })
            return res.status(200).send({incidentReport: JSON.stringify(updatedIncidentReport), message: "Incident Report updated successfully!"});
        }catch(err){
            return res.status(500).send({message:"Error updating Incident Report", error: err});
        }
    } else {
      // logic to create a new Incident Report if _id is not provided (when incidentReportData._id does not exist in the request body)
        try{    
            const newIncidentReport = incidentReportData;
            const createdIncidentReport = await IncidentReport.create(newIncidentReport);
            return res.status(200).send({incidentReport: JSON.stringify(createdIncidentReport), message: "Incident Report created successfully!"});
        }catch(err){
            return res.status(500).send({message:"Error creating Incident Report", error: err});
        }

    }

}

//  Delete Incident Report by ID
exports.removeIncidentReport = async( req, res)=>{
    try {
        const incidentReport = await IncidentReport.deleteOne({ _id: req.params.id });
        return res.status(200).send(JSON.stringify(incidentReport))
    } catch (err) {
        return res.status(500).send({message:"Incident Report not found", error:err})     
    } 
}

// Search all Incident Reports on database
exports.incidentReports = async (req, res) => {
  try {
    const incidentReports = await IncidentReport.find().sort({ _id: -1 }); 
    return res.status(200).send(JSON.stringify(incidentReports));
  } catch (err) {
    return res.status(500).send({
      message: "We got a problem to fetch Incident Reports from database",
      error: err
    });
  }
};

exports.incidentReportsByViolenceDomestic = async (req, res) => {
  try {
    const ocorrencias = await IncidentReport.find(
      {
        natureza: { $regex: "viol[eê]ncia dom[eé]stica", $options: "i" }
      },
      {
        _id: 0,
        numero: 1,
        data: 1,
        natureza: 1,
        municipio: 1,
        bairro: 1
      }
    ).sort({ data: 1 });

    return res.status(200).json({
      total: ocorrencias.length,
      dados: ocorrencias
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erro ao buscar boletins de violência doméstica"
    });
  }
};

//Search Incident Report by ID on database  
exports.incidentReportByID = async (req, res)=>{
    try{
        const incidentReport = await IncidentReport.find({_id: req.params.incidentReportId})
        return res.status(200).send(JSON.stringify(incidentReport))
    }catch(err){
        return res.status(500).send({message:"Incident Report not found", error:err}) 
    }
}

//Search Incident Report by number of report
exports.incidentReportByNumber = async (req, res)=>{
    try{
        const incidentReport = await IncidentReport.findOne({numero: req.params.number}).sort({'_id':-1})
        return res.status(200).send(JSON.stringify(incidentReport))
    }catch(err){
        return res.status(500).send({message:"Couldn't fetch Incident Report by number", error:err}) 
    }
}

//Search Incident Report by number and city
exports.incidentReportByCityAndNumber = async (req, res)=>{
    try {
        const incidentReport = await IncidentReport.findOne({numero: req.params.number, municipio: req.params.city}).sort({'_id':-1})
        res.status(200).send(JSON.stringify(incidentReport))
    } catch (err) {
        return res.status(500).send({message:"Incident Report not found", error:err})    
    }    
}

// Return a list of Incident Reports by date
exports.incidentReportListByDate = async (req, res) => {
    try {
        const { day, month, year } = req.params;
        const dateToSearch = `${day}/${month}/${year}`;

        const incidentReportList = await IncidentReport.find({ data: dateToSearch }).sort({ municipio: 1, numero: 1 }); 
        return res.status(200).json(incidentReportList);
    } catch (err) {
        return res.status(500).send({
            message: "Error fetching Incident Reports by date",
            error: err
        });
    }
};
