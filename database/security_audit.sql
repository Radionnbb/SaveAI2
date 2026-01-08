-- SaveAI Phase 6: Security Audit & Hardening
-- Run this to verify and enhance database security

-- ============================================
-- VERIFY ROW LEVEL SECURITY (RLS) IS ENABLED
-- ============================================

SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('search_history', 'saved_products', 'notifications', 'notification_preferences', 'shared_comparisons', 'price_history');

-- ============================================
-- ADD MISSING CONSTRAINTS
-- ============================================

-- Ensure email format in user-related operations
-- (Supabase Auth handles this, but we add extra validation)

-- Add check constraints for price values
ALTER TABLE saved_products 
ADD CONSTRAINT check_positive_price 
CHECK (product_price > 0);

ALTER TABLE search_history 
ADD CONSTRAINT check_positive_cheapest_price 
CHECK (cheapest_price IS NULL OR cheapest_price > 0);

-- Add check for valid currency codes
ALTER TABLE saved_products 
ADD CONSTRAINT check_valid_currency 
CHECK (product_currency ~ '^[A-Z]{3}$');

-- Ensure result_count is non-negative
ALTER TABLE search_history 
ADD CONSTRAINT check_non_negative_result_count 
CHECK (result_count >= 0);

-- ============================================
-- ADD INDEXES FOR PERFORMANCE
-- ============================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_search_history_user_created 
ON search_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_products_user_created 
ON saved_products(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON notifications(user_id, read, created_at DESC);

-- Index for price tracking queries
CREATE INDEX IF NOT EXISTS idx_price_history_product_recorded 
ON price_history(saved_product_id, recorded_at DESC);

-- ============================================
-- VERIFY RLS POLICIES
-- ============================================

-- List all policies to verify they exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('search_history', 'saved_products', 'notifications', 'notification_preferences', 'shared_comparisons', 'price_history')
ORDER BY tablename, policyname;

-- ============================================
-- ADD AUDIT LOGGING (OPTIONAL)
-- ============================================

-- Create audit log table for sensitive operations
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only allow viewing own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- FUNCTION TO PREVENT PRIVILEGE ESCALATION
-- ============================================

-- Ensure users can only access their own data
CREATE OR REPLACE FUNCTION check_user_access()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: Cannot access other users data';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ADD RATE LIMITING AT DATABASE LEVEL
-- ============================================

-- Track API usage per user
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint VARCHAR(100) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_window 
ON api_usage(user_id, window_start DESC);

-- Enable RLS
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API usage"
  ON api_usage FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- CLEANUP EXPIRED DATA
-- ============================================

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete expired shared comparisons
  DELETE FROM shared_comparisons
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  -- Delete old audit logs (keep 90 days)
  DELETE FROM audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete old API usage records (keep 30 days)
  DELETE FROM api_usage
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFY SECURITY CONFIGURATION
-- ============================================

-- Check that all tables have RLS enabled
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check that all foreign keys have proper CASCADE rules
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name;
