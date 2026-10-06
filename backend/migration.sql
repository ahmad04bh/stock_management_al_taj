-- Run this query to add the logo_path column to your brands table
-- This is required for the new brand image upload feature (Problem 1)

ALTER TABLE brands ADD COLUMN logo_path VARCHAR(500) NULL;
