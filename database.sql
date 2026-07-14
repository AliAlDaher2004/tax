-- SQL DDL to set up the database tables in Supabase for the Tax Exemption application.
-- You can run this script directly in the Supabase SQL Editor.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL UNIQUE,
    tax_number TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE companies IS 'Master data table storing companies and their tax numbers.';
COMMENT ON COLUMN companies.name_ar IS 'Arabic company name for selections.';
COMMENT ON COLUMN companies.tax_number IS 'Company tax registration number, used in Excel exports.';

-- 2. Create Materials Table
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE materials IS 'Master data table storing materials (items).';
COMMENT ON COLUMN materials.name_ar IS 'Arabic name of the material for selections.';

-- 3. Create Material Exemptions Table (Junction/Child)
CREATE TABLE IF NOT EXISTS material_exemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    exemption_number TEXT NOT NULL,
    main_item_code TEXT NOT NULL,
    UNIQUE (material_id, exemption_number, main_item_code)
);

COMMENT ON TABLE material_exemptions IS 'Stores one or more tax exemption codes and main item codes for each material.';

-- 4. Create Company Materials Table (Junction)
CREATE TABLE IF NOT EXISTS company_materials (
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    PRIMARY KEY (company_id, material_id)
);

COMMENT ON TABLE company_materials IS 'Links materials to the companies they are associated with.';

-- 5. Create Requests Table
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE requests IS 'Tracks each exported Excel request sent to the tax department.';

-- 6. Create PDF Documents Table
CREATE TABLE IF NOT EXISTS pdf_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_data TEXT NOT NULL, -- Stores base64-encoded PDF content
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE pdf_documents IS 'Stores uploaded tax department response PDFs.';

-- 7. Create Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    tax_number TEXT NOT NULL,
    main_item_code TEXT NOT NULL,
    exemption_number TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    subtotal_amount NUMERIC NOT NULL,
    total_amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'ready', 'returned', 'resubmitted'
    pdf_document_id UUID REFERENCES pdf_documents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE invoices IS 'Saves individual invoice records and tracks their lifecycle (pending, ready, returned).';

-- Add sample data if tables are empty
INSERT INTO companies (name_ar, tax_number) VALUES
('شركة ايه بي سي للتجارة', '123456789'),
('المؤسسة العامة للخدمات', '987654321')
ON CONFLICT (name_ar) DO NOTHING;

-- Let's insert a couple of materials and link them for sample validation
DO $$
DECLARE
    mat1_id UUID;
    mat2_id UUID;
    comp1_id UUID;
    comp2_id UUID;
BEGIN
    -- Get company IDs
    SELECT id INTO comp1_id FROM companies WHERE name_ar = 'شركة ايه بي سي للتجارة';
    SELECT id INTO comp2_id FROM companies WHERE name_ar = 'المؤسسة العامة للخدمات';

    -- Insert materials
    INSERT INTO materials (name_ar) VALUES ('أنابيب فولاذية (Steel Pipes)') ON CONFLICT (name_ar) DO NOTHING;
    SELECT id INTO mat1_id FROM materials WHERE name_ar = 'أنابيب فولاذية (Steel Pipes)';

    INSERT INTO materials (name_ar) VALUES ('ألواح ألومنيوم (Aluminum Sheets)') ON CONFLICT (name_ar) DO NOTHING;
    SELECT id INTO mat2_id FROM materials WHERE name_ar = 'ألواح ألومنيوم (Aluminum Sheets)';

    -- Insert exemptions if they exist
    IF mat1_id IS NOT NULL THEN
        INSERT INTO material_exemptions (material_id, exemption_number, main_item_code)
        VALUES (mat1_id, '1254', '73')
        ON CONFLICT DO NOTHING;
        
        IF comp1_id IS NOT NULL THEN
            INSERT INTO company_materials (company_id, material_id) VALUES (comp1_id, mat1_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    IF mat2_id IS NOT NULL THEN
        INSERT INTO material_exemptions (material_id, exemption_number, main_item_code)
        VALUES (mat2_id, '8471', '76')
        ON CONFLICT DO NOTHING;
        
        IF comp2_id IS NOT NULL THEN
            INSERT INTO company_materials (company_id, material_id) VALUES (comp2_id, mat2_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;

-- Disable Row-Level Security (RLS) on all tables for local development anonymous access
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_exemptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
