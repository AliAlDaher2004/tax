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
export async function exportToExcel(invoices: InvoiceInput[], requestName?: string): Promise<void> {
  // Map our UI-state invoice entries to the exact format expected by the backend ExcelJS exporter
  const payloadInvoices = invoices.map(inv => ({
    id: inv.id, // Pass database ID if it's a resubmitted invoice
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    taxNumber: inv.taxNumber,
    mainItemCode: inv.mainItemCode,
    exemptionNumber: inv.exemptionNumber,
    quantity: inv.quantity,
    subtotalAmount: inv.subtotalAmount,
    totalAmount: inv.totalAmount,
    companyId: inv.companyId,
    materialId: inv.materialId
  }));

  const response = await fetch(`${API_BASE_URL}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoices: payloadInvoices, requestName })
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
  const safeName = requestName ? requestName.replace(/\s+/g, '_') : 'Tax_Exemption_Invoices';
  link.setAttribute('download', `${safeName}.xlsx`);
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

// -------------------------------------------------------------
// New Tax Tracking & PDF Upload APIs
// -------------------------------------------------------------

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxNumber: string;
  mainItemCode: string;
  exemptionNumber: string;
  quantity: number;
  subtotalAmount: number;
  totalAmount: number;
  status: 'pending' | 'ready' | 'returned' | 'resubmitted';
  companyId?: string;
  materialId?: string;
  companyNameAr?: string;
}

export interface TaxRequest {
  id: string;
  name: string;
  created_at: string;
  invoices: Invoice[];
  stats: {
    total: number;
    pending: number;
    ready: number;
    returned: number;
    resubmitted: number;
  };
}

export interface PdfDocument {
  id: string;
  filename: string;
  created_at: string;
}

export async function getRequests(): Promise<TaxRequest[]> {
  const response = await fetch(`${API_BASE_URL}/requests`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch tax requests');
  }
  return response.json();
}

export async function getReturnedInvoices(): Promise<InvoiceInput[]> {
  const response = await fetch(`${API_BASE_URL}/invoices/returned`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch returned invoices');
  }
  return response.json();
}

export async function uploadPdfDocument(
  filename: string | null,
  fileData: string | null,
  invoiceUpdates: { id: string; status: 'ready' | 'returned' }[]
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/pdf-documents/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, file_data: fileData, invoice_updates: invoiceUpdates })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload tax response PDF');
  }
  return response.json();
}

export async function getPdfDocuments(): Promise<PdfDocument[]> {
  const response = await fetch(`${API_BASE_URL}/pdf-documents`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch PDF documents list');
  }
  return response.json();
}

export async function downloadPdfDocument(id: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/pdf-documents/${id}/download`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to download PDF file');
  }
  const data = await response.json();
  if (!data || !data.file_data) {
    throw new Error('PDF file content is empty.');
  }

  // Convert base64 to blob and download
  const byteCharacters = atob(data.file_data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function exportReadyInvoices(requestId: string, requestName: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/requests/${requestId}/export-ready`, {
    method: 'POST'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to export ready invoices');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `جاهز_${requestName.replace(/\s+/g, '_')}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function createManualRequest(
  requestName: string,
  invoices: any[]
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/requests/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestName, invoices })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create manual request');
  }
  return response.json();
}

export async function importInvoicesRequest(
  base64File: string,
  requestName: string,
  defaultStatus: 'pending' | 'ready'
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/requests/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: base64File, requestName, defaultStatus })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to import invoices request');
  }
  return response.json();
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: 'pending' | 'ready' | 'returned' | 'resubmitted'
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update invoice status');
  }
  return response.json();
}

export async function deleteRequest(
  requestId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/requests/${requestId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete request');
  }
  return response.json();
}

export async function getCompanyInvoices(
  companyId: string
): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/companies/${companyId}/invoices`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch company invoices');
  }
  return response.json();
}

export async function deleteInvoice(
  invoiceId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete invoice');
  }
  return response.json();
}

