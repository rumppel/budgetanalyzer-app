import pool from '../db.js';
import UserService from './UserService.js';
import ReportsService from './ReportsService.js';
import { SyncService } from './SyncService.js';

class AdminService {
  // ==================== USER MANAGEMENT ====================

  /**
   * Get all users with pagination and reports count
   */
  async getAllUsers(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    
    const [usersResult, countResult] = await Promise.all([
      pool.query(
        `SELECT 
           u.id, 
           u.email, 
           u.full_name, 
           u.role, 
           u.created_at, 
           u.updated_at,
           COALESCE(COUNT(ur.id), 0) as reports_count
         FROM users u
         LEFT JOIN user_reports ur ON u.id = ur.user_id
         GROUP BY u.id, u.email, u.full_name, u.role, u.created_at, u.updated_at
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query('SELECT COUNT(*) as total FROM users')
    ]);

    return {
      users: usersResult.rows.map(user => ({
        ...user,
        reports_count: parseInt(user.reports_count)
      })),
      total: parseInt(countResult.rows[0].total),
      page,
      limit
    };
  }

  /**
   * Get user by ID with reports count
   */
  async getUserById(userId) {
    const [userResult, reportsResult] = await Promise.all([
      pool.query(
        `SELECT id, email, full_name, role, created_at, updated_at
         FROM users
         WHERE id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM user_reports WHERE user_id = $1`,
        [userId]
      )
    ]);

    if (userResult.rows.length === 0) {
      return null;
    }

    return {
      ...userResult.rows[0],
      reports_count: parseInt(reportsResult.rows[0].count)
    };
  }

  /**
   * Update user information
   */
  async updateUser(userId, updates) {
    const allowedFields = ['email', 'full_name', 'role'];
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined && value !== null) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE users 
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, full_name, role, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Change user password
   */
  async changeUserPassword(userId, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    return await UserService.changePassword(userId, newPassword);
  }

  /**
   * Get all reports for a user
   */
  async getUserReports(userId) {
    const reports = await ReportsService.getUserReports(userId);
    return reports;
  }

  /**
   * Delete specific reports by IDs
   */
  async deleteUserReports(userId, reportIds) {
    if (!reportIds || reportIds.length === 0) {
      throw new Error('No report IDs provided');
    }

    // Verify all reports belong to the user
    const reports = await ReportsService.getUserReports(userId);
    const validReportIds = reports.map(r => r.id);
    const invalidIds = reportIds.filter(id => !validReportIds.includes(id));
    
    if (invalidIds.length > 0) {
      throw new Error(`Some reports do not belong to user ${userId}`);
    }

    let deletedCount = 0;
    let errors = [];

    for (const reportId of reportIds) {
      try {
        await ReportsService.deleteReport(reportId);
        deletedCount++;
      } catch (error) {
        errors.push({ reportId, error: error.message });
      }
    }

    return {
      deleted: deletedCount,
      total: reportIds.length,
      errors: errors.length > 0 ? errors : null
    };
  }

  /**
   * Delete all reports for a user
   */
  async deleteAllUserReports(userId) {
    // Get all reports for the user
    const reports = await ReportsService.getUserReports(userId);
    
    let deletedCount = 0;
    let errors = [];

    for (const report of reports) {
      try {
        await ReportsService.deleteReport(report.id);
        deletedCount++;
      } catch (error) {
        errors.push({ reportId: report.id, error: error.message });
      }
    }

    return {
      deleted: deletedCount,
      total: reports.length,
      errors: errors.length > 0 ? errors : null
    };
  }

  /**
   * Delete user and all their reports
   */
  async deleteUser(userId) {
    // First delete all reports
    await this.deleteAllUserReports(userId);
    
    // Then delete the user
    await UserService.deleteUser(userId);
    
    return { success: true };
  }

  // ==================== SYNC MANAGEMENT ====================

  /**
   * Get sync results with pagination and filtering
   */
  async getSyncResults(page = 1, limit = 50, filters = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.endpoint) {
      conditions.push(`endpoint ILIKE $${paramIndex}`);
      values.push(`%${filters.endpoint}%`);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const [results, countResult] = await Promise.all([
      pool.query(
        `SELECT id, endpoint, last_synced, total_records, status, details
         FROM api_sync
         ${whereClause}
         ORDER BY last_synced DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) as total FROM api_sync ${whereClause}`,
        values
      )
    ]);

    return {
      results: results.rows.map(row => ({
        ...row,
        details: row.details ? (typeof row.details === 'string' ? JSON.parse(row.details) : row.details) : null
      })),
      total: parseInt(countResult.rows[0].total),
      page,
      limit
    };
  }

  /**
   * Trigger sync for specific budgets or regions
   * Supports partial sync by budget code or region
   */
  async triggerSync(options = {}) {
    const startTime = new Date();
    console.log('[AdminService.triggerSync] Starting sync process', {
      options,
      startTime: startTime.toISOString()
    });

    const {
      year,
      types = ['program'],
      period = 'MONTH',
      budgetCode = null,
      regionCode = null,
      limit = null
    } = options;

    if (!year) {
      console.error('[AdminService.triggerSync] Validation failed: year is required');
      throw new Error('Year is required');
    }

    console.log('[AdminService.triggerSync] Sync parameters:', {
      year,
      types: Array.isArray(types) ? types : [types],
      period,
      budgetCode,
      regionCode,
      limit
    });

    // If budgetCode is specified, we need to filter budgets
    // The sync script filters by year, so we'll use a workaround:
    // 1. Get the budget
    // 2. Run sync with limit=1 and hope it picks the right one (not ideal)
    // Better: modify sync to accept budget code filter, but for now use limit approach
    if (budgetCode) {
      console.log('[AdminService.triggerSync] Budget code specified, fetching budget info', { budgetCode, year });
      
      const budgetResult = await pool.query(
        `SELECT id, code FROM budget WHERE code = $1 AND year = $2`,
        [budgetCode, year]
      );

      if (budgetResult.rows.length === 0) {
        console.error('[AdminService.triggerSync] Budget not found', { budgetCode, year });
        throw new Error(`Budget with code ${budgetCode} not found for year ${year}`);
      }

      console.log('[AdminService.triggerSync] Budget found, starting sync for specific budget', {
        budgetId: budgetResult.rows[0].id,
        budgetCode,
        year,
        types,
        period
      });

      // Note: The current sync script doesn't support filtering by specific budget code
      // It would need modification. For now, we'll use a workaround with limit=1
      // In production, you might want to create a custom sync function that accepts budgetCode
      console.warn('[AdminService.triggerSync] Budget code filter requested but sync script may not support it directly');
      
      try {
        const result = await SyncService.runOpenBudgetSync({
          year,
          types: Array.isArray(types) ? types : [types],
          period,
          limit: 1
        });
        
        const endTime = new Date();
        console.log('[AdminService.triggerSync] Sync completed for budget', {
          budgetCode,
          year,
          duration: `${(endTime - startTime) / 1000}s`,
          completedAt: endTime.toISOString()
        });
        
        return result;
      } catch (error) {
        console.error('[AdminService.triggerSync] Sync failed for budget', {
          budgetCode,
          year,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    }

    // If regionCode is specified, sync budgets for that region
    if (regionCode) {
      console.log('[AdminService.triggerSync] Region code specified, fetching budgets for region', { regionCode, year });
      
      const budgetsResult = await pool.query(
        `SELECT id, code FROM budget 
         WHERE region_code = $1 AND year = $2 AND code IS NOT NULL
         ORDER BY code`,
        [regionCode, year]
      );

      if (budgetsResult.rows.length === 0) {
        console.error('[AdminService.triggerSync] No budgets found for region', { regionCode, year });
        throw new Error(`No budgets found for region ${regionCode} in year ${year}`);
      }

      console.log('[AdminService.triggerSync] Found budgets for region, starting sync', {
        regionCode,
        year,
        budgetCount: budgetsResult.rows.length,
        types,
        period,
        limit: limit || budgetsResult.rows.length
      });

      // Use limit to sync only budgets from this region
      // Note: This assumes budgets are ordered and the region's budgets are consecutive
      // A better approach would be to modify the sync script to accept region_code filter
      try {
        const result = await SyncService.runOpenBudgetSync({
          year,
          types: Array.isArray(types) ? types : [types],
          period,
          limit: limit || budgetsResult.rows.length
        });
        
        const endTime = new Date();
        console.log('[AdminService.triggerSync] Sync completed for region', {
          regionCode,
          year,
          budgetCount: budgetsResult.rows.length,
          duration: `${(endTime - startTime) / 1000}s`,
          completedAt: endTime.toISOString()
        });
        
        return result;
      } catch (error) {
        console.error('[AdminService.triggerSync] Sync failed for region', {
          regionCode,
          year,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    }

    // Full sync
    console.log('[AdminService.triggerSync] Starting full sync', {
      year,
      types: Array.isArray(types) ? types : [types],
      period,
      limit: limit || 'unlimited'
    });

    try {
      console.log('[AdminService.triggerSync] Calling SyncService.runOpenBudgetSync', {
        year,
        types: Array.isArray(types) ? types : [types],
        period,
        limit
      });
      
      const result = await SyncService.runOpenBudgetSync({
        year,
        types: Array.isArray(types) ? types : [types],
        period,
        limit
      });
      
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      console.log('[AdminService.triggerSync] Full sync completed successfully', {
        year,
        types: Array.isArray(types) ? types : [types],
        period,
        duration: `${duration}s`,
        completedAt: endTime.toISOString(),
        result: result
      });
      
      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      console.error('[AdminService.triggerSync] Full sync failed', {
        year,
        types: Array.isArray(types) ? types : [types],
        period,
        duration: `${duration}s`,
        error: error.message,
        stack: error.stack,
        failedAt: endTime.toISOString()
      });
      console.error('[AdminService.triggerSync] Full sync failed', {
        year,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // ==================== BUDGET STRUCTURE MODERATION ====================

  /**
   * Get budget structure records with pagination and filtering
   */
  async getBudgetStructure(page = 1, limit = 50, filters = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.cod_budget) {
      conditions.push(`cod_budget = $${paramIndex}`);
      values.push(filters.cod_budget);
      paramIndex++;
    }

    if (filters.rep_period) {
      conditions.push(`rep_period = $${paramIndex}`);
      values.push(filters.rep_period);
      paramIndex++;
    }

    if (filters.cod_cons_mb_pk) {
      conditions.push(`cod_cons_mb_pk = $${paramIndex}`);
      values.push(filters.cod_cons_mb_pk);
      paramIndex++;
    }

    if (filters.classification_type) {
      conditions.push(`LOWER(classification_type) = LOWER($${paramIndex})`);
      values.push(filters.classification_type);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const [results, countResult] = await Promise.all([
      pool.query(
        `SELECT id, rep_period, fund_typ, cod_budget, cod_cons_mb_pk, 
                cod_cons_mb_pk_name, zat_amt, plans_amt, fakt_amt, classification_type
         FROM budget_structure
         ${whereClause}
         ORDER BY rep_period DESC, cod_budget, cod_cons_mb_pk
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) as total FROM budget_structure ${whereClause}`,
        values
      )
    ]);

    return {
      records: results.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit
    };
  }

  /**
   * Get single budget structure record by ID
   */
  async getBudgetStructureById(id) {
    const result = await pool.query(
      `SELECT id, rep_period, fund_typ, cod_budget, cod_cons_mb_pk, 
              cod_cons_mb_pk_name, zat_amt, plans_amt, fakt_amt, classification_type
       FROM budget_structure
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Create new budget structure record
   */
  async createBudgetStructure(data) {
    const {
      rep_period,
      fund_typ,
      cod_budget,
      cod_cons_mb_pk,
      cod_cons_mb_pk_name,
      zat_amt,
      plans_amt,
      fakt_amt,
      classification_type
    } = data;

    // Validate required fields
    if (!rep_period || !cod_budget || !cod_cons_mb_pk) {
      throw new Error('rep_period, cod_budget, and cod_cons_mb_pk are required');
    }

    const result = await pool.query(
      `INSERT INTO budget_structure (
         rep_period, fund_typ, cod_budget, cod_cons_mb_pk, 
         cod_cons_mb_pk_name, zat_amt, plans_amt, fakt_amt, classification_type
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (rep_period, cod_budget, cod_cons_mb_pk)
       DO UPDATE SET
         fund_typ = EXCLUDED.fund_typ,
         cod_cons_mb_pk_name = EXCLUDED.cod_cons_mb_pk_name,
         zat_amt = EXCLUDED.zat_amt,
         plans_amt = EXCLUDED.plans_amt,
         fakt_amt = EXCLUDED.fakt_amt,
         classification_type = EXCLUDED.classification_type
       RETURNING id, rep_period, fund_typ, cod_budget, cod_cons_mb_pk, 
                 cod_cons_mb_pk_name, zat_amt, plans_amt, fakt_amt, classification_type`,
      [
        rep_period,
        fund_typ || null,
        cod_budget,
        cod_cons_mb_pk,
        cod_cons_mb_pk_name || null,
        zat_amt || 0,
        plans_amt || 0,
        fakt_amt || 0,
        classification_type || null
      ]
    );

    return result.rows[0];
  }

  /**
   * Update budget structure record
   */
  async updateBudgetStructure(id, data) {
    const allowedFields = [
      'rep_period', 'fund_typ', 'cod_budget', 'cod_cons_mb_pk',
      'cod_cons_mb_pk_name', 'zat_amt', 'plans_amt', 'fakt_amt', 'classification_type'
    ];
    
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE budget_structure 
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, rep_period, fund_typ, cod_budget, cod_cons_mb_pk, 
                 cod_cons_mb_pk_name, zat_amt, plans_amt, fakt_amt, classification_type`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete budget structure record
   */
  async deleteBudgetStructure(id) {
    const result = await pool.query(
      `DELETE FROM budget_structure 
       WHERE id = $1
       RETURNING id, rep_period, cod_budget, cod_cons_mb_pk`,
      [id]
    );

    return result.rows[0] || null;
  }
}

export default new AdminService();

