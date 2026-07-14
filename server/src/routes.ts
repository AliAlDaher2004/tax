import { Router, Request, Response } from 'express';
import { supabase } from './db';
import ExcelJS from 'exceljs';
// Trigger restart for env token fix

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

// GET all invoices for a specific company (with optional associated PDF document)
router.get('/companies/:id/invoices', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        invoice_date,
        tax_number,
        main_item_code,
        exemption_number,
        quantity,
        subtotal_amount,
        total_amount,
        status,
        pdf_document_id,
        pdf_documents (
          id,
          filename
        ),
        materials (
          name_ar
        )
      `)
      .eq('company_id', id)
      .order('invoice_date', { ascending: false });

    if (error) throw error;

    const invoices = data.map((i: any) => ({
      id: i.id,
      invoiceNumber: i.invoice_number,
      invoiceDate: i.invoice_date,
      taxNumber: i.tax_number,
      mainItemCode: i.main_item_code,
      exemptionNumber: i.exemption_number,
      quantity: Number(i.quantity),
      subtotalAmount: Number(i.subtotal_amount),
      totalAmount: Number(i.total_amount),
      status: i.status,
      pdfDocument: i.pdf_documents ? {
        id: i.pdf_documents.id,
        filename: i.pdf_documents.filename
      } : null,
      materialName: i.materials ? i.materials.name_ar : 'غير معروف'
    }));

    return res.json(invoices);
  } catch (error: any) {
    console.error('Error fetching company invoices:', error);
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
    let invoices: any[] = [];
    let requestName = '';

    if (Array.isArray(req.body)) {
      invoices = req.body;
    } else if (req.body && Array.isArray(req.body.invoices)) {
      invoices = req.body.invoices;
      requestName = req.body.requestName;
    } else {
      return res.status(400).json({ error: 'Body must be an array of invoice records or an object containing invoices array.' });
    }

    if (invoices.length === 0) {
      return res.status(400).json({ error: 'No invoices to export.' });
    }

    // Try to save to database (Requests and Invoices tables)
    let newRequest: any = null;
    try {
      const defaultName = `طلب تصدير بتاريخ ${new Date().toISOString().split('T')[0]}`;
      const { data: reqData, error: reqError } = await supabase
        .from('requests')
        .insert([{ name: requestName || defaultName }])
        .select();

      if (reqError) {
        console.warn('Database save warning (requests table):', reqError.message);
      } else if (reqData && reqData.length > 0) {
        newRequest = reqData[0];

        const invoicesToInsert = invoices.map((inv) => ({
          request_id: newRequest.id,
          company_id: inv.companyId || null,
          material_id: inv.materialId || null,
          invoice_number: String(inv.invoiceNumber).trim(),
          invoice_date: inv.invoiceDate,
          tax_number: String(inv.taxNumber).trim(),
          main_item_code: String(inv.mainItemCode).trim(),
          exemption_number: String(inv.exemptionNumber).trim(),
          quantity: Number(inv.quantity) || 0,
          subtotal_amount: Number(inv.subtotalAmount) || 0,
          total_amount: Number(inv.totalAmount) || 0,
          status: 'pending'
        }));

        const { error: invInsertError } = await supabase
          .from('invoices')
          .insert(invoicesToInsert);

        if (invInsertError) {
          console.warn('Database save warning (invoices table):', invInsertError.message);
        }

        // Update previously returned ones to 'resubmitted' if they carry IDs
        const resubmittedIds = invoices
          .map((inv) => inv.id)
          .filter((id) => id && typeof id === 'string' && id.length > 30); // UUID check
        
        if (resubmittedIds.length > 0) {
          const { error: updateError } = await supabase
            .from('invoices')
            .update({ status: 'resubmitted' })
            .in('id', resubmittedIds);
          if (updateError) {
            console.warn('Database update warning (resubmitted invoices):', updateError.message);
          }
        }
      }
    } catch (dbErr: any) {
      console.warn('Failed to save request/invoices to database, proceeding with Excel generation:', dbErr.message);
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
      const formattedExemption = `620/31/2/${String(inv.exemptionNumber).trim()}`;

      worksheet.addRow({
        subtotalAmount: subtotal,
        quantity: qty,
        subItemCode: 1, // Fixed value = 1
        mainItemCode: String(inv.mainItemCode).trim(),
        exemptionNumber: formattedExemption,
        transactionType: 2, // Fixed value = 2
        totalAmount: total,
        invoiceDate: inv.invoiceDate,
        taxNumber: String(inv.taxNumber).trim(),
        invoiceNumber: String(inv.invoiceNumber).trim()
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
// 3.5. New Tax Tracking & Lifecycle Endpoints
// ==========================================

// GET all requests with their invoices
router.get('/requests', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        id,
        name,
        created_at,
        invoices (
          id,
          invoice_number,
          invoice_date,
          tax_number,
          main_item_code,
          exemption_number,
          quantity,
          subtotal_amount,
          total_amount,
          status,
          company_id,
          material_id,
          companies (name_ar)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format the response nicely
    const requests = data.map((r: any) => {
      const invoices = r.invoices || [];
      const pendingCount = invoices.filter((i: any) => i.status === 'pending').length;
      const readyCount = invoices.filter((i: any) => i.status === 'ready').length;
      const returnedCount = invoices.filter((i: any) => i.status === 'returned').length;
      const resubmittedCount = invoices.filter((i: any) => i.status === 'resubmitted').length;

      return {
        id: r.id,
        name: r.name,
        created_at: r.created_at,
        invoices: invoices.map((i: any) => ({
          id: i.id,
          invoiceNumber: i.invoice_number,
          invoiceDate: i.invoice_date,
          taxNumber: i.tax_number,
          mainItemCode: i.main_item_code,
          exemptionNumber: i.exemption_number,
          quantity: Number(i.quantity),
          subtotalAmount: Number(i.subtotal_amount),
          totalAmount: Number(i.total_amount),
          status: i.status,
          companyId: i.company_id,
          materialId: i.material_id,
          companyNameAr: i.companies ? i.companies.name_ar : 'غير معروف'
        })),
        stats: {
          total: invoices.length,
          pending: pendingCount,
          ready: readyCount,
          returned: returnedCount,
          resubmitted: resubmittedCount
        }
      };
    });

    return res.json(requests);
  } catch (error: any) {
    console.error('Error fetching requests:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// DELETE a request and all its invoices
router.delete('/requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Delete associated invoices
    const { error: invError } = await supabase
      .from('invoices')
      .delete()
      .eq('request_id', id);

    if (invError) throw invError;

    // 2. Delete the request itself
    const { error: reqError } = await supabase
      .from('requests')
      .delete()
      .eq('id', id);

    if (reqError) throw reqError;

    return res.json({
      success: true,
      message: 'تم حذف كشف الفواتير وكافة فواتيره بنجاح.'
    });
  } catch (error: any) {
    console.error('Error deleting request:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف الكشف.' });
  }
});

// GET returned invoices that are ready to be re-uploaded/resubmitted
router.get('/invoices/returned', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        invoice_date,
        tax_number,
        main_item_code,
        exemption_number,
        quantity,
        subtotal_amount,
        total_amount,
        company_id,
        material_id,
        companies (name_ar),
        materials (name_ar)
      `)
      .eq('status', 'returned');

    if (error) throw error;

    const formatted = data.map((i: any) => ({
      id: i.id,
      invoiceNumber: i.invoice_number,
      invoiceDate: i.invoice_date,
      taxNumber: i.tax_number,
      mainItemCode: i.main_item_code,
      exemptionNumber: i.exemption_number,
      quantity: Number(i.quantity),
      subtotalAmount: Number(i.subtotal_amount),
      totalAmount: Number(i.total_amount),
      companyId: i.company_id,
      materialId: i.material_id,
      companyNameAr: i.companies ? i.companies.name_ar : 'غير معروف',
      materialNameAr: i.materials ? i.materials.name_ar : 'غير معروف'
    }));

    return res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching returned invoices:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Helper function to save PDF to Supabase Storage (with database fallback)
