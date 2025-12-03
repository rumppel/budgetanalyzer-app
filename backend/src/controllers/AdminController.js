import AdminService from '../services/AdminService.js';

class AdminController {
  // ==================== USER MANAGEMENT ====================

  /**
   * Get all users
   * GET /api/admin/users
   */
  async getUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      const result = await AdminService.getAllUsers(page, limit);
      res.json(result);
    } catch (error) {
      console.error('[AdminController.getUsers] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Get user by ID
   * GET /api/admin/users/:id
   */
  async getUserById(req, res) {
    try {
      const userId = parseInt(req.params.id);
      if (!userId) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const user = await AdminService.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('[AdminController.getUserById] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Update user
   * PUT /api/admin/users/:id
   */
  async updateUser(req, res) {
    try {
      const userId = parseInt(req.params.id);
      if (!userId) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const { email, full_name, role } = req.body;
      const updates = {};

      if (email !== undefined) updates.email = email;
      if (full_name !== undefined) updates.full_name = full_name;
      if (role !== undefined) {
        if (!['user', 'admin'].includes(role)) {
          return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
        }
        updates.role = role;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const user = await AdminService.updateUser(userId, updates);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User updated successfully', user });
    } catch (error) {
      console.error('[AdminController.updateUser] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Change user password
   * PUT /api/admin/users/:id/password
   */
  async changeUserPassword(req, res) {
    try {
      const userId = parseInt(req.params.id);
      if (!userId) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }

      await AdminService.changeUserPassword(userId, password);
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('[AdminController.changeUserPassword] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Get user reports
   * GET /api/admin/users/:id/reports
   */
  async getUserReports(req, res) {
    try {
      const userId = parseInt(req.params.id);
      if (!userId) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const reports = await AdminService.getUserReports(userId);
      res.json({ reports });
    } catch (error) {
      console.error('[AdminController.getUserReports] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Delete user reports (specific or all)
   * DELETE /api/admin/users/:id/reports
   */
  async deleteUserReports(req, res) {
    try {
      const userId = parseInt(req.params.id);
      if (!userId) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const { report_ids } = req.body; // Array of report IDs to delete, or null/undefined for all

      let result;
      if (report_ids && Array.isArray(report_ids) && report_ids.length > 0) {
        // Delete specific reports
        result = await AdminService.deleteUserReports(userId, report_ids);
      } else {
        // Delete all reports
        result = await AdminService.deleteAllUserReports(userId);
      }

      res.json({
        message: `Deleted ${result.deleted} of ${result.total} reports`,
        ...result
      });
    } catch (error) {
      console.error('[AdminController.deleteUserReports] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Delete user
   * DELETE /api/admin/users/:id
   */
  async deleteUser(req, res) {
    try {
      const userId = parseInt(req.params.id);
      if (!userId) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      await AdminService.deleteUser(userId);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('[AdminController.deleteUser] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // ==================== SYNC MANAGEMENT ====================

  /**
   * Get sync results
   * GET /api/admin/sync/results
   */
  async getSyncResults(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const filters = {};

      if (req.query.endpoint) filters.endpoint = req.query.endpoint;
      if (req.query.status) filters.status = req.query.status;

      const result = await AdminService.getSyncResults(page, limit, filters);
      res.json(result);
    } catch (error) {
      console.error('[AdminController.getSyncResults] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Trigger sync
   * POST /api/admin/sync/trigger
   */
  async triggerSync(req, res) {
    const adminUserId = req.user?.id;
    const adminEmail = req.user?.email;
    
    console.log('[AdminController.triggerSync] Sync request received', {
      adminUserId,
      adminEmail,
      body: req.body
    });

    try {
      const {
        year,
        types,
        period,
        budget_code,
        region_code,
        limit
      } = req.body;

      if (!year) {
        console.log('[AdminController.triggerSync] Validation failed: year is required');
        return res.status(400).json({ error: 'Year is required' });
      }

      const options = {
        year: parseInt(year),
        types: types ? (Array.isArray(types) ? types : [types]) : ['program'],
        period: period || 'MONTH',
        budgetCode: budget_code || null,
        regionCode: region_code || null,
        limit: limit ? parseInt(limit) : null
      };

      console.log('[AdminController.triggerSync] Starting sync with options:', {
        ...options,
        requestedBy: adminEmail || adminUserId
      });

      // Start sync asynchronously
      AdminService.triggerSync(options)
        .then(() => {
          console.log('[AdminController.triggerSync] Sync completed successfully', {
            options,
            requestedBy: adminEmail || adminUserId,
            completedAt: new Date().toISOString()
          });
        })
        .catch((error) => {
          console.error('[AdminController.triggerSync] Sync error:', {
            error: error.message,
            stack: error.stack,
            options,
            requestedBy: adminEmail || adminUserId,
            failedAt: new Date().toISOString()
          });
        });

      console.log('[AdminController.triggerSync] Sync started, returning response to admin');
      res.json({
        message: 'Sync started',
        options
      });
    } catch (error) {
      console.error('[AdminController.triggerSync] Error processing sync request:', {
        error: error.message,
        stack: error.stack,
        adminUserId,
        adminEmail,
        body: req.body
      });
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // ==================== BUDGET STRUCTURE MODERATION ====================

  /**
   * Get budget structure records
   * GET /api/admin/budget-structure
   */
  async getBudgetStructure(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const filters = {};

      if (req.query.cod_budget) filters.cod_budget = req.query.cod_budget;
      if (req.query.rep_period) filters.rep_period = req.query.rep_period;
      if (req.query.cod_cons_mb_pk) filters.cod_cons_mb_pk = req.query.cod_cons_mb_pk;
      if (req.query.classification_type) filters.classification_type = req.query.classification_type;

      const result = await AdminService.getBudgetStructure(page, limit, filters);
      res.json(result);
    } catch (error) {
      console.error('[AdminController.getBudgetStructure] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Get budget structure record by ID
   * GET /api/admin/budget-structure/:id
   */
  async getBudgetStructureById(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid record ID' });
      }

      const record = await AdminService.getBudgetStructureById(id);
      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }

      res.json(record);
    } catch (error) {
      console.error('[AdminController.getBudgetStructureById] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Create budget structure record
   * POST /api/admin/budget-structure
   */
  async createBudgetStructure(req, res) {
    try {
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
      } = req.body;

      const record = await AdminService.createBudgetStructure({
        rep_period,
        fund_typ,
        cod_budget,
        cod_cons_mb_pk,
        cod_cons_mb_pk_name,
        zat_amt,
        plans_amt,
        fakt_amt,
        classification_type
      });

      res.status(201).json({
        message: 'Record created successfully',
        record
      });
    } catch (error) {
      console.error('[AdminController.createBudgetStructure] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Update budget structure record
   * PUT /api/admin/budget-structure/:id
   */
  async updateBudgetStructure(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid record ID' });
      }

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
      } = req.body;

      const updates = {};
      if (rep_period !== undefined) updates.rep_period = rep_period;
      if (fund_typ !== undefined) updates.fund_typ = fund_typ;
      if (cod_budget !== undefined) updates.cod_budget = cod_budget;
      if (cod_cons_mb_pk !== undefined) updates.cod_cons_mb_pk = cod_cons_mb_pk;
      if (cod_cons_mb_pk_name !== undefined) updates.cod_cons_mb_pk_name = cod_cons_mb_pk_name;
      if (zat_amt !== undefined) updates.zat_amt = zat_amt;
      if (plans_amt !== undefined) updates.plans_amt = plans_amt;
      if (fakt_amt !== undefined) updates.fakt_amt = fakt_amt;
      if (classification_type !== undefined) updates.classification_type = classification_type;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const record = await AdminService.updateBudgetStructure(id, updates);
      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }

      res.json({
        message: 'Record updated successfully',
        record
      });
    } catch (error) {
      console.error('[AdminController.updateBudgetStructure] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Delete budget structure record
   * DELETE /api/admin/budget-structure/:id
   */
  async deleteBudgetStructure(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid record ID' });
      }

      const record = await AdminService.deleteBudgetStructure(id);
      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }

      res.json({
        message: 'Record deleted successfully',
        record
      });
    } catch (error) {
      console.error('[AdminController.deleteBudgetStructure] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

export default new AdminController();

