const reportService = require('../services/reportService');
const { success, error } = require('../utils/apiResponse');

const getMonthlyReport = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    if (month < 1 || month > 12) {
      return error(res, 'Month must be between 1 and 12', 400);
    }

    const report = await reportService.getMonthlyReport(req.user.id, month, year);

    if (req.query.format === 'pdf') {
      const pdfBuffer = await reportService.generatePDF(report, 'monthly');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=monthly_report_${month}_${year}.pdf`);
      return res.send(pdfBuffer);
    }

    return success(res, report, 'Monthly report generated');
  } catch (err) { next(err); }
};

const getYearlyReport = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const report = await reportService.getYearlyReport(req.user.id, year);

    if (req.query.format === 'pdf') {
      const pdfBuffer = await reportService.generatePDF(report, 'yearly');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=yearly_report_${year}.pdf`);
      return res.send(pdfBuffer);
    }

    return success(res, report, 'Yearly report generated');
  } catch (err) { next(err); }
};

module.exports = { getMonthlyReport, getYearlyReport };
