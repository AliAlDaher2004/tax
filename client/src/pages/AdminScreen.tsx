import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Building2,
  Package,
  Edit2,
  Trash2,
  X,
  Download,
  UploadCloud
} from 'lucide-react';
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  downloadCompaniesTemplate,
  downloadMaterialsTemplate,
  importCompaniesExcel,
  importMaterialsExcel,
  getCompanyInvoices,
  downloadPdfDocument
} from '../api';
import type { Company, Material } from '../api';

interface AdminScreenProps {
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState<'companies' | 'materials'>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [importing, setImporting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Supplier Invoices Modal States
  const [selectedCompanyForInvoices, setSelectedCompanyForInvoices] = useState<Company | null>(null);
  const [companyInvoices, setCompanyInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);
  const [isCompanyInvoicesModalOpen, setIsCompanyInvoicesModalOpen] = useState<boolean>(false);

  // Fetch supplier invoices handler
  const handleCompanyClick = async (company: Company) => {
    if (!company.id) {
      showToast('المورد غير صالح (معرّف المورد مفقود)', 'error');
      return;
    }
    setSelectedCompanyForInvoices(company);
    setIsCompanyInvoicesModalOpen(true);
    setLoadingInvoices(true);
    try {
      const data = await getCompanyInvoices(company.id);
      setCompanyInvoices(data);
    } catch (err: any) {
      showToast('فشل تحميل فواتير المورد: ' + err.message, 'error');
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Download PDF Handler
  const handleDownloadInvoicePdf = async (pdfId: string, filename: string) => {
    try {
      showToast('جاري تحميل مستند الـ PDF...', 'info');
      await downloadPdfDocument(pdfId, filename);
    } catch (err: any) {
      showToast('فشل تحميل الملف: ' + err.message, 'error');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      if (activeTab === 'companies') {
        await downloadCompaniesTemplate();
        showToast('تم تحميل نموذج استيراد الشركات بنجاح', 'success');
      } else {
        await downloadMaterialsTemplate();
        showToast('تم تحميل نموذج استيراد الأصناف بنجاح', 'success');
      }
    } catch (err: any) {
      showToast('فشل تحميل النموذج: ' + err.message, 'error');
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const inputElement = e.target;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (!result) return;
      
      const base64Data = result.split(',')[1];
      setImporting(true);
      try {
        if (activeTab === 'companies') {
          const res = await importCompaniesExcel(base64Data);
          showToast(res.message, 'success');
          if (res.warnings && res.warnings.length > 0) {
            showToast(`تنبيه: تم تخطي بعض السطور لعدم اكتمال بياناتها`, 'warning');
          }
        } else {
          const res = await importMaterialsExcel(base64Data);
          showToast(res.message, 'success');
          if (res.warnings && res.warnings.length > 0) {
            showToast(`تنبيه: تم تخطي بعض السطور لعدم اكتمال بياناتها`, 'warning');
          }
        }
        loadData();
      } catch (err: any) {
        showToast('حدث خطأ أثناء الاستيراد: ' + err.message, 'error');
      } finally {
        setImporting(false);
        inputElement.value = '';
      }
    };
    reader.onerror = () => {
      showToast('فشل قراءة الملف المختار', 'error');
      inputElement.value = '';
    };
    reader.readAsDataURL(file);
  };

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string>('');

  // Form states
  const [companyName, setCompanyName] = useState<string>('');
  const [taxNumber, setTaxNumber] = useState<string>('');

  const [materialName, setMaterialName] = useState<string>('');
  const [exemptions, setExemptions] = useState<{ exemption_number: string; main_item_code: string }[]>([
    { exemption_number: '', main_item_code: '' }
  ]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  // Fetch data on load and when tab changes
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'companies') {
        const data = await getCompanies();
        setCompanies(data);
      } else {
        // Load both materials and companies to associate them in checkboxes
        const [matsData, compsData] = await Promise.all([getMaterials(), getCompanies()]);
        setMaterials(matsData);
        setCompanies(compsData);
      }
    } catch (err: any) {
      showToast('حدث خطأ أثناء تحميل البيانات: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reset form inputs
  const resetForm = () => {
    setCompanyName('');
    setTaxNumber('');
    setMaterialName('');
    setExemptions([{ exemption_number: '', main_item_code: '' }]);
    setSelectedCompanyIds([]);
    setEditingId('');
  };

  const openAddModal = () => {
    setModalMode('add');
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setModalMode('edit');
    setEditingId(item.id);
    if (activeTab === 'companies') {
      setCompanyName(item.name_ar);
      setTaxNumber(item.tax_number);
    } else {
      setMaterialName(item.name_ar);
      setExemptions(item.exemptions && item.exemptions.length > 0
        ? item.exemptions.map((ex: any) => ({ exemption_number: ex.exemption_number, main_item_code: ex.main_item_code }))
        : [{ exemption_number: '', main_item_code: '' }]
      );
      setSelectedCompanyIds(item.company_ids || []);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (activeTab === 'companies') {
        if (!companyName.trim() || !taxNumber.trim()) {
          showToast('يرجى ملء جميع الحقول المطلوبة للشركة', 'warning');
          return;
        }

        const companyPayload: Company = {
          name_ar: companyName.trim(),
          tax_number: taxNumber.trim()
        };

        if (modalMode === 'add') {
          await createCompany(companyPayload);
          showToast('تمت إضافة الشركة بنجاح', 'success');
        } else {
          await updateCompany(editingId, companyPayload);
          showToast('تم تحديث بيانات الشركة بنجاح', 'success');
        }
      } else {
        if (!materialName.trim()) {
          showToast('يرجى إدخال اسم الصنف/المادة', 'warning');
          return;
        }

        // Validate that exemptions list has valid non-empty fields
        const validExemptions = exemptions.filter(ex => ex.exemption_number.trim() && ex.main_item_code.trim());
        if (validExemptions.length === 0) {
          showToast('يرجى إضافة إعفاء واحد على الأقل يحتوي على رقم الإعفاء ورمز البند', 'warning');
          return;
        }

        const materialPayload: Material = {
          name_ar: materialName.trim(),
          exemptions: validExemptions,
          company_ids: selectedCompanyIds
        };

        if (modalMode === 'add') {
          await createMaterial(materialPayload);
          showToast('تمت إضافة الصنف بنجاح', 'success');
        } else {
          await updateMaterial(editingId, materialPayload);
          showToast('تم تحديث بيانات الصنف بنجاح', 'success');
        }
      }

      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showToast(err.message || 'فشلت عملية الحفظ', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف "${name}"؟`)) {
      return;
    }

    try {
      if (activeTab === 'companies') {
        await deleteCompany(id);
        showToast('تم حذف الشركة بنجاح', 'success');
      } else {
        await deleteMaterial(id);
        showToast('تم حذف الصنف بنجاح', 'success');
      }
      loadData();
    } catch (err: any) {
      showToast('فشل حذف العنصر: ' + err.message, 'error');
    }
  };

  // Filtering based on search query
  const filteredCompanies = companies.filter(
    (c) =>
      c.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tax_number.includes(searchQuery)
  );

  const filteredMaterials = materials.filter(
    (m) =>
      m.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.exemptions && m.exemptions.some(ex => 
        ex.exemption_number.includes(searchQuery) || 
        ex.main_item_code.includes(searchQuery)
      ))
  );

  return (
    <div className="admin-layout">
      {/* Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>إعدادات النظام</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>إدارة الجداول الرئيسية المدخلة تلقائياً</p>
        </div>

        <button
          className={`admin-nav-item ${activeTab === 'companies' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('companies');
            setSearchQuery('');
          }}
        >
          <Building2 size={18} />
          <span>الشركات والمنشآت</span>
        </button>

        <button
          className={`admin-nav-item ${activeTab === 'materials' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('materials');
            setSearchQuery('');
          }}
        >
          <Package size={18} />
          <span>الأصناف والمواد</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        <div className="card" style={{ margin: 0, minHeight: '500px' }}>
          {/* Header Action Bar */}
          <div className="search-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: '250px' }}>
              <input
                type="text"
                placeholder={activeTab === 'companies' ? 'ابحث باسم الشركة أو الرقم الضريبي...' : 'ابحث باسم المادة، كود الصنف أو رقم الإعفاء...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <Search className="search-input-icon" size={18} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={handleDownloadTemplate}
                title="تحميل نموذج ملف Excel"
                disabled={importing}
              >
                <Download size={18} />
                <span>تحميل النموذج</span>
              </button>

              <label 
                className={`btn btn-secondary ${importing ? 'disabled' : ''}`} 
                style={{ margin: 0, display: 'inline-flex', cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1 }} 
                title="استيراد من ملف Excel"
              >
                <UploadCloud size={18} />
                <span>استيراد من Excel</span>
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileImport} 
                  style={{ display: 'none' }} 
                  disabled={importing}
                />
              </label>

              <button className="btn btn-primary" onClick={openAddModal} disabled={importing}>
                <Plus size={18} />
                <span>{activeTab === 'companies' ? 'إضافة شركة' : 'إضافة صنف'}</span>
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {loading || importing ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
              <span style={{ color: 'var(--text-muted)' }}>
                {importing ? 'جاري استيراد ومعالجة ملف Excel...' : 'جاري تحميل البيانات الأساسية...'}
              </span>
            </div>
          ) : (
            <>
              {/* Companies Table */}
              {activeTab === 'companies' && (
                <div className="table-container">
                  {filteredCompanies.length > 0 ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50%' }}>اسم الشركة (بالعربية)</th>
                          <th style={{ width: '35%' }}>الرقم الضريبي</th>
                          <th style={{ width: '15%', textAlign: 'left' }}>الخيارات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCompanies.map((company) => (
                          <tr key={company.id}>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleCompanyClick(company)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--primary)',
                                  fontWeight: 700,
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  padding: 0,
                                  textAlign: 'right',
                                  fontSize: 'inherit',
                                  fontFamily: 'inherit'
                                }}
                                title="عرض فواتير هذا المورد ومستندات الـ PDF المرتبطة بها"
                              >
                                {company.name_ar}
                              </button>
                            </td>
                            <td>
                              <code style={{ fontSize: '0.95rem', background: 'var(--bg-app)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                                {company.tax_number}
                              </code>
                            </td>
                            <td>
                              <div className="actions-cell">
                                <button
                                  className="btn-icon-only edit"
                                  onClick={() => openEditModal(company)}
                                  title="تعديل البيانات"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  className="btn-icon-only delete"
                                  onClick={() => handleDelete(company.id!, company.name_ar)}
                                  title="حذف الشركة"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Building2 size={24} />
                      </div>
                      <h4 className="empty-state-title">لا توجد شركات مسجلة</h4>
                      <p>قم بإضافة شركات جديدة لعرضها هنا واستخدامها في شاشة إدخال الفواتير</p>
                    </div>
                  )}
                </div>
              )}

              {/* Materials Table */}
              {activeTab === 'materials' && (
                <div className="table-container">
                  {filteredMaterials.length > 0 ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>اسم المادة (بالعربية)</th>
                          <th style={{ width: '35%' }}>أرقام الإعفاء والبنود المرتبطة</th>
                          <th style={{ width: '20%' }}>الشركات الموردة</th>
                          <th style={{ width: '15%', textAlign: 'left' }}>الخيارات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMaterials.map((material) => (
                          <tr key={material.id}>
                            <td style={{ fontWeight: 600 }}>{material.name_ar}</td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {material.exemptions && material.exemptions.length > 0 ? (
                                  material.exemptions.map((ex, idx) => (
                                    <span key={idx} className="badge-fixed" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                                      {ex.exemption_number} (بند {ex.main_item_code})
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد إعفاءات مسجلة</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                {material.company_ids && material.company_ids.length > 0 ? (
                                  material.company_ids.map(cid => {
                                    const comp = companies.find(c => c.id === cid);
                                    return comp ? <span key={cid}>• {comp.name_ar}</span> : null;
                                  })
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>غير مرتبط بأي شركة</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="actions-cell">
                                <button
                                  className="btn-icon-only edit"
                                  onClick={() => openEditModal(material)}
                                  title="تعديل البيانات"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  className="btn-icon-only delete"
                                  onClick={() => handleDelete(material.id!, material.name_ar)}
                                  title="حذف الصنف"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Package size={24} />
                      </div>
                      <h4 className="empty-state-title">لا توجد أصناف مسجلة</h4>
                      <p>قم بإضافة أصناف ومواد جديدة لعرضها هنا لتسهيل تعبئة الفواتير تلقائياً</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === 'add' ? 'إضافة عنصر جديد' : 'تعديل البيانات الأساسية'}
              </h3>
              <button className="btn-icon-only" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                {activeTab === 'companies' ? (
                  /* Companies Form */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">اسم الشركة (باللغة العربية) *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="مثال: شركة الخليج للتجارة"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">الرقم الضريبي للمنشأة *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="مثال: 123456789"
                        value={taxNumber}
                        onChange={(e) => setTaxNumber(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  /* Materials Form */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">اسم الصنف/المادة (بالعربية) *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="مثال: أنابيب فولاذية 3 إنش"
                        value={materialName}
                        onChange={(e) => setMaterialName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label className="form-label">أرقام الإعفاء ورموز البنود الرئيسية المرتبطة *</label>
                      {exemptions.map((ex, index) => (
                        <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="رقم الإعفاء (مثال: 1254)"
                            value={ex.exemption_number}
                            onChange={(e) => {
                              const newExs = [...exemptions];
                              newExs[index].exemption_number = e.target.value;
                              setExemptions(newExs);
                            }}
                            required
                            style={{ flex: 2 }}
                          />
                          <input
                            type="text"
                            className="form-input"
                            placeholder="رمز البند (مثال: 73)"
                            value={ex.main_item_code}
                            onChange={(e) => {
                              const newExs = [...exemptions];
                              newExs[index].main_item_code = e.target.value;
                              setExemptions(newExs);
                            }}
                            required
                            style={{ flex: 1 }}
                          />
                          {exemptions.length > 1 && (
                            <button
                              type="button"
                              className="btn-icon-only delete"
                              onClick={() => {
                                setExemptions(exemptions.filter((_, idx) => idx !== index));
                              }}
                              title="حذف رقم الإعفاء"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ alignSelf: 'flex-start', padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginTop: '0.25rem' }}
                        onClick={() => {
                          setExemptions([...exemptions, { exemption_number: '', main_item_code: '' }]);
                        }}
                      >
                        <Plus size={14} />
                        <span>إضافة إعفاء آخر</span>
                      </button>
                    </div>

                    <div className="form-group" style={{ marginTop: '0.5rem' }}>
                      <label className="form-label" style={{ marginBottom: '0.5rem' }}>الشركات الموردة المرتبطة بهذا الصنف (اختياري)</label>
                      <div style={{
                        maxHeight: '180px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.75rem',
                        background: 'var(--bg-app)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}>
                        {companies.length > 0 ? (
                          companies.map(comp => (
                            <label key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                              <input
                                type="checkbox"
                                checked={selectedCompanyIds.includes(comp.id!)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCompanyIds([...selectedCompanyIds, comp.id!]);
                                  } else {
                                    setSelectedCompanyIds(selectedCompanyIds.filter(id => id !== comp.id));
                                  }
                                }}
                                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                              />
                              <span>{comp.name_ar}</span>
                            </label>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد شركات مسجلة للربط بها</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary">
                  حفظ البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Invoices History Modal */}
      {isCompanyInvoicesModalOpen && selectedCompanyForInvoices && (
        <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title">سجل فواتير المورد: {selectedCompanyForInvoices.name_ar}</h3>
              <button className="btn-icon-only" onClick={() => setIsCompanyInvoicesModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '2rem', background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                <div><strong>الرقم الضريبي للمورد: </strong><code style={{ fontSize: '1rem' }}>{selectedCompanyForInvoices.tax_number}</code></div>
              </div>

              {loadingInvoices ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ width: '2rem', height: '2rem', border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>جاري تحميل سجل الفواتير والمطابقات...</span>
                </div>
              ) : companyInvoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  لا توجد أي فواتير مسجلة لهذا المورد في النظام حالياً.
                </div>
              ) : (
                <div className="table-container" style={{ margin: 0, border: '1px solid var(--border-color)' }}>
                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>رقم الفاتورة</th>
                        <th>تاريخ الفاتورة</th>
                        <th>الصنف / المادة</th>
                        <th>بند الإعفاء</th>
                        <th>المبلغ الإجمالي</th>
                        <th>الحالة</th>
                        <th>ملف الرد الضريبي (PDF)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 700 }}>{inv.invoiceNumber}</td>
                          <td>{inv.invoiceDate}</td>
                          <td>{inv.materialName}</td>
                          <td>
                            <code style={{ color: 'var(--primary)', fontWeight: 600 }}>
                              {inv.exemptionNumber ? `620/31/2/${inv.exemptionNumber}` : 'غير متوفر'}
                            </code>
                          </td>
                          <td style={{ fontWeight: 700 }}>{inv.totalAmount.toLocaleString()}</td>
                          <td>
                            <span className={`status-badge status-${inv.status}`} style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}>
                              {inv.status === 'ready' ? 'جاهزة / معتمدة' : inv.status === 'returned' ? 'مسترجعة' : 'قيد الانتظار'}
                            </span>
                          </td>
                          <td>
                            {inv.pdfDocument ? (
                              <button
                                type="button"
                                onClick={() => handleDownloadInvoicePdf(inv.pdfDocument.id, inv.pdfDocument.filename)}
                                className="btn btn-secondary"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.2rem 0.5rem',
                                  minHeight: 'auto',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  backgroundColor: '#EEF2F6',
                                  color: 'var(--primary)',
                                  borderColor: 'var(--primary-light)'
                                }}
                                title="تحميل ملف الرد الضريبي المرتبط بهذه الفاتورة"
                              >
                                <Download size={12} />
                                <span>{inv.pdfDocument.filename.substring(0, 15)}...</span>
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>غير مرفق</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsCompanyInvoicesModalOpen(false)}
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
