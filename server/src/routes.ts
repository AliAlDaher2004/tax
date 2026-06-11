import { Router, Request, Response } from 'express';
import { supabase } from './db';
import ExcelJS from 'exceljs';

export const router = Router();

// Interfaces
interface InvoiceRecord {
  invoiceNumber: string;
  invoiceDate: string;
  taxNumber: string;
  mainItemCode: string;
  exemptionNumber: string;
  quantity: number;
  subtotalAmount: number;
  totalAmount: number;
}

// ==========================================
// 1. Companies Endpoints (CRUD)
// ==========================================

// GET all companies
router.get('/companies', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name_ar', { ascending: true });

    if (error) throw error;
    return res.json(data);
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST create company
router.post('/companies', async (req: Request, res: Response) => {
  try {
    const { name_ar, tax_number } = req.body;
    if (!name_ar || !tax_number) {
      return res.status(400).json({ error: 'Company name (name_ar) and tax number are required.' });
    }

    const { data, error } = await supabase
      .from('companies')
      .insert([{ name_ar, tax_number }])
      .select();

    if (error) throw error;
    return res.status(201).json(data[0]);
  } catch (error: any) {
    console.error('Error creating company:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// PUT update company
router.put('/companies/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name_ar, tax_number } = req.body;

    if (!name_ar || !tax_number) {
      return res.status(400).json({ error: 'Company name and tax number are required.' });
    }

    const { data, error } = await supabase
      .from('companies')
      .update({ name_ar, tax_number })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }
    return res.json(data[0]);
  } catch (error: any) {
    console.error('Error updating company:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// DELETE company
router.delete('/companies/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.json({ success: true, message: 'Company deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting company:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// ==========================================
// 2. Materials Endpoints (CRUD)
// ==========================================

// GET all materials
router.get('/materials', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('name_ar', { ascending: true });

    if (error) throw error;
    return res.json(data);
  } catch (error: any) {
    console.error('Error fetching materials:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST create material
router.post('/materials', async (req: Request, res: Response) => {
  try {
    const { name_ar, exemption_number, main_item_code } = req.body;
    if (!name_ar || !exemption_number || !main_item_code) {
      return res.status(400).json({
        error: 'Material name (name_ar), exemption number, and main item code are required.'
      });
    }

    const { data, error } = await supabase
      .from('materials')
      .insert([{ name_ar, exemption_number, main_item_code }])
      .select();

    if (error) throw error;
    return res.status(201).json(data[0]);
  } catch (error: any) {
    console.error('Error creating material:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// PUT update material
router.put('/materials/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name_ar, exemption_number, main_item_code } = req.body;

    if (!name_ar || !exemption_number || !main_item_code) {
      return res.status(400).json({
        error: 'Material name, exemption number, and main item code are required.'
      });
    }

    const { data, error } = await supabase
      .from('materials')
      .update({ name_ar, exemption_number, main_item_code })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Material not found.' });
    }
    return res.json(data[0]);
  } catch (error: any) {
    console.error('Error updating material:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// DELETE material
router.delete('/materials/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.json({ success: true, message: 'Material deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting material:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// ==========================================
// 3. Excel Export Endpoint
// ==========================================
router.post('/export', async (req: Request, res: Response) => {
  try {
    const invoices: InvoiceRecord[] = req.body;

    if (!Array.isArray(invoices)) {
      return res.status(400).json({ error: 'Body must be an array of invoice records.' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('بيانات الإعفاءات الضريبية');
    worksheet.views = [{ showGridLines: true }];

    // Define column mapping and order.
    // The columns MUST match the exact order and exact Arabic names:
    // 1. المبلغ الفرعي (subtotalAmount)
    // 2. الكمية (quantity)
    // 3. الصنف الفرعي (subItemCode - fixed 1)
    // 4. الصنف الرئيسي (mainItemCode - loaded from selected material)
    // 5. رقم الاعفاء (exemptionNumber - generated format 620/31/2/{exemption})
    // 6. نوع المعاملة (transactionType - fixed 2)
    // 7. المبلغ الاجمالي (totalAmount)
    // 8. تاريخ الفاتورة (invoiceDate)
    // 9. الرقم الضريبي (taxNumber - loaded from selected company)
    // 10. رقم الفاتورة (invoiceNumber)
    worksheet.columns = [
      { header: 'المبلغ الفرعي', key: 'subtotalAmount', width: 15 },
      { header: 'الكمية', key: 'quantity', width: 12 },
      { header: 'الصنف الفرعي', key: 'subItemCode', width: 15 },
      { header: 'الصنف الرئيسي', key: 'mainItemCode', width: 15 },
      { header: 'رقم الاعفاء', key: 'exemptionNumber', width: 25 },
      { header: 'نوع المعاملة', key: 'transactionType', width: 15 },
      { header: 'المبلغ الاجمالي', key: 'totalAmount', width: 15 },
      { header: 'تاريخ الفاتورة', key: 'invoiceDate', width: 15 },
      { header: 'الرقم الضريبي', key: 'taxNumber', width: 20 },
      { header: 'رقم الفاتورة', key: 'invoiceNumber', width: 15 }
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Arial', size: 11, bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add rows
    invoices.forEach((inv) => {
      // Clean values
      const subtotal = Number(inv.subtotalAmount) || 0;
      const qty = Number(inv.quantity) || 0;
      const total = Number(inv.totalAmount) || 0;

      // Exemption formatted: 620/31/2/{ExemptionNumber}
      const formattedExemption = `620/31/2/${inv.exemptionNumber.trim()}`;

      worksheet.addRow({
        subtotalAmount: subtotal,
        quantity: qty,
        subItemCode: 1, // Fixed value = 1
        mainItemCode: inv.mainItemCode.trim(),
        exemptionNumber: formattedExemption,
        transactionType: 2, // Fixed value = 2
        totalAmount: total,
        invoiceDate: inv.invoiceDate,
        taxNumber: inv.taxNumber.trim(),
        invoiceNumber: inv.invoiceNumber.trim()
      });
    });

    // Style cells
    worksheet.eachRow((row, rowNumber) => {
      // Make row height comfortable
      row.height = rowNumber === 1 ? 28 : 24;

      row.eachCell((cell) => {
        // Alignment
        cell.alignment = { vertical: 'middle', horizontal: 'center' };

        // Border styling
        if (rowNumber > 1) {
          cell.font = { name: 'Arial', size: 10 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'E2E8F0' } },
            left: { style: 'thin', color: { argb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
            right: { style: 'thin', color: { argb: 'E2E8F0' } }
          };

          // No alternating fill color to match original template
        }
      });
    });

    // Write file to response stream
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Tax_Exemption_Invoices.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('Error generating Excel export:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});
