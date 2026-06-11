import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Building2,
  Package,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial
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
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string>('');

  // Form states
  const [companyName, setCompanyName] = useState<string>('');
  const [taxNumber, setTaxNumber] = useState<string>('');

  const [materialName, setMaterialName] = useState<string>('');
  const [exemptionNumber, setExemptionNumber] = useState<string>('');
  const [mainItemCode, setMainItemCode] = useState<string>('');

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
        const data = await getMaterials();
        setMaterials(data);
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
    setExemptionNumber('');
    setMainItemCode('');
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
      setExemptionNumber(item.exemption_number);
      setMainItemCode(item.main_item_code);
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
        if (!materialName.trim() || !exemptionNumber.trim() || !mainItemCode.trim()) {
          showToast('يرجى ملء جميع الحقول المطلوبة للمادة', 'warning');
          return;
        }

        const materialPayload: Material = {
          name_ar: materialName.trim(),
          exemption_number: exemptionNumber.trim(),
          main_item_code: mainItemCode.trim()
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
      m.exemption_number.includes(searchQuery) ||
      m.main_item_code.includes(searchQuery)
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
          <div className="search-header">
            <div className="search-input-wrapper">
              <input
                type="text"
                placeholder={activeTab === 'companies' ? 'ابحث باسم الشركة أو الرقم الضريبي...' : 'ابحث باسم المادة، كود الصنف أو رقم الإعفاء...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <Search className="search-input-icon" size={18} />
            </div>

            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} />
              <span>{activeTab === 'companies' ? 'إضافة شركة' : 'إضافة صنف'}</span>
            </button>
          </div>

          {/* Loading Indicator */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
              <span style={{ color: 'var(--text-muted)' }}>جاري تحميل البيانات الأساسية...</span>
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
                            <td style={{ fontWeight: 600 }}>{company.name_ar}</td>
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
                          <th style={{ width: '40%' }}>اسم المادة (بالعربية)</th>
                          <th style={{ width: '25%' }}>رقم الإعفاء</th>
                          <th style={{ width: '20%' }}>رمز البند الرئيسي (Main Item Code)</th>
                          <th style={{ width: '15%', textAlign: 'left' }}>الخيارات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMaterials.map((material) => (
                          <tr key={material.id}>
                            <td style={{ fontWeight: 600 }}>{material.name_ar}</td>
                            <td>
                              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                                {material.exemption_number}
                              </span>
                            </td>
                            <td>
                              <span className="badge-fixed">{material.main_item_code}</span>
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
                    <div className="form-group">
                      <label className="form-label">رقم الإعفاء الضريبي (من مصلحة الضرائب) *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="مثال: 1254"
                        value={exemptionNumber}
                        onChange={(e) => setExemptionNumber(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">رمز البند الرئيسي (Main Item Code) *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="مثال: 73"
                        value={mainItemCode}
                        onChange={(e) => setMainItemCode(e.target.value)}
                        required
                      />
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
    </div>
  );
};
