import ReportsService from '../services/ReportsService.js';

class ReportsController {
  /**
   * Generate and download PDF report
   * POST /api/reports/generate
   */
  async generate(req, res) {
    console.log('[ReportsController.generate] Request received', {
      hasUserId: !!req.user?.id,
      budget_code: req.body.budget_code,
      type: req.body.type,
      year: req.body.year,
      report_name: req.body.report_name,
      is_public: req.body.is_public
    });

    try {
      const { budget_code, type, year, report_name, is_public = false } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        console.log('[ReportsController.generate] No userId, returning 401');
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate required fields
      if (!budget_code || !type || !year) {
        console.log('[ReportsController.generate] Missing required fields');
        return res.status(400).json({
          error: 'budget_code, type, and year are required'
        });
      }

      // Get report options (which stats to include)
      const options = {
        includeMonthly: req.body.includeMonthly !== false,
        includeQuarterly: req.body.includeQuarterly !== false,
        includeYearly: req.body.includeYearly !== false,
        includeTop10: req.body.includeTop10 !== false,
        includeStructure: req.body.includeStructure !== false,
        includeDynamics: req.body.includeDynamics !== false,
        includeForecast: req.body.includeForecast === true,
        forecastMethods: {
          arithmeticGrowth: req.body.forecastMethods?.arithmeticGrowth === true,
          movingAverage: req.body.forecastMethods?.movingAverage === true,
          exponential: req.body.forecastMethods?.exponential === true,
          regression: req.body.forecastMethods?.regression === true,
        },
        alpha: Number(req.body.alpha) || 0.3,
        window: Number(req.body.window) || 3
      };

      console.log('[ReportsController.generate] Starting PDF generation');
      // Generate PDF
      const pdfBuffer = await ReportsService.generatePDF(budget_code, type, year, options);
      console.log('[ReportsController.generate] PDF generated, size:', pdfBuffer.length);

      // Save report metadata and upload to S3 if report_name is provided
      let report = null;
      console.log('[ReportsController.generate] Checking if report_name is provided:', {
        report_name,
        hasReportName: !!report_name,
        reportNameLength: report_name?.length
      });
      
      if (report_name) {
        console.log('[ReportsController.generate] report_name provided, attempting to save report');
        const params = {
          type,
          options,
          generated_at: new Date().toISOString()
        };
        try {
          report = await ReportsService.saveReportWithPDF(
            userId,
            budget_code,
            year,
            report_name,
            pdfBuffer,
            params,
            is_public
          );
          console.log('[ReportsController.generate] Report saved successfully:', report?.id);
        } catch (saveError) {
          console.error('[ReportsController.generate] Error saving report:', {
            message: saveError.message,
            stack: saveError.stack,
            name: saveError.name
          });
          // Continue to send PDF even if save fails
        }
      } else {
        console.log('[ReportsController.generate] No report_name provided, skipping save');
      }

      // Set response headers
      const filename = report_name 
        ? `${report_name.replace(/[^a-z0-9]/gi, '_')}.pdf`
        : `budget_report_${budget_code}_${year}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Report generation error:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }

  /**
   * Generate report and return metadata (without downloading)
   * POST /api/reports/create
   */
  async create(req, res) {
    console.log('[ReportsController.create] Request received', {
      hasUserId: !!req.user?.id,
      budget_code: req.body.budget_code,
      type: req.body.type,
      year: req.body.year,
      report_name: req.body.report_name,
      is_public: req.body.is_public
    });

    try {
      const { budget_code, type, year, report_name, is_public = false } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        console.log('[ReportsController.create] No userId, returning 401');
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!budget_code || !type || !year || !report_name) {
        console.log('[ReportsController.create] Missing required fields');
        return res.status(400).json({
          error: 'budget_code, type, year, and report_name are required'
        });
      }

      const options = {
        includeMonthly: req.body.includeMonthly !== false,
        includeQuarterly: req.body.includeQuarterly !== false,
        includeYearly: req.body.includeYearly !== false,
        includeTop10: req.body.includeTop10 !== false,
        includeStructure: req.body.includeStructure !== false,
        includeDynamics: req.body.includeDynamics !== false,
        includeForecast: req.body.includeForecast === true,
        forecastMethods: {
          arithmeticGrowth: req.body.forecastMethods?.arithmeticGrowth === true,
          movingAverage: req.body.forecastMethods?.movingAverage === true,
          exponential: req.body.forecastMethods?.exponential === true,
          regression: req.body.forecastMethods?.regression === true,
        },
        alpha: Number(req.body.alpha) || 0.3,
        window: Number(req.body.window) || 3
      };

      console.log('[ReportsController.create] Starting PDF generation');
      // Generate PDF
      const pdfBuffer = await ReportsService.generatePDF(budget_code, type, year, options);
      console.log('[ReportsController.create] PDF generated, size:', pdfBuffer.length);

      // Upload to S3 and save report metadata
      const params = {
        type,
        options,
        generated_at: new Date().toISOString()
      };

      console.log('[ReportsController.create] Attempting to save report');
      try {
        const report = await ReportsService.saveReportWithPDF(
          userId,
          budget_code,
          year,
          report_name,
          pdfBuffer,
          params,
          is_public
        );

        console.log('[ReportsController.create] Report created and saved:', report.id, 'S3 URL:', report.s3_url);

        res.json({
          message: 'Report created successfully',
          report: {
            id: report.id,
            budget_code: report.budget_code,
            year: report.year,
            report_name: report.report_name,
            s3_url: report.s3_url,
            is_public: report.is_public,
            created_at: report.created_at
          }
        });
      } catch (saveError) {
        console.error('[ReportsController.create] Error saving report:', {
          message: saveError.message,
          stack: saveError.stack,
          name: saveError.name
        });
        res.status(500).json({ 
          error: 'Report generated but failed to save. Error: ' + saveError.message 
        });
      }
    } catch (error) {
      console.error('[ReportsController.create] Report creation error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      res.status(500).json({ error: 'Failed to create report' });
    }
  }

  /**
   * Get report by ID
   * GET /api/reports/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const report = await ReportsService.getReportById(id);

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Check access: user must be owner or report must be public
      if (report.user_id !== userId && !report.is_public) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({ report });
    } catch (error) {
      console.error('Get report error:', error);
      res.status(500).json({ error: 'Failed to get report' });
    }
  }

  /**
   * Download report PDF
   * GET /api/reports/:id/download
   */
  async download(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const report = await ReportsService.getReportById(id);

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Check access
      if (report.user_id !== userId && !report.is_public) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // If report has S3 URL, try to download from S3
      if (report.s3_url && report.s3_url.trim()) {
        console.log('[ReportsController.download] Report has S3 URL:', report.s3_url);
        
        try {
          const S3Service = (await import('../services/S3Service.js')).default;
          if (S3Service.isConfigured()) {
            console.log('[ReportsController.download] S3 is configured, attempting to download from S3');
            
            // Extract key from S3 URL using the proper method
            const key = S3Service.extractKeyFromUrl(report.s3_url);
            console.log('[ReportsController.download] Extracted S3 key:', key);
            
            if (!key) {
              throw new Error('Could not extract S3 key from URL');
            }
            
            // Download file from S3 and return it directly
            // This avoids CORS and redirect issues
            console.log('[ReportsController.download] Downloading file from S3...');
            const pdfBuffer = await S3Service.downloadObject(key);
            console.log('[ReportsController.download] File downloaded from S3, size:', pdfBuffer.length);
            
            const filename = `${report.report_name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            
            console.log('[ReportsController.download] Sending PDF file to client');
            return res.send(pdfBuffer);
          } else {
            console.warn('[ReportsController.download] S3 is not configured, falling back to PDF regeneration');
          }
        } catch (error) {
          console.error('[ReportsController.download] Error downloading from S3, falling back to PDF regeneration:', {
            message: error.message,
            stack: error.stack,
            s3Url: report.s3_url
          });
          // Fall through to regenerate PDF
        }
      } else {
        console.log('[ReportsController.download] Report has no S3 URL, will regenerate PDF');
      }

