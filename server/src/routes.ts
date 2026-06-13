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
      .select(`
        id,
        name_ar,
        created_at,
        exemptions:material_exemptions(id, exemption_number, main_item_code),
        company_materials(company_id)
      `)
      .order('name_ar', { ascending: true });

    if (error) throw error;

    const materials = data.map((item: any) => ({
      id: item.id,
      name_ar: item.name_ar,
      created_at: item.created_at,
      exemptions: item.exemptions || [],
      company_ids: item.company_materials ? item.company_materials.map((cm: any) => cm.company_id) : []
    }));

    return res.json(materials);
  } catch (error: any) {
    console.error('Error fetching materials:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST create material
router.post('/materials', async (req: Request, res: Response) => {
  try {
    const { name_ar, exemptions, company_ids } = req.body;
    if (!name_ar) {
      return res.status(400).json({ error: 'اسم المادة مطلوب.' });
    }

    // 1. Insert material
    const { data: matData, error: matError } = await supabase
      .from('materials')
      .insert([{ name_ar }])
      .select();

    if (matError) throw matError;
    const material = matData[0];
    const materialId = material.id;

    // 2. Insert exemptions
    if (exemptions && exemptions.length > 0) {
      const exemptionRecords = exemptions.map((e: any) => ({
        material_id: materialId,
        exemption_number: String(e.exemption_number).trim(),
        main_item_code: String(e.main_item_code).trim()
      }));
      const { error: excError } = await supabase
        .from('material_exemptions')
        .insert(exemptionRecords);
      if (excError) throw excError;
    }

    // 3. Insert company links
    if (company_ids && company_ids.length > 0) {
      const linkRecords = company_ids.map((cid: string) => ({
        material_id: materialId,
        company_id: cid
      }));
      const { error: linkError } = await supabase
        .from('company_materials')
        .insert(linkRecords);
      if (linkError) throw linkError;
    }

    // Fetch the newly created complete material to return
    const { data: finalData, error: finalError } = await supabase
      .from('materials')
      .select(`
        id,
        name_ar,
        created_at,
        exemptions:material_exemptions(id, exemption_number, main_item_code),
        company_materials(company_id)
      `)
      .eq('id', materialId)
      .single();

    if (finalError) throw finalError;

    const formattedMaterial = {
      id: finalData.id,
      name_ar: finalData.name_ar,
      created_at: finalData.created_at,
      exemptions: finalData.exemptions || [],
      company_ids: finalData.company_materials ? finalData.company_materials.map((cm: any) => cm.company_id) : []
    };

    return res.status(201).json(formattedMaterial);
  } catch (error: any) {
    console.error('Error creating material:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// PUT update material
router.put('/materials/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name_ar, exemptions, company_ids } = req.body;

    if (!name_ar) {
      return res.status(400).json({ error: 'اسم المادة مطلوب.' });
    }

    // 1. Update material name
    const { data: matData, error: matError } = await supabase
      .from('materials')
      .update({ name_ar })
      .eq('id', id)
      .select();

    if (matError) throw matError;
    if (!matData || matData.length === 0) {
      return res.status(404).json({ error: 'المادة غير موجودة.' });
    }

    // 2. Update exemptions (Delete all and re-insert)
    const { error: delExError } = await supabase
      .from('material_exemptions')
      .delete()
      .eq('material_id', id);
    if (delExError) throw delExError;

    if (exemptions && exemptions.length > 0) {
      const exemptionRecords = exemptions.map((e: any) => ({
        material_id: id,
        exemption_number: String(e.exemption_number).trim(),
        main_item_code: String(e.main_item_code).trim()
      }));
      const { error: excError } = await supabase
        .from('material_exemptions')
        .insert(exemptionRecords);
      if (excError) throw excError;
    }

    // 3. Update company links (Delete all and re-insert)
    const { error: delLinkError } = await supabase
      .from('company_materials')
      .delete()
      .eq('material_id', id);
    if (delLinkError) throw delLinkError;

    if (company_ids && company_ids.length > 0) {
      const linkRecords = company_ids.map((cid: string) => ({
        material_id: id,
        company_id: cid
      }));
      const { error: linkError } = await supabase
        .from('company_materials')
        .insert(linkRecords);
      if (linkError) throw linkError;
    }

    // Fetch final updated material
    const { data: finalData, error: finalError } = await supabase
      .from('materials')
      .select(`
        id,
        name_ar,
        created_at,
        exemptions:material_exemptions(id, exemption_number, main_item_code),
        company_materials(company_id)
      `)
      .eq('id', id)
      .single();

    if (finalError) throw finalError;

    const formattedMaterial = {
      id: finalData.id,
      name_ar: finalData.name_ar,
      created_at: finalData.created_at,
      exemptions: finalData.exemptions || [],
      company_ids: finalData.company_materials ? finalData.company_materials.map((cm: any) => cm.company_id) : []
    };

    return res.json(formattedMaterial);
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

// ==========================================
// 4. Excel Template & Import Endpoints
// ==========================================

// GET companies import template
router.get('/companies/template', async (req: Request, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('قالب الشركات');
    worksheet.views = [{ showGridLines: true }];

    worksheet.columns = [
      { header: 'اسم الشركة', key: 'name_ar', width: 30 },
      { header: 'الرقم الضريبي', key: 'tax_number', width: 25 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '3B82F6' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } }
      };
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=companies_template.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('Error generating companies template:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// GET materials import template
router.get('/materials/template', async (req: Request, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('قالب الأصناف');
    worksheet.views = [{ showGridLines: true }];

    worksheet.columns = [
      { header: 'اسم المادة', key: 'name_ar', width: 30 },
      { header: 'رقم الإعفاء', key: 'exemption_number', width: 25 },
      { header: 'رمز البند الرئيسي', key: 'main_item_code', width: 25 },
      { header: 'اسم الشركة الموردة (اختياري)', key: 'company_name', width: 35 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '10B981' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } }
      };
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=materials_template.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('Error generating materials template:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Helper function to extract cell value cleanly as trimmed string
const getCellValueAsString = (cell: ExcelJS.Cell): string => {
  if (cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if ('richText' in cell.value && Array.isArray(cell.value.richText)) {
      return cell.value.richText.map((t: any) => t.text).join('').trim();
    }
    if ('result' in cell.value) {
      return String(cell.value.result).trim();
    }
    if ('text' in cell.value) {
      return String(cell.value.text).trim();
    }
    return JSON.stringify(cell.value).trim();
  }
  return String(cell.value).trim();
};

// POST import companies from Excel
router.post('/companies/import', async (req: Request, res: Response) => {
  try {
    const { file } = req.body;
    if (!file) {
      return res.status(400).json({ error: 'ملف Excel مطلوب بصيغة Base64.' });
    }

    const buffer = Buffer.from(file, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: 'ملف Excel فارغ أو لا يحتوي على أوراق عمل.' });
    }

    const companiesToUpsert: { name_ar: string; tax_number: string }[] = [];
    const errors: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      // Validate headers
      if (rowNumber === 1) {
        const col1 = getCellValueAsString(row.getCell(1));
        const col2 = getCellValueAsString(row.getCell(2));
        if (col1 !== 'اسم الشركة' || col2 !== 'الرقم الضريبي') {
          errors.push('تنسيق الأعمدة غير صحيح. يجب أن تكون الأعمدة: اسم الشركة، الرقم الضريبي.');
        }
        return;
      }

      const name_ar = getCellValueAsString(row.getCell(1));
      const tax_number = getCellValueAsString(row.getCell(2));

      // Skip row if completely empty
      if (!name_ar && !tax_number) return;

      if (!name_ar || !tax_number) {
        errors.push(`السطر ${rowNumber}: اسم الشركة والرقم الضريبي مطلوبان.`);
        return;
      }

      companiesToUpsert.push({ name_ar, tax_number });
    });

    if (errors.length > 0 && companiesToUpsert.length === 0) {
      return res.status(400).json({ error: errors.join('\n') });
    }

    if (companiesToUpsert.length === 0) {
      return res.status(400).json({ error: 'لم يتم العثور على أي بيانات صالحة للاستيراد.' });
    }

    // Upsert into database based on name_ar conflict column
    const { error: upsertError } = await supabase
      .from('companies')
      .upsert(companiesToUpsert, { onConflict: 'name_ar' });

    if (upsertError) throw upsertError;

    return res.json({
      success: true,
      message: `تم استيراد/تحديث ${companiesToUpsert.length} منشأة بنجاح.`,
      warnings: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error importing companies:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ أثناء استيراد البيانات.' });
  }
});

// POST import materials from Excel
router.post('/materials/import', async (req: Request, res: Response) => {
  try {
    const { file } = req.body;
    if (!file) {
      return res.status(400).json({ error: 'ملف Excel مطلوب بصيغة Base64.' });
    }

    const buffer = Buffer.from(file, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: 'ملف Excel فارغ أو لا يحتوي على أوراق عمل.' });
    }

    const parsedRows: { name_ar: string; exemption_number: string; main_item_code: string; company_name: string; rowNumber: number }[] = [];
    const errors: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      // Validate headers
      if (rowNumber === 1) {
        const col1 = getCellValueAsString(row.getCell(1));
        const col2 = getCellValueAsString(row.getCell(2));
        const col3 = getCellValueAsString(row.getCell(3));
        if (!col1.includes('اسم المادة') || !col2.includes('رقم الإعفاء') || !col3.includes('رمز البند الرئيسي')) {
          errors.push('تنسيق الأعمدة غير صحيح. يجب أن تكون الأعمدة الثلاثة الأولى: اسم المادة، رقم الإعفاء، رمز البند الرئيسي.');
        }
        return;
      }

      const name_ar = getCellValueAsString(row.getCell(1));
      const exemption_number_raw = getCellValueAsString(row.getCell(2));
      const main_item_code_raw = getCellValueAsString(row.getCell(3));
      const company_name = getCellValueAsString(row.getCell(4));

      // Skip row if completely empty
      if (!name_ar && !exemption_number_raw && !main_item_code_raw && !company_name) return;

      if (!name_ar || !exemption_number_raw || !main_item_code_raw) {
        errors.push(`السطر ${rowNumber}: اسم المادة، رقم الإعفاء، ورمز البند الرئيسي مطلوبة.`);
        return;
      }

      // Split values by separators (comma, Arabic comma, semicolon, slash)
      const splitRegex = /[\s,،;\/]+/;
      const exemptionList = exemption_number_raw.split(splitRegex).map(s => s.trim()).filter(Boolean);
      const codeList = main_item_code_raw.split(splitRegex).map(s => s.trim()).filter(Boolean);

      const maxLen = Math.max(exemptionList.length, codeList.length);
      for (let i = 0; i < maxLen; i++) {
        const exNum = exemptionList[i] || exemptionList[0] || '';
        const itemCode = codeList[i] || codeList[0] || '';
        if (exNum && itemCode) {
          parsedRows.push({
            name_ar,
            exemption_number: exNum,
            main_item_code: itemCode,
            company_name,
            rowNumber
          });
        }
      }
    });

    if (errors.length > 0 && parsedRows.length === 0) {
      return res.status(400).json({ error: errors.join('\n') });
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({ error: 'لم يتم العثور على أي بيانات صالحة للاستيراد.' });
    }

    const uniqueMaterialNames = Array.from(new Set(parsedRows.map(r => r.name_ar)));
    let importedCount = 0;
    const warningMsgs: string[] = [];

    // Process each material group
    for (const matName of uniqueMaterialNames) {
      const matRows = parsedRows.filter(r => r.name_ar === matName);

      // 1. Get or create material
      let { data: existingMat, error: getError } = await supabase
        .from('materials')
        .select('id')
        .eq('name_ar', matName)
        .maybeSingle();

      if (getError) throw getError;

      let materialId = existingMat?.id;

      if (!materialId) {
        const { data: newMat, error: insertError } = await supabase
          .from('materials')
          .insert([{ name_ar: matName }])
          .select('id')
          .single();

        if (insertError) throw insertError;
        materialId = newMat.id;
      }

      // 2. Collect and insert unique exemptions for this material
      const exemptionsMap = new Map<string, { exemption_number: string; main_item_code: string }>();
      matRows.forEach(r => {
        const key = `${r.exemption_number.trim()}_${r.main_item_code.trim()}`;
        exemptionsMap.set(key, { exemption_number: r.exemption_number.trim(), main_item_code: r.main_item_code.trim() });
      });

      const exemptionRecords = Array.from(exemptionsMap.values()).map(e => ({
        material_id: materialId,
        exemption_number: e.exemption_number,
        main_item_code: e.main_item_code
      }));

      const { error: upsertExemptionError } = await supabase
        .from('material_exemptions')
        .upsert(exemptionRecords, { onConflict: 'material_id,exemption_number,main_item_code' });

      if (upsertExemptionError) throw upsertExemptionError;

      // 3. Collect and link companies
      const uniqueCompanyNames = Array.from(new Set(matRows.map(r => r.company_name).filter(name => name.length > 0)));
      
      for (const compName of uniqueCompanyNames) {
        const { data: company, error: compError } = await supabase
          .from('companies')
          .select('id')
          .eq('name_ar', compName)
          .maybeSingle();

        if (compError) throw compError;

        if (company) {
          const { error: upsertLinkError } = await supabase
            .from('company_materials')
            .upsert({ company_id: company.id, material_id: materialId }, { onConflict: 'company_id,material_id' });
          
          if (upsertLinkError) throw upsertLinkError;
        } else {
          warningMsgs.push(`الشركة "${compName}" غير مسجلة في النظام. تم استيراد الصنف دون ربطه بهذه الشركة.`);
        }
      }

      importedCount++;
    }

    const combinedWarnings = [...errors, ...warningMsgs];

    return res.json({
      success: true,
      message: `تم استيراد/تحديث ${importedCount} صنف بنجاح.`,
      warnings: combinedWarnings.length > 0 ? combinedWarnings : undefined
    });
  } catch (error: any) {
    console.error('Error importing materials:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ أثناء استيراد البيانات.' });
  }
});

