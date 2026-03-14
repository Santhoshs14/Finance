const importService = require('../services/importService');
const { success, error } = require('../utils/apiResponse');

const importExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      return error(res, 'Please upload an Excel file', 400);
    }

    const parsed = importService.parseExcel(req.file.buffer);

    if (parsed.length === 0) {
      return error(res, 'No valid data found in the Excel file', 400);
    }

    // Detect duplicates
    const withDuplicates = await importService.detectDuplicates(req.user.id, parsed);

    // Preview mode — return parsed data without importing
    if (req.query.preview === 'true') {
      return success(res, {
        total: withDuplicates.length,
        duplicates: withDuplicates.filter((t) => t.is_duplicate).length,
        new_transactions: withDuplicates.filter((t) => !t.is_duplicate).length,
        transactions: withDuplicates,
      }, 'Preview generated. Send request without preview=true to import.');
    }

    // Import mode
    const { account_id } = req.body;
    const result = await importService.importTransactions(req.user.id, withDuplicates, account_id);

    return success(res, result, `Imported ${result.imported} transactions, skipped ${result.skipped} duplicates`, 201);
  } catch (err) { next(err); }
};

module.exports = { importExcel };