async function savePdfFile(filename: string, base64Data: string): Promise<string> {
  const bucketName = 'pdf_responses';
  let fileDataToSave = base64Data;

  try {
    // Try to create bucket if not exists
    await supabase.storage.createBucket(bucketName, { public: false }).catch(() => {});

    // Convert base64 to buffer for upload
    const fileBuffer = Buffer.from(base64Data, 'base64');
    const fileUuid = Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    const storagePath = `${fileUuid}_${filename}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.warn('Supabase Storage upload failed, falling back to Database storage:', uploadError.message);
    } else {
      fileDataToSave = `storage:${bucketName}/${storagePath}`;
    }
  } catch (storageErr: any) {
    console.warn('Storage system error, falling back to Database storage:', storageErr.message);
  }

  const { data: pdfData, error: pdfError } = await supabase
    .from('pdf_documents')
    .insert([{ filename, file_data: fileDataToSave }])
    .select();

  if (pdfError) throw pdfError;
  return pdfData[0].id;
}

// POST Upload tax response PDF & Match Invoices
router.post('/pdf-documents/upload', async (req: Request, res: Response) => {
  try {
    const { filename, file_data, invoice_updates } = req.body;

    let pdfDocId: string | null = null;

    // 1. Save PDF doc if provided
    if (filename && file_data) {
      pdfDocId = await savePdfFile(filename, file_data);
    }

    // 2. Perform invoice updates
    if (Array.isArray(invoice_updates) && invoice_updates.length > 0) {
      for (const update of invoice_updates) {
        const { id, status } = update; // status can be 'ready' or 'returned'
        if (!id || !status) continue;

        // Link to PDF only if status is 'ready'
        const docIdToSave = status === 'ready' ? pdfDocId : null;

        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            status,
            pdf_document_id: docIdToSave
          })
          .eq('id', id);

        if (updateError) throw updateError;
      }
    }

    return res.status(201).json({
      success: true,
      message: 'تم تحديث حالات الفواتير بنجاح.',
      pdfId: pdfDocId
    });
  } catch (error: any) {
    console.error('Error uploading tax PDF:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// GET all uploaded PDFs
router.get('/pdf-documents', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('pdf_documents')
      .select('id, filename, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data);
  } catch (error: any) {
    console.error('Error fetching PDFs:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// GET single PDF download/base64 content
router.get('/pdf-documents/:id/download', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('pdf_documents')
      .select('id, filename, file_data')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'الملف غير موجود.' });

    // Handle Supabase Storage files
    if (data.file_data && data.file_data.startsWith('storage:')) {
      const pathParts = data.file_data.replace('storage:', '').split('/');
      const bucket = pathParts[0];
      const filePath = pathParts.slice(1).join('/');

      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(filePath);

      if (downloadError) {
        console.error('Error downloading from Supabase Storage:', downloadError.message);
        throw downloadError;
      }

      // Convert Blob to Base64 in Node.js
      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');

      return res.json({
        id: data.id,
        filename: data.filename,
        file_data: base64Data
      });
    }

    // Direct fallback (Backwards compatibility)
    return res.json(data);
  } catch (error: any) {
    console.error('Error downloading PDF:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST Export "Ready" Invoices of a Request grouped by supplier (separated pages/sheets)
router.post('/requests/:id/export-ready', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch ready invoices for this request
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        invoice_date,
        tax_number,
        main_item_code,
        exemption_number,
        quantity,
        subtotal_amount,
        total_amount,
        company_id,
        companies (name_ar)
      `)
      .eq('request_id', id)
      .eq('status', 'ready');

    if (error) throw error;
    if (!invoices || invoices.length === 0) {
      return res.status(400).json({ error: 'لا توجد فواتير جاهزة لتصديرها في هذا الطلب.' });
    }

    // Group invoices by company/supplier name
    const grouped: { [companyName: string]: any[] } = {};
    invoices.forEach((inv: any) => {
      const compName = inv.companies ? inv.companies.name_ar : 'مورد غير معروف';
      if (!grouped[compName]) {
        grouped[compName] = [];
      }
      grouped[compName].push(inv);
    });

    const workbook = new ExcelJS.Workbook();

    // Generate sheet for each group
    for (const [companyName, groupInvoices] of Object.entries(grouped)) {
      // Clean sheet name (Excel sheets can be max 31 chars and no special chars : \ / ? * [ ] etc.)
      const cleanSheetName = companyName
        .replace(/[:\\/?*\[\]]/g, '')
        .substring(0, 31) || 'ورقة';

      const worksheet = workbook.addWorksheet(cleanSheetName);
      worksheet.views = [{ showGridLines: true }];

      // Define columns
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

      // Style header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4F46E5' } // Sleek Indigo color for ready sheets
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 28;

      // Add rows
      groupInvoices.forEach((inv) => {
        const subtotal = Number(inv.subtotal_amount) || 0;
        const qty = Number(inv.quantity) || 0;
        const total = Number(inv.total_amount) || 0;
        const formattedExemption = `620/31/2/${inv.exemption_number.trim()}`;

        worksheet.addRow({
          subtotalAmount: subtotal,
          quantity: qty,
          subItemCode: 1,
          mainItemCode: inv.main_item_code.trim(),
          exemptionNumber: formattedExemption,
          transactionType: 2,
          totalAmount: total,
          invoiceDate: inv.invoice_date,
          taxNumber: inv.tax_number.trim(),
          invoiceNumber: inv.invoice_number.trim()
        });
      });

      // Style cells
      worksheet.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 28 : 24;
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (rowNumber > 1) {
            cell.font = { name: 'Arial', size: 10 };
            cell.border = {
              top: { style: 'thin', color: { argb: 'E2E8F0' } },
              left: { style: 'thin', color: { argb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
              right: { style: 'thin', color: { argb: 'E2E8F0' } }
            };
          }
        });
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Ready_Tax_Invoices.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('Error generating ready invoices Excel export:', error);
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

// PUT update a single invoice status
router.put('/invoices/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'ready', 'returned', 'resubmitted'].includes(status)) {
      return res.status(400).json({ error: 'حالة غير صالحة.' });
    }

    const { data, error } = await supabase
      .from('invoices')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) throw error;

    return res.json({
      success: true,
      message: 'تم تحديث حالة الفاتورة بنجاح.',
      invoice: data[0]
    });
  } catch (error: any) {
    console.error('Error updating invoice status:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// DELETE a single invoice
router.delete('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.json({ success: true, message: 'Invoice deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting invoice:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST create manual request with invoices and associated PDFs
router.post('/requests/manual', async (req: Request, res: Response) => {
  try {
    const { requestName, invoices } = req.body;
    if (!requestName || !Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ error: 'اسم الطلب وقائمة الفواتير مطلوبة.' });
    }

    // 1. Insert Request
    const { data: reqData, error: reqError } = await supabase
      .from('requests')
      .insert([{ name: requestName }])
      .select();

    if (reqError) throw reqError;
    const newRequest = reqData[0];

    // 2. Loop through each invoice and save it
    for (const inv of invoices) {
      let pdfId: string | null = null;

      // If this invoice has an associated PDF file, save it first
      if (inv.pdfFile && inv.pdfFile.filename && inv.pdfFile.base64) {
        try {
          pdfId = await savePdfFile(inv.pdfFile.filename, inv.pdfFile.base64);
        } catch (pdfError: any) {
          console.error('Error inserting PDF for manual invoice:', pdfError.message);
        }
      }

      // Insert the invoice
      const { error: invError } = await supabase
        .from('invoices')
        .insert([{
          request_id: newRequest.id,
          company_id: inv.companyId || null,
          material_id: inv.materialId || null,
          invoice_number: String(inv.invoiceNumber).trim(),
          invoice_date: inv.invoiceDate,
          tax_number: String(inv.taxNumber).trim(),
          main_item_code: String(inv.mainItemCode).trim(),
          exemption_number: String(inv.exemptionNumber).trim(),
          quantity: Number(inv.quantity) || 0,
          subtotal_amount: Number(inv.subtotalAmount) || 0,
          total_amount: Number(inv.totalAmount) || 0,
          status: inv.status || 'pending',
          pdf_document_id: pdfId
        }]);

      if (invError) throw invError;
    }

    return res.status(201).json({
      success: true,
      message: `تم حفظ الكشف اليدوي بنجاح! تم تسجيل ${invoices.length} فواتير في طلب جديد باسم "${newRequest.name}".`
    });
  } catch (error: any) {
    console.error('Error creating manual request:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST import requests of invoices from Excel
router.post('/requests/import', async (req: Request, res: Response) => {
  try {
    const { file, requestName, defaultStatus } = req.body;
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

    const invoicesToInsert: any[] = [];
    const errors: string[] = [];

    // Map column headers to index
    let headers: { [key: string]: number } = {};
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const val = getCellValueAsString(cell).trim();
      headers[val] = colNumber;
    });

    // Check minimum required headers
    const required = ['رقم الفاتورة', 'تاريخ الفاتورة', 'الرقم الضريبي', 'الصنف الرئيسي', 'رقم الاعفاء', 'الكمية', 'المبلغ الفرعي', 'المبلغ الاجمالي'];
    const missing = required.filter(h => !headers[h] && !headers[h.replace('الاعفاء', 'الإعفاء')]); // handle both spellings
    if (missing.length > 0) {
      return res.status(400).json({
        error: `تنسيق الأعمدة غير صحيح. الأعمدة المفقودة: ${missing.join(', ')}`
      });
    }

    const getColVal = (row: ExcelJS.Row, name: string): string => {
      const index = headers[name] || headers[name.replace('الاعفاء', 'الإعفاء')];
      if (!index) return '';
      return getCellValueAsString(row.getCell(index));
    };

    // Load all companies and materials for matching in memory
    const { data: companies } = await supabase.from('companies').select('id, tax_number');
    const { data: exemptions } = await supabase.from('material_exemptions').select('material_id, exemption_number, main_item_code');

    const companyMap = new Map<string, string>(); // tax_number -> id
    companies?.forEach(c => companyMap.set(c.tax_number.trim(), c.id));

    const exemptionMap = new Map<string, string>(); // exemption_number_main_item_code -> material_id
    exemptions?.forEach(e => {
      const key = `${e.exemption_number.trim()}_${e.main_item_code.trim()}`;
      exemptionMap.set(key, e.material_id);
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const invoiceNumber = getColVal(row, 'رقم الفاتورة');
      const invoiceDateRaw = getColVal(row, 'تاريخ الفاتورة');
      const taxNumber = getColVal(row, 'الرقم الضريبي');
      const mainItemCode = getColVal(row, 'الصنف الرئيسي');
      const exemptionNumberRaw = getColVal(row, 'رقم الاعفاء');
      const quantityRaw = getColVal(row, 'الكمية');
      const subtotalRaw = getColVal(row, 'المبلغ الفرعي');
      const totalRaw = getColVal(row, 'المبلغ الاجمالي');
      const statusRaw = getColVal(row, 'الحالة');

      // Skip row if empty
      if (!invoiceNumber && !taxNumber && !totalRaw) return;

      if (!invoiceNumber || !invoiceDateRaw || !taxNumber || !mainItemCode || !exemptionNumberRaw) {
        errors.push(`السطر ${rowNumber}: بيانات أساسية مفقودة (رقم الفاتورة، التاريخ، الرقم الضريبي، كود الصنف، ورقم الإعفاء).`);
        return;
      }

      // Format exemption number (strip 620/31/2/ prefix if present)
      let exemptionNumber = exemptionNumberRaw.trim();
      if (exemptionNumber.startsWith('620/31/2/')) {
        exemptionNumber = exemptionNumber.replace('620/31/2/', '');
      }

      // Parse date
      let invoiceDate = invoiceDateRaw;
      if (invoiceDateRaw.includes('T')) {
        invoiceDate = invoiceDateRaw.split('T')[0];
      }

      // Match company and material
      const companyId = companyMap.get(taxNumber.trim()) || null;
      const key = `${exemptionNumber.trim()}_${mainItemCode.trim()}`;
      const materialId = exemptionMap.get(key) || null;

      // Determine status
      let status = defaultStatus || 'pending';
      if (statusRaw) {
        const sTrim = statusRaw.trim();
        if (sTrim.includes('جاهز') || sTrim.includes('معتمد') || sTrim.includes('ready')) {
          status = 'ready';
        } else if (sTrim.includes('مسترجع') || sTrim.includes('مرفوض') || sTrim.includes('returned')) {
          status = 'returned';
        } else if (sTrim.includes('معلق') || sTrim.includes('انتظار') || sTrim.includes('pending')) {
          status = 'pending';
        }
      }

      invoicesToInsert.push({
        company_id: companyId,
        material_id: materialId,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        tax_number: taxNumber.trim(),
        main_item_code: mainItemCode.trim(),
        exemption_number: exemptionNumber.trim(),
        quantity: Number(quantityRaw) || 0,
        subtotal_amount: Number(subtotalRaw) || 0,
        total_amount: Number(totalRaw) || 0,
        status
      });
    });

    if (errors.length > 0 && invoicesToInsert.length === 0) {
      return res.status(400).json({ error: errors.join('\n') });
    }

    if (invoicesToInsert.length === 0) {
      return res.status(400).json({ error: 'لم يتم العثور على أي بيانات صالحة للاستيراد.' });
    }

    // Insert Request
    const defaultName = `طلب مستورد بتاريخ ${new Date().toISOString().split('T')[0]}`;
    const { data: reqData, error: reqError } = await supabase
      .from('requests')
      .insert([{ name: requestName || defaultName }])
      .select();

    if (reqError) throw reqError;
    const newRequest = reqData[0];

    // Link invoices to request
    const linkedInvoices = invoicesToInsert.map(inv => ({
      ...inv,
      request_id: newRequest.id
    }));

    const { error: invInsertError } = await supabase
      .from('invoices')
      .insert(linkedInvoices);

    if (invInsertError) throw invInsertError;

    return res.json({
      success: true,
      message: `تم استيراد الكشف بنجاح! تم حفظ ${invoicesToInsert.length} فواتير في طلب جديد باسم "${newRequest.name}".`,
      warnings: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error importing invoices request:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ أثناء استيراد البيانات.' });
  }
});

