import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  X,
  Trash2
} from 'lucide-react';
import {
  getRequests,
  getPdfDocuments,
  downloadPdfDocument,
  uploadPdfDocument,
  exportReadyInvoices,
  getCompanies,
  getMaterials,
  createManualRequest,
  importInvoicesRequest,
  deleteRequest,
  deleteInvoice
} from '../api';
import type { TaxRequest, Invoice, PdfDocument } from '../api';

interface RequestsScreenProps {
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const RequestsScreen: React.FC<RequestsScreenProps> = ({ showToast }) => {
  const [requests, setRequests] = useState<TaxRequest[]>([]);
  const [pdfs, setPdfs] = useState<PdfDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // PDF Upload & Match States
  const [selectedReqForUpload, setSelectedReqForUpload] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<{ filename: string; base64: string } | null>(null);
  const [invoiceUpdates, setInvoiceUpdates] = useState<{ [id: string]: { selected: boolean; status: 'ready' | 'returned' } }>({});
  const [submittingPdf, setSubmittingPdf] = useState<boolean>(false);

  // Master data lists for manual insert dropdowns
  const [companies, setCompanies] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);

  // Invoices Manual/Excel Request States
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false); 
  const [importRequestName, setImportRequestName] = useState<string>(''); 
  const [manualInvoices, setManualInvoices] = useState<any[]>([]);
  const [importingInvoices, setImportingInvoices] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'excel' | 'manual'>('excel');
  const [excelFile, setExcelFile] = useState<{ filename: string; base64: string } | null>(null);
  const [importDefaultStatus, setImportDefaultStatus] = useState<'pending' | 'ready'>('pending');

  // Handle Excel Import File Change
  const handleExcelImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      showToast('يرجى اختيار ملف Excel بصيغة .xlsx فقط', 'warning');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const base64Data = base64.split(',')[1];
      setExcelFile({ filename: file.name, base64: base64Data });
      
      const cleanName = file.name.substring(0, file.name.lastIndexOf('.'));
      setImportRequestName(`كشف مستورد - ${cleanName}`);
    };
    reader.readAsDataURL(file);
  };

  const handleExcelImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) {
      showToast('يرجى اختيار ملف Excel للاستيراد', 'warning');
      return;
    }

    setImportingInvoices(true);
    try {
      const res = await importInvoicesRequest(excelFile.base64, importRequestName.trim(), importDefaultStatus);
      showToast(res.message, 'success');
      
      // Reset & Close
      setIsImportModalOpen(false);
      setExcelFile(null);
      setImportRequestName('');
      
      // Reload requests
      await loadData();
    } catch (err: any) {
      showToast('حدث خطأ أثناء الاستيراد: ' + err.message, 'error');
    } finally {
      setImportingInvoices(false);
    }
  };

  // Current Invoice Form Inputs (for manual entry inside the modal)
  const [formCompanyId, setFormCompanyId] = useState<string>('');
  const [formMaterialId, setFormMaterialId] = useState<string>('');
  const [formExemptionKey, setFormExemptionKey] = useState<string>('');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState<string>('');
  const [formInvoiceDate, setFormInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formQuantity, setFormQuantity] = useState<string>('');
  const [formSubtotal, setFormSubtotal] = useState<string>('');
  const [formTotal, setFormTotal] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'pending' | 'ready'>('ready');
  const [formPdfFile, setFormPdfFile] = useState<{ filename: string; base64: string } | null>(null);

  // Auto-filled values for form
  const [formTaxNumber, setFormTaxNumber] = useState<string>('');
  const [formExemptionNumber, setFormExemptionNumber] = useState<string>('');
  const [formMainItemCode, setFormMainItemCode] = useState<string>('');

  // Triggered when selected company changes
  useEffect(() => {
    if (formCompanyId) {
      const comp = companies.find((c) => c.id === formCompanyId);
      if (comp) {
        setFormTaxNumber(comp.tax_number);
      }
      
      if (formMaterialId) {
        const mat = materials.find(m => m.id === formMaterialId);
        if (mat && (!mat.company_ids || !mat.company_ids.includes(formCompanyId))) {
          setFormMaterialId('');
        }
      }
    } else {
      setFormTaxNumber('');
      setFormMaterialId('');
    }
  }, [formCompanyId, companies]);

  // Triggered when selected material changes
  useEffect(() => {
    if (formMaterialId) {
      const mat = materials.find((m) => m.id === formMaterialId);
      if (mat) {
        if (mat.exemptions && mat.exemptions.length === 1) {
          setFormExemptionNumber(mat.exemptions[0].exemption_number);
          setFormMainItemCode(mat.exemptions[0].main_item_code);
          setFormExemptionKey(`${mat.exemptions[0].exemption_number}_${mat.exemptions[0].main_item_code}`);
        } else {
          const isValid = mat.exemptions && mat.exemptions.some((e: any) => `${e.exemption_number}_${e.main_item_code}` === formExemptionKey);
          if (!isValid) {
            setFormExemptionNumber('');
            setFormMainItemCode('');
            setFormExemptionKey('');
          }
        }
      }
    } else {
      setFormExemptionNumber('');
      setFormMainItemCode('');
      setFormExemptionKey('');
    }
  }, [formMaterialId, materials]);

  // Triggered when selected exemption changes
  useEffect(() => {
    if (formMaterialId && formExemptionKey) {
      const mat = materials.find((m) => m.id === formMaterialId);
      if (mat && mat.exemptions) {
        const [exNum, itemCode] = formExemptionKey.split('_');
        const ex = mat.exemptions.find((e: any) => e.exemption_number === exNum && e.main_item_code === itemCode);
        if (ex) {
          setFormExemptionNumber(ex.exemption_number);
          setFormMainItemCode(ex.main_item_code);
        }
      }
    }
  }, [formExemptionKey, formMaterialId, materials]);

  // Handle PDF upload inside the invoice input
  const handleInvoicePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showToast('يرجى اختيار ملف PDF صالح فقط للفاتورة', 'warning');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const base64Data = base64.split(',')[1];
      setFormPdfFile({ filename: file.name, base64: base64Data });
    };
    reader.readAsDataURL(file);
  };

  // Add invoice to draft list
  const handleAddManualInvoice = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCompanyId) {
      showToast('يرجى اختيار المورد أولاً', 'warning');
      return;
    }
    if (!formMaterialId) {
      showToast('يرجى اختيار الصنف أولاً', 'warning');
      return;
    }
    if (!formExemptionNumber) {
      showToast('يرجى تحديد رقم الإعفاء', 'warning');
      return;
    }
    if (!formInvoiceNumber.trim()) {
      showToast('يرجى إدخال رقم الفاتورة', 'warning');
      return;
    }
    if (!formQuantity || Number(formQuantity) <= 0) {
      showToast('يرجى إدخال كمية صحيحة', 'warning');
      return;
    }
    if (!formSubtotal || Number(formSubtotal) < 0) {
      showToast('يرجى إدخال المبلغ الفرعي', 'warning');
      return;
    }
    if (!formTotal || Number(formTotal) < 0) {
      showToast('يرجى إدخال المبلغ الإجمالي', 'warning');
      return;
    }

    const comp = companies.find(c => c.id === formCompanyId)!;
    const mat = materials.find(m => m.id === formMaterialId)!;

    const newInv = {
      id: Math.random().toString(36).substring(2, 9),
      companyId: formCompanyId,
      materialId: formMaterialId,
      companyNameAr: comp.name_ar,
      materialNameAr: mat.name_ar,
      invoiceNumber: formInvoiceNumber.trim(),
      invoiceDate: formInvoiceDate,
      taxNumber: formFormulateTaxNumber(formTaxNumber),
      mainItemCode: formMainItemCode.trim(),
      exemptionNumber: formExemptionNumber.trim(),
      quantity: Number(formQuantity),
      subtotalAmount: Number(formSubtotal),
      totalAmount: Number(formTotal),
      status: formStatus,
      pdfFile: formPdfFile
    };

    setManualInvoices([...manualInvoices, newInv]);
    showToast('تمت إضافة الفاتورة إلى مسودة الكشف الحالي', 'success');

    // Reset single invoice fields (keep company and date for ease of consecutive entry)
    setFormInvoiceNumber('');
    setFormQuantity('');
    setFormSubtotal('');
    setFormTotal('');
    setFormPdfFile(null);
    setFormMaterialId('');
    setFormExemptionKey('');
  };

  // Helper helper to format tax numbers cleanly
  const formFormulateTaxNumber = (num: string): string => {
    return num ? String(num).trim() : '';
  };

  // Remove invoice from draft list
  const handleRemoveManualInvoice = (id: string) => {
    setManualInvoices(manualInvoices.filter(i => i.id !== id));
  };

  // Save manual request to backend
  const handleManualRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!importRequestName.trim()) {
      showToast('يرجى إدخال اسم الكشف الإجمالي', 'warning');
      return;
    }
    if (manualInvoices.length === 0) {
      showToast('يرجى إضافة فاتورة واحدة على الأقل للكشف قبل الحفظ', 'warning');
      return;
    }

    setImportingInvoices(true);
    try {
      await createManualRequest(importRequestName.trim(), manualInvoices);
      showToast('تم حفظ الكشف اليدوي وكافة فواتيره وملفاتها بنجاح!', 'success');
      
      // Close & Reset
      setIsImportModalOpen(false);
      setImportRequestName('');
      setManualInvoices([]);
      
      // Reload
      await loadData();
    } catch (err: any) {
      showToast('فشل حفظ الكشف: ' + err.message, 'error');
    } finally {
      setImportingInvoices(false);
    }
  };



  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqsList, pdfsList, compsList, matsList] = await Promise.all([
        getRequests(),
        getPdfDocuments(),
        getCompanies(),
        getMaterials()
      ]);
      setRequests(reqsList);
      setPdfs(pdfsList);
      setCompanies(compsList);
      setMaterials(matsList);
    } catch (err: any) {
      showToast('خطأ في تحميل البيانات: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Find the selected request to extract its pending invoices
  const activeUploadRequest = requests.find((r) => r.id === selectedReqForUpload);
  const pendingInvoicesOfSelectedRequest = activeUploadRequest
    ? activeUploadRequest.invoices.filter((inv) => inv.status === 'pending')
    : [];

  // Handle PDF file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showToast('يرجى اختيار ملف PDF صالح فقط', 'warning');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const base64Data = base64.split(',')[1];
      setPdfFile({ filename: file.name, base64: base64Data });
      
      // Reset selections when new file is chosen
      setInvoiceUpdates({});
    };
    reader.readAsDataURL(file);
  };

  // Handle invoice toggle checkbox
  const handleInvoiceToggle = (id: string, checked: boolean) => {
    setInvoiceUpdates((prev) => ({
      ...prev,
      [id]: {
        selected: checked,
        status: prev[id]?.status || 'ready' // default to ready if checked
      }
    }));
  };

  // Handle invoice status change ('ready' or 'returned')
  const handleInvoiceStatusChange = (id: string, status: 'ready' | 'returned') => {
    setInvoiceUpdates((prev) => ({
      ...prev,
      [id]: {
        selected: prev[id]?.selected ?? true, // automatically select if they change status
        status
      }
    }));
  };

  // Handle PDF Upload submission
  const handlePdfUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqForUpload) {
      showToast('يرجى تحديد طلب الإعفاء المطابق للملف المرفوع', 'warning');
      return;
    }

    const updates = Object.entries(invoiceUpdates)
      .filter(([_, value]) => value.selected)
      .map(([id, value]) => ({ id, status: value.status }));

    if (updates.length === 0) {
      showToast('يرجى تحديد فاتورة واحدة على الأقل من القائمة لتحديث حالتها', 'warning');
      return;
    }

    // Check if at least one invoice is marked as 'ready'
    const hasReadyInvoices = updates.some(upd => upd.status === 'ready');
    if (hasReadyInvoices && !pdfFile) {
      showToast('يرجى اختيار ملف الـ PDF الضريبي لإرفاقه بالفواتير الجاهزة', 'warning');
      return;
    }

    setSubmittingPdf(true);
    try {
      await uploadPdfDocument(
        pdfFile ? pdfFile.filename : null,
        pdfFile ? pdfFile.base64 : null,
        updates
      );
      showToast('تم تحديث حالات الفواتير وحفظ التعديلات بنجاح', 'success');
      
      // Reset upload fields
      setPdfFile(null);
      setSelectedReqForUpload('');
      setInvoiceUpdates({});
      
      // Reload page data
      await loadData();
    } catch (err: any) {
      showToast('خطأ أثناء حفظ المستند والتحديث: ' + err.message, 'error');
    } finally {
      setSubmittingPdf(false);
    }
  };

  // Export Ready Invoices only
  const handleExportReady = async (requestId: string, requestName: string) => {
    try {
      showToast('جاري تصدير الفواتير المعتمدة (الجاهزة) فقط لملف الإكسل...', 'info');
      await exportReadyInvoices(requestId, requestName);
      showToast('تم التصدير بنجاح! فواتير كل مورد محفوظة في صفحة مستقلة', 'success');
    } catch (err: any) {
      showToast('فشل تصدير الفواتير الجاهزة: ' + err.message, 'error');
    }
  };

  // Delete Request and all associated invoices
  const handleDeleteRequest = async (requestId: string, requestName: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف الكشف "${requestName}" بالكامل؟ سيؤدي هذا إلى حذف جميع الفواتير المرتبطة به أيضاً ولا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    try {
      showToast('جاري حذف الكشف...', 'info');
      await deleteRequest(requestId);
      showToast('تم حذف الكشف وكافة فواتيره بنجاح!', 'success');
      await loadData();
    } catch (err: any) {
      showToast('فشل حذف الكشف: ' + err.message, 'error');
    }
  };

  // Delete a single invoice manually
  const handleDeleteInvoice = async (invoiceId: string, invoiceNumber: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف الفاتورة رقم "${invoiceNumber}" يدويًا؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    try {
      showToast('جاري حذف الفاتورة...', 'info');
      await deleteInvoice(invoiceId);
      showToast('تم حذف الفاتورة بنجاح!', 'success');
      await loadData();
    } catch (err: any) {
      showToast('فشل حذف الفاتورة: ' + err.message, 'error');
    }
  };

  // Handle downloading/viewing a past PDF
  const handleDownloadPdf = async (pdfId: string, filename: string) => {
    try {
      showToast('جاري تحميل مستند الـ PDF من السيرفر...', 'info');
      await downloadPdfDocument(pdfId, filename);
    } catch (err: any) {
      showToast('فشل تحميل الملف: ' + err.message, 'error');
    }
  };

  // Translate invoice status to Arabic badge
  const renderStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="badge warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={12} />
            <span>قيد الانتظار</span>
          </span>
        );
      case 'ready':
        return (
          <span className="badge success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle size={12} />
            <span>جاهزة / معتمدة</span>
          </span>
        );
      case 'returned':
        return (
          <span className="badge danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <XCircle size={12} />
            <span>مسترجعة / مرفوضة</span>
          </span>
        );
      case 'resubmitted':
        return (
          <span className="badge info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#E0E7FF', color: '#4338CA' }}>
            <ArrowRightLeft size={12} />
            <span>أعيد تقديمها</span>
          </span>
        );
      default:
        return <span className="badge">{status}</span>;
    }
  };

  // Group invoices by supplier name (for matches display)
  const groupInvoicesBySupplier = (invoicesList: Invoice[]) => {
    const groups: { [supplierName: string]: Invoice[] } = {};
    invoicesList.forEach((inv) => {
      const name = inv.companyNameAr || 'مورد غير معروف';
      if (!groups[name]) groups[name] = [];
      groups[name].push(inv);
    });
    return groups;
  };

  return (
    <div className="requests-layout">
      {/* Sidebar: Upload & Archive */}
      <aside className="admin-sidebar" style={{ gap: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        
        {/* PDF Upload Card */}
        <div className="card" style={{ margin: 0, width: '100%' }}>
          <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 800 }}>
            <UploadCloud size={20} style={{ color: 'var(--primary)' }} />
            <span>تحميل الرد الضريبي (PDF)</span>
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            ارفع ملف الـ PDF المستلم من دائرة الضرائب، وحدد حالة كل فاتورة بداخلها.
          </p>

          <form onSubmit={handlePdfUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {/* Request Link */}
            <div className="form-group">
              <label className="form-label">مطابقة مع طلب الإعفاء *</label>
              <select
                className="form-input"
                value={selectedReqForUpload}
                onChange={(e) => {
                  setSelectedReqForUpload(e.target.value);
                  setInvoiceUpdates({});
                }}
                required
              >
                <option value="">-- اختر طلب التصدير --</option>
                {requests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.stats.pending} معلّقة / {r.stats.total} إجمالي)
                  </option>
                ))}
              </select>
            </div>

            {/* File Chooser */}
            <div className="form-group">
              <label className="form-label">
                <span>ملف الـ PDF الضريبي</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginRight: '0.25rem' }}>
                  (إلزامي للفواتير الجاهزة فقط)
                </span>
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="form-input"
                style={{ fontSize: '0.8rem', padding: '0.4rem' }}
              />
            </div>

            {/* Matching List (Displays only if a request is selected) */}
            {selectedReqForUpload && pendingInvoicesOfSelectedRequest.length > 0 && (
              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.5rem',
                backgroundColor: 'var(--bg-app)',
                animation: 'fadeIn 0.25s ease'
              }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--primary)' }}>
                  الفواتير قيد المعالجة في هذا الطلب:
                </p>

                {Object.entries(groupInvoicesBySupplier(pendingInvoicesOfSelectedRequest)).map(([supplierName, invList]) => (
                  <div key={supplierName} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem', marginBottom: '0.3rem' }}>
                      {supplierName}
                    </div>
                    {invList.map((inv) => {
                      const isChecked = invoiceUpdates[inv.id]?.selected || false;
                      const statusVal = invoiceUpdates[inv.id]?.status || 'ready';

                      return (
                        <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0', gap: '0.5rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', flex: 1, overflow: 'hidden' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleInvoiceToggle(inv.id, e.target.checked)}
                            />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              فاتورة {inv.invoiceNumber}
                            </span>
                          </label>
                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                            <button
                              type="button"
                              onClick={() => handleInvoiceStatusChange(inv.id, 'ready')}
                              className={`btn ${statusVal === 'ready' ? 'btn-success' : 'btn-secondary'}`}
                              style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', minHeight: 'auto', borderRadius: '4px' }}
                            >
                              جاهزة
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInvoiceStatusChange(inv.id, 'returned')}
                              className={`btn ${statusVal === 'returned' ? 'btn-danger' : 'btn-secondary'}`}
                              style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', minHeight: 'auto', borderRadius: '4px' }}
                            >
                              مسترجعة
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {selectedReqForUpload && pendingInvoicesOfSelectedRequest.length === 0 && (
              <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                لا توجد فواتير معلّقة (Pending) في هذا الطلب لتحديثها!
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingPdf || !selectedReqForUpload || pendingInvoicesOfSelectedRequest.length === 0}
              style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
            >
              <span>{submittingPdf ? 'جاري الحفظ...' : 'حفظ المستند والمطابقة'}</span>
            </button>
          </form>
        </div>

        {/* PDF Archive Library Card */}
        <div className="card" style={{ margin: 0, flex: 1, minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 800 }}>
            <FileText size={20} style={{ color: 'var(--primary)' }} />
            <span>أرشيف المخرجات والقرارات</span>
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            قائمة بقرارات الضرائب التي قمت برفعها للتخزين.
          </p>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
            {pdfs.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pdfs.map((p) => (
                  <li
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ flex: 1, overflow: 'hidden', marginRight: '0.25rem' }}>
                      <p style={{ fontWeight: 700, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={p.filename}>
                        {p.filename}
                      </p>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {new Date(p.created_at).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
                      </span>
                    </div>
                    <button
                      className="btn-icon-only edit"
                      onClick={() => handleDownloadPdf(p.id, p.filename)}
                      title="تحميل الملف"
                      style={{ padding: '0.35rem' }}
                    >
                      <Download size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ padding: '1.5rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem' }}>
                لا توجد ملفات مرفوعة حالياً.
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Panel: Requests Overview */}
      <main style={{ flex: 1 }}>
        <div className="card" style={{ margin: 0, minHeight: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                سجل كشوفات الإعفاءات الضريبية (Tax Requests)
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                استعرض الكشوفات المصدرة سابقاً، وتابع اعتماد فواتيرها، وصدر الفواتير الموافق عليها (Ready) في صفحات مستقلة لكل مورد.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                setIsImportModalOpen(true);
                setManualInvoices([]);
                setImportRequestName('');
                setExcelFile(null);
                setModalTab('excel'); // default to Excel import!
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <UploadCloud size={16} />
              <span>استيراد كشف فواتير من Excel</span>
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              جاري تحميل سجل الطلبات...
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state" style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4rem 2rem' }}>
              <div className="empty-state-icon">
                <FileSpreadsheet size={32} />
              </div>
              <h4 className="empty-state-title">سجل الطلبات فارغ</h4>
              <p>لم تقم بتصدير أي فواتير بعد. اذهب لشاشة إدخال الفواتير لتصدير كشف أول.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '4%' }}></th>
                    <th>اسم الطلب</th>
                    <th>تاريخ الإنشاء</th>
                    <th>إجمالي الفواتير</th>
                    <th>حالة الطلب (الفواتير)</th>
                    <th>خيارات الكشف</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const isExpanded = expandedRequestId === req.id;
                    const readyPct = req.stats.total > 0 ? Math.round((req.stats.ready / req.stats.total) * 100) : 0;
                    
                    return (
                      <React.Fragment key={req.id}>
                        {/* Master Row */}
                        <tr
                          style={{
                            cursor: 'pointer',
                            backgroundColor: isExpanded ? 'var(--primary-light)' : 'transparent',
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                          <td>
                            <button
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRequestId(isExpanded ? null : req.id);
                              }}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </td>
                          <td style={{ fontWeight: 700 }} onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}>
                            {req.name}
                          </td>
                          <td onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}>
                            {new Date(req.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                          </td>
                          <td style={{ fontWeight: 600 }} onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}>
                            {req.stats.total} فواتير
                          </td>
                          <td onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              {/* Small progress meter */}
                              <div style={{ width: '120px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${readyPct}%`, height: '100%', background: 'var(--success)' }}></div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <span style={{ color: 'var(--success)' }}>جاهز: {req.stats.ready}</span>
                                <span style={{ color: 'var(--warning)' }}>معلّق: {req.stats.pending}</span>
                                <span style={{ color: 'var(--danger)' }}>مسترجع: {req.stats.returned}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <button
                                className="btn btn-success"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExportReady(req.id, req.name);
                                }}
                                disabled={req.stats.ready === 0}
                                style={{
                                  fontSize: '0.8rem',
                                  padding: '0.25rem 0.5rem',
                                  minHeight: 'auto',
                                  opacity: req.stats.ready === 0 ? 0.55 : 1,
                                  cursor: req.stats.ready === 0 ? 'not-allowed' : 'pointer'
                                }}
                                title="تصدير الفواتير المعتمدة لملف إكسل مفصول لكل مورد"
                              >
                                <FileSpreadsheet size={14} />
                                <span>كشف الجاهز (مفصول)</span>
                              </button>
                              <button
                                className="btn btn-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRequest(req.id, req.name);
                                }}
                                style={{
                                  fontSize: '0.8rem',
                                  padding: '0.25rem 0.5rem',
                                  minHeight: 'auto',
                                  backgroundColor: '#EF4444',
                                  borderColor: '#EF4444',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                                title="حذف هذا الكشف وكافة الفواتير التابعة له نهائياً"
                              >
                                <X size={14} />
                                <span>حذف الكشف</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} style={{ backgroundColor: '#F8FAFC', padding: '1rem 1.5rem' }}>
                              <div style={{ animation: 'fadeIn 0.25s ease' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span>تفاصيل فواتير الطلب:</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    ({req.invoices.length} فواتير مسجلة)
                                  </span>
                                </h4>

                                {req.invoices.length > 0 ? (
                                  <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto', margin: 0, boxShadow: 'none', border: '1px solid var(--border-color)' }}>
                                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr style={{ background: 'var(--bg-app)' }}>
                                          <th>رقم الفاتورة</th>
                                          <th>تاريخ الفاتورة</th>
                                          <th>المورد / الشركة</th>
                                          <th>رقم الإعفاء</th>
                                          <th>المبلغ الفرعي</th>
                                          <th>المبلغ الإجمالي</th>
                                          <th>الحالة</th>
                                          <th style={{ width: '80px', textAlign: 'center' }}>الخيارات</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {req.invoices.map((inv) => (
                                          <tr key={inv.id}>
                                            <td style={{ fontWeight: 700 }}>{inv.invoiceNumber}</td>
                                            <td>{inv.invoiceDate}</td>
                                            <td>{inv.companyNameAr}</td>
                                            <td>
                                              <code style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                                {`620/31/2/${inv.exemptionNumber}`}
                                              </code>
                                            </td>
                                            <td>{inv.subtotalAmount.toLocaleString()}</td>
                                            <td style={{ fontWeight: 700 }}>{inv.totalAmount.toLocaleString()}</td>
                                            <td>{renderStatusBadge(inv.status)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteInvoice(inv.id!, inv.invoiceNumber)}
                                                className="btn-icon-only delete"
                                                title="حذف هذه الفاتورة يدويًا"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                                    لا توجد فواتير مرتبطة بهذا الطلب.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Combined Invoices Create/Import Modal */}
      {isImportModalOpen && (
        <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title">إضافة كشف فواتير جديد للطلب</h3>
              <button className="btn-icon-only" onClick={() => setIsImportModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem', padding: '0 1.5rem' }}>
              <button
                type="button"
                className={`tab-btn ${modalTab === 'excel' ? 'active' : ''}`}
                onClick={() => setModalTab('excel')}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: modalTab === 'excel' ? '3px solid var(--primary)' : 'none',
                  fontWeight: modalTab === 'excel' ? 800 : 'normal',
                  color: modalTab === 'excel' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                استيراد من ملف Excel (موصى به)
              </button>
              <button
                type="button"
                className={`tab-btn ${modalTab === 'manual' ? 'active' : ''}`}
                onClick={() => setModalTab('manual')}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: modalTab === 'manual' ? '3px solid var(--primary)' : 'none',
                  fontWeight: modalTab === 'manual' ? 800 : 'normal',
                  color: modalTab === 'manual' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                إدخال يدوي للفواتير
              </button>
            </div>
            
            {modalTab === 'excel' ? (
              /* Excel Import Form Tab */
              <form onSubmit={handleExcelImportSubmit}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '55vh', overflowY: 'auto' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                    ارفع ملف Excel الذي قمت بتصديره سابقاً بعد تعديله. سيقوم النظام بمطابقة أرقام الهوية الضريبية للشركات تلقائياً واستيراد جميع الفواتير لتتمكن من تحديد حالتها ومطابقتها بالرد الضريبي.
                  </p>

                  <div className="form-group">
                    <label className="form-label">ملف الـ Excel المطلوب استيراده (.xlsx) *</label>
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={handleExcelImportChange}
                      required
                      className="form-input"
                    />
                    {excelFile && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'block', marginTop: '0.25rem' }}>
                        ✓ تم اختيار: {excelFile.filename}
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">اسم هذا الطلب الجديد *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={importRequestName}
                      onChange={(e) => setImportRequestName(e.target.value)}
                      placeholder="مثال: كشف مستورد - مايو 2026"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">الحالة الافتراضية للفواتير المستوردة *</label>
                    <select
                      className="form-input"
                      value={importDefaultStatus}
                      onChange={(e) => setImportDefaultStatus(e.target.value as 'pending' | 'ready')}
                      required
                    >
                      <option value="pending">قيد الانتظار / معلّقة (Pending)</option>
                      <option value="ready">جاهزة / معتمدة مباشرة (Ready)</option>
                    </select>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      * ملاحظة: إذا كان كشف الـ Excel يحتوي على عمود باسم "الحالة"، فسيتم تطبيق الحالة الخاصة بكل فاتورة تلقائياً من الملف.
                    </span>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsImportModalOpen(false)}
                    disabled={importingInvoices}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={importingInvoices || !excelFile || !importRequestName.trim()}
                  >
                    {importingInvoices ? 'جاري الاستيراد...' : 'بدء الاستيراد'}
                  </button>
                </div>
              </form>
            ) : (
              /* Manual Input Form Tab */
              <>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '55vh', overflowY: 'auto' }}>
                  
                  {/* Request Info */}
                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ fontWeight: 800 }}>اسم الكشف الإجمالي الجديد *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={importRequestName}
                      onChange={(e) => setImportRequestName(e.target.value)}
                      placeholder="مثال: كشف فواتير تسوية - يونيو 2026"
                      required
                    />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

                  {/* Add Invoice Form */}
                  <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={16} />
                      <span>تعريف فاتورة جديدة وإرفاق الـ PDF</span>
                    </h4>
                    
                    <form onSubmit={handleAddManualInvoice}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                        
                        {/* Supplier */}
                        <div className="form-group">
                          <label className="form-label">المورد / الشركة المشترية *</label>
                          <select
                            className="form-input"
                            value={formCompanyId}
                            onChange={(e) => setFormCompanyId(e.target.value)}
                          >
                            <option value="">اختر المورد...</option>
                            {companies.map(c => (
                              <option key={c.id} value={c.id}>{c.name_ar}</option>
                            ))}
                          </select>
                        </div>

                        {/* Tax Number */}
                        <div className="form-group">
                          <label className="form-label">الرقم الضريبي</label>
                          <input
                            type="text"
                            className="form-input"
                            value={formTaxNumber}
                            readOnly
                            placeholder="الرقم الضريبي للمورد..."
                          />
                        </div>

                        {/* Material */}
                        <div className="form-group">
                          <label className="form-label">الصنف / المادة *</label>
                          <select
                            className="form-input"
                            value={formMaterialId}
                            onChange={(e) => setFormMaterialId(e.target.value)}
                            disabled={!formCompanyId}
                          >
                            <option value="">اختر الصنف...</option>
                            {formCompanyId && materials
                              .filter(m => m.company_ids && m.company_ids.includes(formCompanyId))
                              .map(m => (
                                <option key={m.id} value={m.id}>{m.name_ar}</option>
                              ))
                            }
                          </select>
                        </div>

                        {/* Exemption Select (if multiple) */}
                        {formMaterialId && (() => {
                          const mat = materials.find(m => m.id === formMaterialId);
                          if (mat && mat.exemptions && mat.exemptions.length > 1) {
                            return (
                              <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>رقم الإعفاء ورمز البند *</label>
                                <select
                                  className="form-input"
                                  value={formExemptionKey}
                                  onChange={(e) => setFormExemptionKey(e.target.value)}
                                >
                                  <option value="">اختر الإعفاء البند...</option>
                                  {mat.exemptions.map((ex: any) => (
                                    <option key={`${ex.exemption_number}_${ex.main_item_code}`} value={`${ex.exemption_number}_${ex.main_item_code}`}>
                                      {`إعفاء ${ex.exemption_number} - بند ${ex.main_item_code}`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Exemption Number (if single / auto-filled) */}
                        <div className="form-group">
                          <label className="form-label">رقم الإعفاء / كود البند</label>
                          <input
                            type="text"
                            className="form-input"
                            value={formExemptionNumber ? `إعفاء ${formExemptionNumber} (بند ${formMainItemCode})` : ''}
                            readOnly
                            placeholder="اختر مادة لعرض الإعفاء..."
                          />
                        </div>

                        {/* Invoice Number */}
                        <div className="form-group">
                          <label className="form-label">رقم الفاتورة *</label>
                          <input
                            type="text"
                            className="form-input"
                            value={formInvoiceNumber}
                            onChange={(e) => setFormInvoiceNumber(e.target.value)}
                            placeholder="أدخل رقم الفاتورة..."
                          />
                        </div>

                        {/* Invoice Date */}
                        <div className="form-group">
                          <label className="form-label">تاريخ الفاتورة *</label>
                          <input
                            type="date"
                            className="form-input"
                            value={formInvoiceDate}
                            onChange={(e) => setFormInvoiceDate(e.target.value)}
                          />
                        </div>

                        {/* Quantity */}
                        <div className="form-group">
                          <label className="form-label">الكمية *</label>
                          <input
                            type="number"
                            className="form-input"
                            value={formQuantity}
                            onChange={(e) => setFormQuantity(e.target.value)}
                            placeholder="أدخل الكمية..."
                            min="1"
                          />
                        </div>

                        {/* Subtotal */}
                        <div className="form-group">
                          <label className="form-label">المبلغ الفرعي (Subtotal) *</label>
                          <input
                            type="number"
                            className="form-input"
                            value={formSubtotal}
                            onChange={(e) => setFormSubtotal(e.target.value)}
                            placeholder="المبلغ الفرعي..."
                            min="0"
                            step="0.01"
                          />
                        </div>

                        {/* Total */}
                        <div className="form-group">
                          <label className="form-label">المبلغ الإجمالي (Total) *</label>
                          <input
                            type="number"
                            className="form-input"
                            value={formTotal}
                            onChange={(e) => setFormTotal(e.target.value)}
                            placeholder="المبلغ الإجمالي..."
                            min="0"
                            step="0.01"
                          />
                        </div>

                        {/* Status */}
                        <div className="form-group">
                          <label className="form-label">حالة الفاتورة *</label>
                          <select
                            className="form-input"
                            value={formStatus}
                            onChange={(e) => setFormStatus(e.target.value as 'pending' | 'ready')}
                          >
                            <option value="ready">جاهزة / معتمدة (Ready)</option>
                            <option value="pending">قيد الانتظار / معلّقة (Pending)</option>
                          </select>
                        </div>

                        {/* PDF File Upload */}
                        <div className="form-group">
                          <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>إرفاق ملف الفاتورة (PDF)</label>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handleInvoicePdfChange}
                            className="form-input"
                            style={{ fontSize: '0.85rem' }}
                          />
                          {formPdfFile && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'block', marginTop: '0.25rem' }}>
                              ✓ تم اختيار: {formPdfFile.filename}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>إضافة الفاتورة للطلب</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Draft Invoices List */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      الفواتير المضافة للطلب ({manualInvoices.length})
                    </h4>
                    
                    {manualInvoices.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        لا توجد فواتير مضافة حتى الآن في مسودة هذا الطلب. قم بملء الحقول أعلاه واضغط على "إضافة الفاتورة للطلب".
                      </div>
                    ) : (
                      <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
                        <table className="data-table" style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>رقم الفاتورة</th>
                              <th>المورد</th>
                              <th>الصنف</th>
                              <th>الإعفاء</th>
                              <th>المبلغ الإجمالي</th>
                              <th>الحالة</th>
                              <th>الملف المرفق</th>
                              <th>خيارات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {manualInvoices.map((inv) => (
                              <tr key={inv.id}>
                                <td style={{ fontWeight: 700 }}>{inv.invoiceNumber}</td>
                                <td>{inv.companyNameAr}</td>
                                <td>{inv.materialNameAr}</td>
                                <td>{`620/31/2/${inv.exemptionNumber}`}</td>
                                <td style={{ fontWeight: 700 }}>{inv.totalAmount.toLocaleString()}</td>
                                <td>
                                  <span className={`status-badge status-${inv.status}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}>
                                    {inv.status === 'ready' ? 'جاهزة' : 'قيد الانتظار'}
                                  </span>
                                </td>
                                <td>
                                  {inv.pdfFile ? (
                                    <span style={{ color: 'var(--success)' }} title={inv.pdfFile.filename}>
                                      📄 {inv.pdfFile.filename.substring(0, 15)}...
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>لا يوجد</span>
                                  )}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-icon-only"
                                    onClick={() => handleRemoveManualInvoice(inv.id)}
                                    style={{ color: 'var(--danger)', padding: '2px' }}
                                  >
                                    <X size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsImportModalOpen(false)}
                    disabled={importingInvoices}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleManualRequestSubmit}
                    disabled={importingInvoices || manualInvoices.length === 0 || !importRequestName.trim()}
                  >
                    {importingInvoices ? 'جاري حفظ الكشف...' : 'حفظ الكشف بالكامل'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
