import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  Database
} from 'lucide-react';
import {
  getCompanies,
  getMaterials,
  exportToExcel,
  getReturnedInvoices
} from '../api';
import type { Company, Material, InvoiceInput } from '../api';
import { SearchableSelect } from '../components/SearchableSelect';
import type { SelectOption } from '../components/SearchableSelect';

interface InvoiceScreenProps {
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  navigateToAdmin: () => void;
}

export const InvoiceScreen: React.FC<InvoiceScreenProps> = ({ showToast, navigateToAdmin }) => {
  // Master data lists
  const [companies, setCompanies] = useState<Company[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaster, setLoadingMaster] = useState<boolean>(true);

  // In-memory invoice list before export
  const [invoices, setInvoices] = useState<InvoiceInput[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New States for Request Save & Return Toggle
  const [requestName, setRequestName] = useState<string>('');
  const [includeReturned, setIncludeReturned] = useState<boolean>(false);

  // Fetch returned invoices when toggled
  useEffect(() => {
    if (includeReturned) {
      const fetchReturned = async () => {
        try {
          const data = await getReturnedInvoices();
          if (data.length === 0) {
            showToast('لا توجد فواتير مسترجعة في قاعدة البيانات حالياً', 'info');
            setIncludeReturned(false);
            return;
          }
          
          // Tag them and merge
          const tagged = data.map(inv => ({
            ...inv,
            isReturnedFromDb: true
          }));

          setInvoices(prev => {
            const filteredPrev = prev.filter(inv => !(inv as any).isReturnedFromDb);
            return [...filteredPrev, ...tagged];
          });
          showToast(`تم تضمين ${data.length} من الفواتير المسترجعة تلقائياً`, 'success');
        } catch (err: any) {
          showToast('خطأ في تحميل الفواتير المسترجعة: ' + err.message, 'error');
          setIncludeReturned(false);
        }
      };
      fetchReturned();
    } else {
      // Remove database-loaded returned invoices
      setInvoices(prev => prev.filter(inv => !(inv as any).isReturnedFromDb));
    }
  }, [includeReturned]);

  // Form Fields
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [selectedExemptionKey, setSelectedExemptionKey] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<string>('');
  const [subtotalAmount, setSubtotalAmount] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');

  // Auto-filled states
  const [taxNumber, setTaxNumber] = useState<string>('');
  const [exemptionNumber, setExemptionNumber] = useState<string>('');
  const [mainItemCode, setMainItemCode] = useState<string>('');

  // Load master data on mount
  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    setLoadingMaster(true);
    try {
      const [comps, mats] = await Promise.all([getCompanies(), getMaterials()]);
      setCompanies(comps);
      setMaterials(mats);
    } catch (err: any) {
      showToast('خطأ في تحميل البيانات الأساسية: ' + err.message, 'error');
    } finally {
      setLoadingMaster(false);
    }
  };

  // Triggered when selected company changes
  useEffect(() => {
    if (selectedCompanyId) {
      const comp = companies.find((c) => c.id === selectedCompanyId);
      if (comp) {
        setTaxNumber(comp.tax_number);
      }
      
      // Clear material selection if it doesn't belong to the newly selected company
      if (selectedMaterialId) {
        const mat = materials.find(m => m.id === selectedMaterialId);
        if (mat && (!mat.company_ids || !mat.company_ids.includes(selectedCompanyId))) {
          setSelectedMaterialId('');
        }
      }
    } else {
      setTaxNumber('');
      setSelectedMaterialId('');
    }
  }, [selectedCompanyId, companies]);

  // Triggered when selected material changes
  useEffect(() => {
    if (selectedMaterialId) {
      const mat = materials.find((m) => m.id === selectedMaterialId);
      if (mat) {
        if (mat.exemptions && mat.exemptions.length === 1) {
          setExemptionNumber(mat.exemptions[0].exemption_number);
          setMainItemCode(mat.exemptions[0].main_item_code);
          setSelectedExemptionKey(`${mat.exemptions[0].exemption_number}_${mat.exemptions[0].main_item_code}`);
        } else {
          // If editing or existing selection is still valid for this material, preserve it
          const isValid = mat.exemptions && mat.exemptions.some(e => `${e.exemption_number}_${e.main_item_code}` === selectedExemptionKey);
          if (!isValid) {
            setExemptionNumber('');
            setMainItemCode('');
            setSelectedExemptionKey('');
          }
        }
      }
    } else {
      setExemptionNumber('');
      setMainItemCode('');
      setSelectedExemptionKey('');
    }
  }, [selectedMaterialId, materials]);

  // Triggered when selected exemption changes (autofills paired main item code)
  useEffect(() => {
    if (selectedMaterialId && selectedExemptionKey) {
      const mat = materials.find((m) => m.id === selectedMaterialId);
      if (mat && mat.exemptions) {
        const [exNum, itemCode] = selectedExemptionKey.split('_');
        const ex = mat.exemptions.find(e => e.exemption_number === exNum && e.main_item_code === itemCode);
        if (ex) {
          setExemptionNumber(ex.exemption_number);
          setMainItemCode(ex.main_item_code);
        }
      }
    }
  }, [selectedExemptionKey, selectedMaterialId, materials]);

  // Filter materials based on selectedCompanyId
  const filteredMaterialsList = selectedCompanyId
    ? materials.filter(m => m.company_ids && m.company_ids.includes(selectedCompanyId))
    : [];

  // Map database elements to searchable select options
  const companyOptions: SelectOption[] = companies.map((c) => ({
    id: c.id!,
    label: c.name_ar
  }));

  const materialOptions: SelectOption[] = filteredMaterialsList.map((m) => ({
    id: m.id!,
    label: m.name_ar
  }));

  // Add or edit row in state
  const handleAddInvoice = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!selectedCompanyId) {
      showToast('يرجى اختيار الشركة أولاً', 'warning');
      return;
    }
    if (!selectedMaterialId) {
      showToast('يرجى اختيار المادة/الصنف أولاً', 'warning');
      return;
    }
    if (!exemptionNumber.trim() || !mainItemCode.trim()) {
      showToast('يرجى تحديد رقم الإعفاء المطلوب لهذا الصنف', 'warning');
      return;
    }
    if (!invoiceNumber.trim()) {
      showToast('يرجى إدخال رقم الفاتورة', 'warning');
      return;
    }
    if (!invoiceDate) {
      showToast('يرجى تحديد تاريخ الفاتورة', 'warning');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      showToast('يرجى إدخال كمية صحيحة أكبر من صفر', 'warning');
      return;
    }
    if (!subtotalAmount || Number(subtotalAmount) < 0) {
      showToast('يرجى إدخال قيمة المبلغ الفرعي', 'warning');
      return;
    }
    if (!totalAmount || Number(totalAmount) < 0) {
      showToast('يرجى إدخال قيمة المبلغ الإجمالي', 'warning');
      return;
    }

    const company = companies.find((c) => c.id === selectedCompanyId)!;
    const material = materials.find((m) => m.id === selectedMaterialId)!;

    const newInvoice: InvoiceInput = {
      id: editingId || Math.random().toString(36).substring(2, 9),
      companyId: selectedCompanyId,
      materialId: selectedMaterialId,
      companyNameAr: company.name_ar,
      materialNameAr: material.name_ar,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      taxNumber: taxNumber.trim(),
      mainItemCode: mainItemCode.trim(),
      exemptionNumber: exemptionNumber.trim(),
      quantity: Number(quantity),
      subtotalAmount: Number(subtotalAmount),
      totalAmount: Number(totalAmount)
    };

    if (editingId) {
      // Edit mode
      setInvoices(invoices.map((inv) => (inv.id === editingId ? newInvoice : inv)));
      showToast('تم تعديل سجل الفاتورة بنجاح', 'success');
      setEditingId(null);
    } else {
      // Add mode
      setInvoices([...invoices, newInvoice]);
      showToast('تمت إضافة سجل الفاتورة إلى الجدول المؤقت', 'success');
    }

    // Reset Form Fields (except maybe company/date for quick entry convenience)
    setInvoiceNumber('');
    setQuantity('');
    setSubtotalAmount('');
    setTotalAmount('');
    setSelectedMaterialId('');
    setSelectedExemptionKey('');
  };

  // Edit Row
  const startEditInvoice = (inv: InvoiceInput) => {
    setEditingId(inv.id!);
    setSelectedCompanyId(inv.companyId || '');
    setSelectedMaterialId(inv.materialId || '');
    setSelectedExemptionKey(inv.exemptionNumber && inv.mainItemCode ? `${inv.exemptionNumber}_${inv.mainItemCode}` : '');
    setInvoiceNumber(inv.invoiceNumber);
    setInvoiceDate(inv.invoiceDate);
    setQuantity(inv.quantity.toString());
    setSubtotalAmount(inv.subtotalAmount.toString());
    setTotalAmount(inv.totalAmount.toString());
  };

  // Delete Row
  const handleDeleteInvoice = (id: string) => {
    setInvoices(invoices.filter((inv) => inv.id !== id));
    showToast('تم حذف السجل من القائمة', 'info');
    if (editingId === id) {
      setEditingId(null);
      resetForm();
    }
  };

  // Reset Form
  const resetForm = () => {
    setEditingId(null);
    setSelectedCompanyId('');
    setSelectedMaterialId('');
    setSelectedExemptionKey('');
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setQuantity('');
    setSubtotalAmount('');
    setTotalAmount('');
  };

  // Export to Excel and save request in database
  const handleExport = async () => {
    if (invoices.length === 0) {
      showToast('الجدول فارغ! الرجاء إضافة فواتير أولاً قبل التصدير', 'warning');
      return;
    }

    try {
      showToast('جاري إنشاء وتصدير ملف الإكسل وحفظ الطلب في قاعدة البيانات...', 'info');
      await exportToExcel(invoices, requestName.trim() || undefined);
      showToast('تم تصدير الملف وحفظ الطلب بنجاح!', 'success');
      
      // Reset list and input states
      setInvoices([]);
      setRequestName('');
      setIncludeReturned(false);
    } catch (err: any) {
      showToast('فشل التصدير وحفظ البيانات: ' + err.message, 'error');
    }
  };

  return (
    <div>
      {/* 1. Form Section for adding records */}
      <div className="card">
        <h3 className="card-title">
          <Database size={20} style={{ color: 'var(--primary)' }} />
          <span>{editingId ? 'تعديل بيانات الفاتورة الحالية' : 'إدخال سجل فاتورة جديد'}</span>
        </h3>

        {loadingMaster ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            جاري تحميل قائمة الشركات والأصناف لتعبئة الحقول...
          </div>
        ) : companies.length === 0 || materials.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem', textAlign: 'center', gap: '1rem' }}>
            <AlertCircle size={36} style={{ color: 'var(--warning)' }} />
            <div>
              <p style={{ fontWeight: 700 }}>البيانات الأساسية فارغة!</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                يجب إضافة شركات ومواد في صفحة الإدارة أولاً لتتمكن من إنشاء فواتير.
              </p>
            </div>
            <button className="btn btn-primary" onClick={navigateToAdmin}>
              الذهاب إلى صفحة الإدارة
            </button>
          </div>
        ) : (
          <form onSubmit={handleAddInvoice}>
            <div className="form-grid">
              {/* Company Selector */}
              <div className="form-group">
                <label className="form-label">الشركة المشترية *</label>
                <SearchableSelect
                  options={companyOptions}
                  value={selectedCompanyId}
                  onChange={setSelectedCompanyId}
                  placeholder="اختر الشركة..."
                />
              </div>

              {/* Tax Number (Auto filled) */}
              <div className="form-group">
                <label className="form-label">الرقم الضريبي (تلقائي)</label>
                <input
                  type="text"
                  className="form-input"
                  value={taxNumber}
                  readOnly
                  placeholder="الرقم الضريبي..."
                />
              </div>

              {/* Material Selector */}
              <div className="form-group">
                <label className="form-label">الصنف / المادة *</label>
                <SearchableSelect
                  options={materialOptions}
                  value={selectedMaterialId}
                  onChange={setSelectedMaterialId}
                  placeholder="اختر المادة..."
                />
              </div>

              {/* Exemption Number Selection Dropdown (Only shown if material has multiple exemptions) */}
              {selectedMaterialId && (() => {
                const mat = materials.find(m => m.id === selectedMaterialId);
                if (mat && mat.exemptions && mat.exemptions.length > 1) {
                  return (
                    <div className="form-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                      <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>رقم الإعفاء المطلوب *</label>
                      <select
                        className="form-input"
                        value={selectedExemptionKey}
                        onChange={(e) => setSelectedExemptionKey(e.target.value)}
                        required
                        style={{ borderColor: 'var(--primary)' }}
                      >
                        <option value="">-- اختر رقم الإعفاء --</option>
                        {mat.exemptions.map((ex, idx) => (
                          <option key={idx} value={`${ex.exemption_number}_${ex.main_item_code}`}>
                            {ex.exemption_number} (رمز البند: {ex.main_item_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Exemption Number (Auto filled & formatted in UI description) */}
              <div className="form-group">
                <label className="form-label">رقم الإعفاء (تلقائي)</label>
                <input
                  type="text"
                  className="form-input"
                  value={exemptionNumber ? `620/31/2/${exemptionNumber}` : ''}
                  readOnly
                  placeholder="تنسيق: 620/31/2/XXXX"
                />
              </div>

              {/* Main Item Code (Auto filled) */}
              <div className="form-group">
                <label className="form-label">رمز البند الرئيسي (تلقائي)</label>
                <input
                  type="text"
                  className="form-input"
                  value={mainItemCode}
                  readOnly
                  placeholder="كود الصنف الرئيسي..."
                />
              </div>

              {/* Invoice Number */}
              <div className="form-group">
                <label className="form-label">رقم الفاتورة *</label>
                <input
                  type="text"
                  className="form-input"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="أدخل رقم الفاتورة"
                  required
                />
              </div>

              {/* Invoice Date */}
              <div className="form-group">
                <label className="form-label">تاريخ الفاتورة *</label>
                <input
                  type="date"
                  className="form-input"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>

              {/* Quantity */}
              <div className="form-group">
                <label className="form-label">الكمية *</label>
                <input
                  type="number"
                  className="form-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="أدخل الكمية"
                  min="0.01"
                  step="any"
                  required
                />
              </div>

              {/* Subtotal Amount */}
              <div className="form-group">
                <label className="form-label">المبلغ الفرعي *</label>
                <input
                  type="number"
                  className="form-input"
                  value={subtotalAmount}
                  onChange={(e) => setSubtotalAmount(e.target.value)}
                  placeholder="أدخل المبلغ الفرعي"
                  min="0"
                  step="any"
                  required
                />
              </div>

              {/* Total Amount */}
              <div className="form-group">
                <label className="form-label">المبلغ الإجمالي *</label>
                <input
                  type="number"
                  className="form-input"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="أدخل المبلغ الإجمالي"
                  min="0"
                  step="any"
                  required
                />
              </div>

              {/* Transaction Type (Fixed) */}
              <div className="form-group">
                <label className="form-label">نوع المعاملة (ثابت)</label>
                <div className="fixed-field-display">
                  <span className="badge-fixed">2</span>
                  <span style={{ fontSize: '0.8rem' }}>مبيعات معفاة</span>
                </div>
              </div>

              {/* Sub Item Code (Fixed) */}
              <div className="form-group">
                <label className="form-label">الصنف الفرعي (ثابت)</label>
                <div className="fixed-field-display">
                  <span className="badge-fixed">1</span>
                  <span style={{ fontSize: '0.8rem' }}>رمز افتراضي فرعي</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start' }}>
              <button type="submit" className="btn btn-primary">
                <Plus size={18} />
                <span>{editingId ? 'تحديث بيانات السجل' : 'إضافة إلى الجدول'}</span>
              </button>

              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                <span>إعادة تعيين</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. In-Memory Table Section */}
      <div className="card" style={{ margin: 0 }}>
        {/* Toggle Panel for Saved Invoices */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem', border: '1px solid var(--border-color)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={includeReturned}
              onChange={(e) => setIncludeReturned(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span>تضمين الفواتير المسترجعة من المعاملات السابقة (تلقائياً)</span>
          </label>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            * عند التفعيل، سيتم دمج جميع الفواتير التي لم تُعتمد سابقاً في هذا الكشف.
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <span>قائمة الفواتير المضافة حالياً</span>
              {invoices.length > 0 && (
                <span style={{ fontSize: '0.85rem', padding: '0.1rem 0.5rem', borderRadius: '20px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  {invoices.length} سجلات
                </span>
              )}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              يمكنك تعديل أو حذف البيانات من هذا الجدول المبدئي قبل تصديرها النهائي.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input
              type="text"
              placeholder="اسم هذا الطلب (مثال: طلب إعفاء 2026-07)"
              className="form-input"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              style={{ maxWidth: '300px', margin: 0 }}
            />
            <button
              className="btn btn-success"
              onClick={handleExport}
              disabled={invoices.length === 0}
              style={{ opacity: invoices.length === 0 ? 0.65 : 1, cursor: invoices.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              <FileSpreadsheet size={18} />
              <span>تصدير وحفظ الطلب</span>
            </button>
          </div>
        </div>

        {invoices.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>تاريخ الفاتورة</th>
                  <th>الشركة</th>
                  <th>الرقم الضريبي</th>
                  <th>الصنف</th>
                  <th>رمز البند الرئيسي</th>
                  <th>رقم الإعفاء</th>
                  <th>الكمية</th>
                  <th>المبلغ الفرعي</th>
                  <th>المبلغ الإجمالي</th>
                  <th style={{ width: '10%' }}>الخيارات</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ backgroundColor: editingId === inv.id ? 'var(--primary-light)' : 'transparent' }}>
                    <td style={{ fontWeight: 700 }}>{inv.invoiceNumber}</td>
                    <td>{inv.invoiceDate}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {inv.companyNameAr}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.85rem', background: 'var(--bg-app)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                        {inv.taxNumber}
                      </code>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {inv.materialNameAr}
                    </td>
                    <td>
                      <span className="badge-fixed">{inv.mainItemCode}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        {`620/31/2/${inv.exemptionNumber}`}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{inv.quantity}</td>
                    <td>{inv.subtotalAmount.toLocaleString()}</td>
                    <td style={{ fontWeight: 700 }}>{inv.totalAmount.toLocaleString()}</td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="btn-icon-only edit"
                          onClick={() => startEditInvoice(inv)}
                          title="تعديل السجل"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn-icon-only delete"
                          onClick={() => handleDeleteInvoice(inv.id!)}
                          title="حذف السجل"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <div className="empty-state-icon">
              <FileSpreadsheet size={24} />
            </div>
            <h4 className="empty-state-title">جدول المعاينة فارغ</h4>
            <p>قم بتعبئة النموذج أعلاه ثم اضغط "إضافة إلى الجدول" لبناء كشف الفواتير</p>
          </div>
        )}
      </div>
    </div>
  );
};
