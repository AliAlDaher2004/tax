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

-- Add description comments for Supabase dashboard
COMMENT ON TABLE companies IS 'Master data table storing companies and their tax numbers.';
COMMENT ON COLUMN companies.name_ar IS 'Arabic company name for selections.';
COMMENT ON COLUMN companies.tax_number IS 'Company tax registration number, used in Excel exports.';

-- 2. Create Materials Table
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL UNIQUE,
    exemption_number TEXT NOT NULL,
    main_item_code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add description comments for Supabase dashboard
COMMENT ON TABLE materials IS 'Master data table storing materials and their exemptions.';
COMMENT ON COLUMN materials.name_ar IS 'Arabic name of the material for selections.';
COMMENT ON COLUMN materials.exemption_number IS 'Exemption number, used to format the Excel export exemption value.';
COMMENT ON COLUMN materials.main_item_code IS 'Main item code (e.g. 73) exported to Excel.';

-- 3. Insert some sample data (Optional)
INSERT INTO companies (name_ar, tax_number) VALUES
('شركة ايه بي سي للتجارة', '123456789'),
('المؤسسة العامة للخدمات', '987654321')
ON CONFLICT (name_ar) DO NOTHING;

INSERT INTO materials (name_ar, exemption_number, main_item_code) VALUES
('أنابيب فولاذية (Steel Pipes)', '1254', '73'),
('ألواح ألومنيوم (Aluminum Sheets)', '8471', '76')
ON CONFLICT (name_ar) DO NOTHING;
