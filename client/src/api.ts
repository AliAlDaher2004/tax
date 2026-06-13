const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface Company {
  id?: string;
  name_ar: string;
  tax_number: string;
  created_at?: string;
}

export interface MaterialExemption {
  id?: string;
  exemption_number: string;
  main_item_code: string;
}

export interface Material {
  id?: string;
  name_ar: string;
  exemptions: MaterialExemption[];
  company_ids: string[];
  created_at?: string;
}

export interface InvoiceInput {
  invoiceNumber: string;
  invoiceDate: string;
  taxNumber: string;
  mainItemCode: string;
  exemptionNumber: string;
  quantity: number;
  subtotalAmount: number;
  totalAmount: number;
  // Local/UI helper fields only, not sent to excel backend
  id?: string; // local temporary key for keying React elements and edits
  companyId?: string;
  materialId?: string;
  companyNameAr?: string;
  materialNameAr?: string;
}

// -------------------------------------------------------------
// Companies API
// -------------------------------------------------------------
export async function getCompanies(): Promise<Company[]> {
  const response = await fetch(`${API_BASE_URL}/companies`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch companies');
  }
  return response.json();
}

export async function createCompany(company: Company): Promise<Company> {
  const response = await fetch(`${API_BASE_URL}/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(company)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create company');
  }
  return response.json();
}

export async function updateCompany(id: string, company: Company): Promise<Company> {
  const response = await fetch(`${API_BASE_URL}/companies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(company)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update company');
  }
  return response.json();
}

export async function deleteCompany(id: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/companies/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete company');
  }
  return response.json();
}

// -------------------------------------------------------------
// Materials API
// -------------------------------------------------------------
export async function getMaterials(): Promise<Material[]> {
  const response = await fetch(`${API_BASE_URL}/materials`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch materials');
  }
  return response.json();
}

export async function createMaterial(material: Material): Promise<Material> {
  const response = await fetch(`${API_BASE_URL}/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(material)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create material');
  }
  return response.json();
}

export async function updateMaterial(id: string, material: Material): Promise<Material> {
  const response = await fetch(`${API_BASE_URL}/materials/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(material)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update material');
  }
  return response.json();
}

export async function deleteMaterial(id: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/materials/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete material');
  }
  return response.json();
}

// -------------------------------------------------------------
// Export Excel API
// -------------------------------------------------------------
export async function exportToExcel(invoices: InvoiceInput[]): Promise<void> {
  // Map our UI-state invoice entries to the exact format expected by the backend ExcelJS exporter
  const payload = invoices.map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    taxNumber: inv.taxNumber,
    mainItemCode: inv.mainItemCode,
    exemptionNumber: inv.exemptionNumber,
    quantity: inv.quantity,
    subtotalAmount: inv.subtotalAmount,
    totalAmount: inv.totalAmount
  }));

  const response = await fetch(`${API_BASE_URL}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to export invoices');
  }

  // Trigger file download in the browser
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Tax_Exemption_Invoices.xlsx');
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// Download Templates API
// -------------------------------------------------------------
export async function downloadCompaniesTemplate(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/companies/template`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to download companies template');
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'companies_template.xlsx');
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function downloadMaterialsTemplate(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/materials/template`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to download materials template');
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'materials_template.xlsx');
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// Import Excel API
// -------------------------------------------------------------
export interface ImportResponse {
  success: boolean;
  message: string;
  warnings?: string[];
}

export async function importCompaniesExcel(base64File: string): Promise<ImportResponse> {
  const response = await fetch(`${API_BASE_URL}/companies/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: base64File })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to import companies');
  }
  return response.json();
}

export async function importMaterialsExcel(base64File: string): Promise<ImportResponse> {
  const response = await fetch(`${API_BASE_URL}/materials/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: base64File })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to import materials');
  }
  return response.json();
}