      // Fallback: Regenerate PDF from saved params if S3 URL not available
      const params = typeof report.params === 'string' 
        ? JSON.parse(report.params) 
        : report.params;
      
      const options = params.options || {};
      const type = params.type || 'economic';

      const pdfBuffer = await ReportsService.generatePDF(
        report.budget_code,
        type,
        report.year,
        options
      );

      const filename = `${report.report_name.replace(/[^a-z0-9]/gi, '_')}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error) {
      console.error('Download report error:', error);
      res.status(500).json({ error: 'Failed to download report' });
    }
  }

  /**
   * Get user's reports
   * GET /api/reports/my
   */
  async getMyReports(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const reports = await ReportsService.getUserReports(userId);

      res.json({ reports });
    } catch (error) {
      console.error('Get my reports error:', error);
      res.status(500).json({ error: 'Failed to get reports' });
    }
  }

  /**
   * Get public reports
   * GET /api/reports/public
   */
  async getPublicReports(req, res) {
    try {
      const limit = Number(req.query.limit) || 50;
      const reports = await ReportsService.getPublicReports(limit);

      res.json({ reports });
    } catch (error) {
      console.error('Get public reports error:', error);
      res.status(500).json({ error: 'Failed to get public reports' });
    }
  }

  /**
   * Update report
   * PUT /api/reports/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const report = await ReportsService.getReportById(id);

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Only owner can update
      if (report.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updates = {};
      if (req.body.report_name !== undefined) {
        updates.report_name = req.body.report_name;
      }
      if (req.body.is_public !== undefined) {
        updates.is_public = req.body.is_public;
      }
      if (req.body.s3_url !== undefined) {
        updates.s3_url = req.body.s3_url;
      }

      const updatedReport = await ReportsService.updateReport(id, updates);

      res.json({
        message: 'Report updated successfully',
        report: updatedReport
      });
    } catch (error) {
      console.error('Update report error:', error);
      res.status(500).json({ error: 'Failed to update report' });
    }
  }

  /**
   * Delete report
   * DELETE /api/reports/:id
   */
  async delete(req, res) {
    console.log('[ReportsController.delete] Delete request received', {
      reportId: req.params.id,
      userId: req.user?.id
    });

    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        console.log('[ReportsController.delete] No userId, returning 401');
        return res.status(401).json({ error: 'Authentication required' });
      }

      console.log('[ReportsController.delete] Fetching report from database...');
      const report = await ReportsService.getReportById(id);

      if (!report) {
        console.log('[ReportsController.delete] Report not found:', id);
        return res.status(404).json({ error: 'Report not found' });
      }

      console.log('[ReportsController.delete] Report found:', {
        id: report.id,
        userId: report.user_id,
        reportName: report.report_name,
        hasS3Url: !!report.s3_url
      });

      // Only owner can delete
      if (report.user_id !== userId) {
        console.log('[ReportsController.delete] Access denied - user is not owner', {
          reportUserId: report.user_id,
          currentUserId: userId
        });
        return res.status(403).json({ error: 'Access denied' });
      }

      console.log('[ReportsController.delete] User is owner, proceeding with deletion...');
      await ReportsService.deleteReport(id);

      console.log('[ReportsController.delete] Report deleted successfully');
      res.json({ message: 'Report deleted successfully' });
    } catch (error) {
      console.error('[ReportsController.delete] Error deleting report:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        reportId: req.params.id
      });
      res.status(500).json({ error: 'Failed to delete report' });
    }
  }
}

export default new ReportsController();

