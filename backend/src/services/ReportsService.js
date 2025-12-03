import PDFDocument from 'pdfkit';
import pool from '../db.js';
import StructureStatsService from './StructureStatsService.js';
import ForecastService from './ForecastService.js';
import S3Service from './S3Service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReportsService {
  /**
   * Generate PDF report with selected statistics and forecast
   */
  async generatePDF(budgetCode, type, year, options = {}) {
    const {
      includeMonthly = true,
      includeQuarterly = true,
      includeYearly = true,
      includeTop10 = true,
      includeStructure = true,
      includeDynamics = true,
      includeForecast = false,
      forecastMethods = {}, // { arithmeticGrowth: true, movingAverage: true, exponential: true, regression: true }
      alpha = 0.3,
      window = 3
    } = options;

    // Create PDF document
    const doc = new PDFDocument({ 
      margin: 50,
      autoFirstPage: true,
      bufferPages: true,
      size: 'A4'
    });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {});

    // Register Cyrillic font if available
    let useCyrillicFont = false;
    try {
      const fontPath = path.join(__dirname, '../../fonts/DejaVuSans.ttf');
      if (fs.existsSync(fontPath)) {
        doc.registerFont('Cyrillic', fontPath);
        useCyrillicFont = true;
        console.log('[generatePDF] Cyrillic font registered successfully:', fontPath);
      } else {
        console.warn('[generatePDF] Cyrillic font file not found:', fontPath);
      }
    } catch (error) {
      console.warn('[generatePDF] Could not load Cyrillic font, using default:', error.message);
    }

    // Helper function to set font (Cyrillic if available, otherwise default)
    const setFont = (fontName = 'Helvetica', size = null) => {
      if (useCyrillicFont && (fontName === 'Helvetica' || fontName === 'Helvetica-Bold')) {
        doc.font('Cyrillic');
      } else {
        doc.font(fontName);
      }
      if (size) {
        doc.fontSize(size);
      }
    };

    // Helper function to format numbers with proper spacing
    const formatNumber = (num) => {
      if (num === null || num === undefined || isNaN(num)) return '0.00';
      const formatted = new Intl.NumberFormat('uk-UA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
      // Add spaces for thousands separator
      return formatted.replace(/\s/g, ' ');
    };

    // Helper function to format large numbers (abbreviated)
    const formatLargeNumber = (num) => {
      if (num === null || num === undefined || isNaN(num)) return '0';
      if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + ' млрд';
      } else if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + ' млн';
      } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + ' тис';
      }
      return formatNumber(num);
    };

    // Helper function to add text with Cyrillic support
    // Using UTF-8 encoding - PDFKit should handle it if font supports it
    const addText = (text, x, y, options = {}) => {
      if (x !== undefined && y !== undefined) {
        doc.text(String(text), x, y, options);
      } else {
        doc.text(String(text), options);
      }
    };

    // Helper function to check if we need a new page
    const checkPageBreak = (requiredHeight = 50) => {
      const currentY = doc.y;
      const pageHeight = doc.page.height;
      const bottomMargin = 50;
      
      // Only add new page if we actually need it and there's content on current page
      // Check if current position + required height exceeds page, and we're not at the very top
      if (currentY + requiredHeight > pageHeight - bottomMargin && currentY > 100) {
        doc.addPage();
        return 50;
      }
      return currentY;
    };

    // Helper function to draw a table with proper column widths
    const drawTable = (headers, rows, startX, startY, columnWidths) => {
      let currentY = checkPageBreak(rows.length * 20 + 30);
      if (currentY === 50) startY = 50;
      else startY = currentY;

      const rowHeight = 18;
      const headerHeight = 25;
      const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

      // Draw header with colored background
      doc.rect(startX, startY, totalWidth, headerHeight)
         .fillColor('#f3e8ff') // Light purple background from styles.css
         .fill()
         .strokeColor('#e5e7eb')
         .lineWidth(1)
         .stroke();
      
      setFont('Helvetica-Bold', 10);
      doc.fillColor('#4c1d95'); // Purple text
      let currentX = startX + 8; // Padding
      headers.forEach((header, index) => {
        addText(header, currentX, startY + 7, { width: columnWidths[index] - 16, align: 'left' });
        currentX += columnWidths[index];
      });
      
      currentY = startY + headerHeight;
      setFont('Helvetica', 9);
      doc.fillColor('#111827'); // Dark text

      // Draw rows with alternating background
      rows.forEach((row, rowIndex) => {
        currentY = checkPageBreak(rowHeight);
        if (currentY === 50) {
          // Redraw header on new page
          doc.rect(startX, currentY, totalWidth, headerHeight)
             .fillColor('#f3e8ff')
             .fill()
             .strokeColor('#e5e7eb')
             .lineWidth(1)
             .stroke();
          
          setFont('Helvetica-Bold', 10);
          doc.fillColor('#4c1d95');
          currentX = startX + 8;
          headers.forEach((header, index) => {
            addText(header, currentX, currentY + 7, { width: columnWidths[index] - 16, align: 'left' });
            currentX += columnWidths[index];
          });
          currentY += headerHeight;
          setFont('Helvetica', 9);
          doc.fillColor('#111827');
        }

        // Alternating row background
        if (rowIndex % 2 === 0) {
          doc.rect(startX, currentY, totalWidth, rowHeight)
             .fillColor('#ffffff')
             .fill();
        } else {
          doc.rect(startX, currentY, totalWidth, rowHeight)
             .fillColor('#f9fafb')
             .fill();
        }
        
        // Draw row border
        doc.rect(startX, currentY, totalWidth, rowHeight)
           .strokeColor('#e5e7eb')
           .lineWidth(0.5)
           .stroke();

        // Ensure text color is set before drawing
        setFont('Helvetica', 9);
        doc.fillColor('#111827'); // Dark text - ensure it's set
        
        currentX = startX + 8; // Padding
        row.forEach((cell, cellIndex) => {
          const cellText = String(cell || '');
          // Truncate if too long, but don't truncate first column (usually numbers/IDs)
          const maxWidth = columnWidths[cellIndex] - 16;
          const textWidth = doc.widthOfString(cellText);
          let displayText = cellText;
          // Don't truncate first column (index 0) - it's usually numbers/IDs
          if (cellIndex > 0 && textWidth > maxWidth - 10) {
            // Truncate text to fit
            let truncated = cellText;
            while (doc.widthOfString(truncated + '...') > maxWidth - 10 && truncated.length > 0) {
              truncated = truncated.slice(0, -1);
            }
            displayText = truncated + (truncated.length < cellText.length ? '...' : '');
          }
          // Ensure text color is set for each cell
          doc.fillColor('#111827');
          addText(displayText, currentX, currentY + 4, { width: maxWidth, align: 'left' });
          currentX += columnWidths[cellIndex];
        });
        currentY += rowHeight;
      });

      return currentY + 15; // Extra spacing after table
    };

    // Helper function to draw a simple bar chart
    const drawBarChart = (data, x, y, width, height, labelKey, valueKey, title) => {
      if (!data || data.length === 0) return y;
      
      let currentY = checkPageBreak(height + 50);
      if (currentY === 50) y = 50;
      else y = currentY;

      const maxValue = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
      const barWidth = Math.max((width - 40) / data.length, 15);
      const chartHeight = height - 50;
      const startY = y + 30;
      const startX = x + 20;
      
      // Title
      setFont('Helvetica-Bold', 12);
      addText(title, x, y);
      setFont('Helvetica');
      
      // Draw bars
      data.forEach((item, index) => {
        const value = Number(item[valueKey]) || 0;
        const barHeight = (value / maxValue) * chartHeight;
        const barX = startX + (index * barWidth);
        const barY = startY + chartHeight - barHeight;
        
        // Draw bar
        doc.rect(barX, barY, barWidth - 5, barHeight)
           .fill('#7c3aed');
        
        // Value label on top of bar (abbreviated)
        if (barHeight > 20) {
          setFont('Helvetica', 7);
          doc.fillColor('#000000');
          const valueText = formatLargeNumber(value);
          const textWidth = doc.widthOfString(valueText);
          addText(valueText, barX + (barWidth - 5) / 2 - textWidth / 2, barY - 10);
        }
      });
      
      // X-axis labels
      setFont('Helvetica', 7);
      data.forEach((item, index) => {
        const label = String(item[labelKey] || '').substring(0, 8);
        const barX = startX + (index * barWidth);
        addText(label, barX, startY + chartHeight + 5, {
          width: barWidth - 5,
          align: 'center'
        });
      });
      
      doc.fillColor('#000000'); // Reset color
      return startY + chartHeight + 25;
    };

    // Helper function to draw a line chart
    const drawLineChart = (data, x, y, width, height, labelKey, valueKey, title) => {
      if (!data || data.length === 0) return y;
      
      let currentY = checkPageBreak(height + 50);
      if (currentY === 50) y = 50;
      else y = currentY;

      const values = data.map(d => Number(d[valueKey]) || 0);
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const range = maxValue - minValue || 1;
      const chartHeight = height - 50;
      const chartWidth = width - 60;
      const startX = x + 30;
      const startY = y + 30;
      const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;
      
      // Title
      setFont('Helvetica-Bold', 12);
      addText(title, x, y);
      setFont('Helvetica');
      
      // Draw axes
      doc.strokeColor('#000000');
      doc.lineWidth(1);
      doc.moveTo(startX, startY)
         .lineTo(startX, startY + chartHeight)
         .lineTo(startX + chartWidth, startY + chartHeight)
         .stroke();
      
      // Draw grid lines and values
      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const value = minValue + (range * i / gridLines);
        const gridY = startY + chartHeight - (i / gridLines) * chartHeight;
        doc.moveTo(startX - 5, gridY)
           .lineTo(startX, gridY)
           .stroke();
        setFont('Helvetica', 7);
        addText(formatLargeNumber(value), startX - 35, gridY - 4, { width: 30, align: 'right' });
      }
      
      // Draw line and points
      doc.strokeColor('#7c3aed');
      doc.fillColor('#7c3aed');
      doc.lineWidth(2);
      
      let prevX = null, prevY = null;
      data.forEach((item, index) => {
        const value = Number(item[valueKey]) || 0;
        const pointX = startX + (index * stepX);
        const pointY = startY + chartHeight - ((value - minValue) / range) * chartHeight;
        
        // Draw point
        doc.circle(pointX, pointY, 3).fill();
        
        // Draw line
        if (prevX !== null) {
          doc.moveTo(prevX, prevY)
             .lineTo(pointX, pointY)
             .stroke();
        }
        
        prevX = pointX;
        prevY = pointY;
      });
      
      // X-axis labels
      setFont('Helvetica', 7);
      doc.fillColor('#000000');
      data.forEach((item, index) => {
        const label = String(item[labelKey] || '').substring(0, 8);
        const labelX = startX + (index * stepX);
        addText(label, labelX - 20, startY + chartHeight + 5, { width: 40, align: 'center' });
      });
      
      return startY + chartHeight + 25;
    };

    // Helper function to draw forecast chart with historical data and forecasts
    const drawForecastChart = (series, methods, x, y, width, height) => {
      if (!series || series.length === 0) return y;
      
      let currentY = checkPageBreak(height + 50);
      if (currentY === 50) y = 50;
      else y = currentY;

      // Prepare data points: historical + forecast year
      const allYears = [...series.map(s => s.year)];
      const lastYear = allYears[allYears.length - 1];
      const forecastYear = lastYear + 1;
      allYears.push(forecastYear);

      // Collect all values (historical + forecasts) to determine scale
      const historicalValues = series.map(s => s.value);
      const forecastValues = [];
      
      // Get forecast values for each method
      const methodForecasts = {};
      if (methods.arithmeticGrowth && methods.arithmeticGrowth.forecastValue !== null) {
        methodForecasts.arithmeticGrowth = methods.arithmeticGrowth.forecastValue;
        forecastValues.push(methods.arithmeticGrowth.forecastValue);
      }
      if (methods.movingAverage && methods.movingAverage.forecastValue !== null) {
        methodForecasts.movingAverage = methods.movingAverage.forecastValue;
        forecastValues.push(methods.movingAverage.forecastValue);
      }
      if (methods.exponential && methods.exponential.forecastValue !== null) {
        methodForecasts.exponential = methods.exponential.forecastValue;
        forecastValues.push(methods.exponential.forecastValue);
      }
      if (methods.regression && methods.regression.forecastValue !== null) {
        methodForecasts.regression = methods.regression.forecastValue;
        forecastValues.push(methods.regression.forecastValue);
      }

      const allValues = [...historicalValues, ...forecastValues];
      const maxValue = Math.max(...allValues);
      const minValue = Math.min(...allValues);
      const range = maxValue - minValue || 1;
      const chartHeight = height - 50;
      const chartWidth = width - 60;
      const startX = x + 30;
      const startY = y + 30;
      const stepX = allYears.length > 1 ? chartWidth / (allYears.length - 1) : 0;
      
      // Title
      setFont('Helvetica-Bold', 12);
      addText('Графік прогнозу', x, y);
      setFont('Helvetica', 8);
      addText('(синя - фактичні дані, кольорові - прогнози)', x, y + 12);
      setFont('Helvetica');
      
      // Draw axes
      doc.strokeColor('#000000');
      doc.lineWidth(1);
      doc.moveTo(startX, startY)
         .lineTo(startX, startY + chartHeight)
         .lineTo(startX + chartWidth, startY + chartHeight)
         .stroke();
      
      // Draw vertical line to separate historical from forecast
      const forecastStartX = startX + (series.length - 1) * stepX;
      doc.strokeColor('#cccccc');
      doc.lineWidth(1);
      doc.dash(5, { space: 5 });
      doc.moveTo(forecastStartX, startY)
         .lineTo(forecastStartX, startY + chartHeight)
         .stroke();
      doc.undash(); // Reset dash
      
      // Draw grid lines and values
      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const value = minValue + (range * i / gridLines);
        const gridY = startY + chartHeight - (i / gridLines) * chartHeight;
        doc.strokeColor('#000000');
        doc.moveTo(startX - 5, gridY)
           .lineTo(startX, gridY)
           .stroke();
        setFont('Helvetica', 7);
        addText(formatLargeNumber(value), startX - 35, gridY - 4, { width: 30, align: 'right' });
      }
      
      // Draw historical data line (blue)
      doc.strokeColor('#2563eb');
      doc.fillColor('#2563eb');
      doc.lineWidth(2);
      
      let prevX = null, prevY = null;
      series.forEach((item, index) => {
        const value = item.value;
        const pointX = startX + (index * stepX);
        const pointY = startY + chartHeight - ((value - minValue) / range) * chartHeight;
        
        // Draw point
        doc.circle(pointX, pointY, 3).fill();
        
        // Draw line
        if (prevX !== null) {
          doc.moveTo(prevX, prevY)
             .lineTo(pointX, pointY)
             .stroke();
        }
        
        prevX = pointX;
        prevY = pointY;
      });
      
      // Draw forecast lines for each method
      const forecastColors = {
        arithmeticGrowth: '#dc2626', // red
        movingAverage: '#16a34a',   // green
        exponential: '#ea580c',      // orange
        regression: '#9333ea'       // purple
      };
      
      const forecastLabels = {
        arithmeticGrowth: 'Середній темп',
        movingAverage: 'Ковзне середнє',
        exponential: 'Експоненційне',
        regression: 'Регресія'
      };
      
      Object.keys(methodForecasts).forEach((methodKey, methodIndex) => {
        const forecastValue = methodForecasts[methodKey];
        const color = forecastColors[methodKey] || '#7c3aed';
        const label = forecastLabels[methodKey] || methodKey;
        const method = methods[methodKey];
        
        // Calculate forecast point position
        const forecastX = startX + (series.length) * stepX;
        const forecastY = startY + chartHeight - ((forecastValue - minValue) / range) * chartHeight;
        
        // For regression, draw trend line through historical data and extend to forecast
        if (methodKey === 'regression' && method.trend && method.trend.length > 0) {
          doc.strokeColor(color);
          doc.fillColor(color);
          doc.lineWidth(1.5);
          doc.dash(3, { space: 3 });
          
          let trendPrevX = null, trendPrevY = null;
          method.trend.forEach((trendPoint, trendIndex) => {
            const trendX = startX + (trendIndex * stepX);
            const trendY = startY + chartHeight - ((trendPoint.value - minValue) / range) * chartHeight;
            
            if (trendPrevX !== null) {
              doc.moveTo(trendPrevX, trendPrevY)
                 .lineTo(trendX, trendY)
                 .stroke();
            }
            
            trendPrevX = trendX;
            trendPrevY = trendY;
          });
          
          // Extend trend line from last trend point to forecast point
          if (trendPrevX !== null && trendPrevY !== null) {
            doc.moveTo(trendPrevX, trendPrevY)
               .lineTo(forecastX, forecastY)
               .stroke();
          }
          
          doc.undash();
          
          // Draw forecast point
          doc.circle(forecastX, forecastY, 3).fill();
        } else {
          // For other methods, draw line from last historical point to forecast point
          const lastHistoricalX = startX + (series.length - 1) * stepX;
          const lastHistoricalY = startY + chartHeight - ((series[series.length - 1].value - minValue) / range) * chartHeight;
          
          // Draw forecast line (dashed)
          doc.strokeColor(color);
          doc.fillColor(color);
          doc.lineWidth(2);
          doc.dash(5, { space: 5 });
          doc.moveTo(lastHistoricalX, lastHistoricalY)
             .lineTo(forecastX, forecastY)
             .stroke();
          doc.undash();
          
          // Draw forecast point
          doc.circle(forecastX, forecastY, 3).fill();
        }
      });
      
      // Draw legend below the chart (instead of labels near points)
      const legendY = startY + chartHeight + 25;
      const legendStartX = startX;
      const legendItemWidth = 100;
      let legendX = legendStartX;
      
      setFont('Helvetica', 7);
      doc.fillColor('#000000');
      
      // Historical data legend
      doc.strokeColor('#2563eb');
      doc.fillColor('#2563eb');
      doc.lineWidth(2);
      doc.moveTo(legendX, legendY)
         .lineTo(legendX + 20, legendY)
         .stroke();
      doc.circle(legendX + 10, legendY, 2).fill();
      doc.fillColor('#000000');
      addText('Фактичні дані', legendX + 25, legendY - 5, { width: 70, align: 'left' });
      legendX += 120;
      
      // Forecast methods legend
      Object.keys(methodForecasts).forEach((methodKey) => {
        const color = forecastColors[methodKey] || '#7c3aed';
        const label = forecastLabels[methodKey] || methodKey;
        
        doc.strokeColor(color);
        doc.fillColor(color);
        doc.lineWidth(2);
        doc.dash(5, { space: 5 });
        doc.moveTo(legendX, legendY)
           .lineTo(legendX + 20, legendY)
           .stroke();
        doc.undash();
        doc.circle(legendX + 10, legendY, 2).fill();
        doc.fillColor('#000000');
        addText(label, legendX + 25, legendY - 5, { width: 75, align: 'left' });
        legendX += 110;
        
        // Move to next line if we run out of space
        if (legendX > startX + chartWidth - 100) {
          legendX = legendStartX;
          legendY += 15;
        }
      });
      
      // X-axis labels
      setFont('Helvetica', 7);
      doc.fillColor('#000000');
      allYears.forEach((year, index) => {
        const labelX = startX + (index * stepX);
        const isForecast = index >= series.length;
        setFont('Helvetica-Bold', isForecast ? 7 : 7);
        addText(String(year), labelX - 15, startY + chartHeight + 5, { width: 30, align: 'center' });
        if (isForecast) {
          setFont('Helvetica', 6);
          addText('прогноз', labelX - 15, startY + chartHeight + 15, { width: 30, align: 'center' });
        }
      });
      
      // Calculate return Y based on legend height
      const legendHeight = Math.ceil(Object.keys(methodForecasts).length / 3) * 15 + 10;
      return Math.max(startY + chartHeight + 35, legendY + legendHeight);
    };

    // Get budget name from database
    let budgetName = null;
    try {
      const budgetResult = await pool.query(
        `SELECT name FROM community WHERE code = $1 LIMIT 1`,
        [budgetCode]
      );
      if (budgetResult.rows.length > 0) {
        budgetName = budgetResult.rows[0].name;
      }
    } catch (error) {
      console.warn('[generatePDF] Could not fetch budget name:', error.message);
    }

    // Header with styled design
    let currentY = checkPageBreak(150);
    doc.y = currentY;
    
    // Main title with color
    setFont('Helvetica-Bold', 24);
    doc.fillColor('#4c1d95'); // Primary purple from styles.css
    addText('Звіт про бюджет', { align: 'center' });
    doc.moveDown(1);
    
    // Info box with background - calculate height dynamically
    const infoBoxY = doc.y;
    const infoBoxPadding = 12;
    const infoBoxLineHeight = 15;
    let infoBoxHeight = infoBoxPadding * 2; // Top and bottom padding
    let infoY = infoBoxY + infoBoxPadding;
    
    // Count number of lines
    let lineCount = 0;
    if (budgetName) lineCount++;
    lineCount += 4; // Код бюджету, Тип класифікації, Рік, Дата створення
    
    infoBoxHeight += lineCount * infoBoxLineHeight;
    
    // Draw background box
    doc.rect(50, infoBoxY, 500, infoBoxHeight)
       .fillColor('#faf5ff') // Light purple background
       .fill()
       .strokeColor('#e5e7eb')
       .lineWidth(1)
       .stroke();
    
    doc.fillColor('#111827'); // Dark text
    setFont('Helvetica', 11);
    
    if (budgetName) {
      setFont('Helvetica-Bold', 11);
      doc.fillColor('#4c1d95');
      addText('Назва бюджету:', 60, infoY);
      setFont('Helvetica', 11);
      doc.fillColor('#111827');
      addText(budgetName, 180, infoY);
      infoY += infoBoxLineHeight;
    }
    
    setFont('Helvetica-Bold', 11);
    doc.fillColor('#4c1d95');
    addText('Код бюджету:', 60, infoY);
    setFont('Helvetica', 11);
    doc.fillColor('#111827');
    addText(budgetCode, 180, infoY);
    infoY += infoBoxLineHeight;
    
    setFont('Helvetica-Bold', 11);
    doc.fillColor('#4c1d95');
    addText('Тип класифікації:', 60, infoY);
    setFont('Helvetica', 11);
    doc.fillColor('#111827');
    addText(type, 180, infoY);
    infoY += infoBoxLineHeight;
    
    setFont('Helvetica-Bold', 11);
    doc.fillColor('#4c1d95');
    addText('Рік:', 60, infoY);
    setFont('Helvetica', 11);
    doc.fillColor('#111827');
    addText(year, 180, infoY);
    infoY += infoBoxLineHeight;
    
    setFont('Helvetica-Bold', 11);
    doc.fillColor('#4c1d95');
    addText('Дата створення:', 60, infoY);
    setFont('Helvetica', 11);
    doc.fillColor('#111827');
    addText(new Date().toLocaleDateString('uk-UA'), 180, infoY);
    
    doc.y = infoBoxY + infoBoxHeight + 10;
    doc.moveDown(2);

    // Fetch statistics based on selected options
    const stats = {};

    if (includeMonthly) {
      stats.monthly = await StructureStatsService.monthly(budgetCode, type, year);
    }
    if (includeQuarterly) {
      stats.quarterly = await StructureStatsService.quarterly(budgetCode, type, year);
    }
    if (includeYearly) {
      // Use last month for each code (like StructureService)
      // Apply the same logic: if plans_amt = 0 or NULL, use zat_amt
      const yearlyResult = await pool.query(`
        WITH last_periods AS (
          SELECT DISTINCT ON (cod_cons_mb_pk)
            cod_cons_mb_pk,
            rep_period
          FROM budget_structure
          WHERE cod_budget = $1
            AND LOWER(classification_type) = LOWER($2)
            AND SUBSTRING(rep_period FROM 4 FOR 4) = $3
          ORDER BY cod_cons_mb_pk, rep_period DESC
        ),
        structure_data AS (
          SELECT
            bs.zat_amt,
            bs.plans_amt,
            bs.fakt_amt,
            CASE 
              WHEN bs.plans_amt = 0 OR bs.plans_amt IS NULL THEN bs.zat_amt 
              ELSE bs.plans_amt 
            END AS plan_final
          FROM last_periods lp
          JOIN budget_structure bs
            ON bs.cod_cons_mb_pk = lp.cod_cons_mb_pk
           AND bs.rep_period = lp.rep_period
           AND bs.cod_budget = $1
           AND LOWER(bs.classification_type) = LOWER($2)
        )
        SELECT
          SUM(zat_amt) AS zat,
          SUM(plan_final) AS plan,
          SUM(fakt_amt) AS fact,
          CASE 
            WHEN SUM(plan_final) > 0 
            THEN ROUND((SUM(fakt_amt) / SUM(plan_final)) * 100, 2)
            ELSE 0
          END AS execution_percent
        FROM structure_data
      `, [budgetCode, type, year]);
      
      if (yearlyResult.rows[0]) {
        const result = yearlyResult.rows[0];
        stats.yearly = {
          zat: Number(result.zat || 0),
          plan: Number(result.plan || 0),
          fact: Number(result.fact || 0),
          execution_percent: result.execution_percent ? Number(result.execution_percent) : null
        };
      }
    }
    if (includeTop10) {
      // Use last month for each code (like StructureService)
      const top10Result = await pool.query(`
        WITH last_periods AS (
          SELECT DISTINCT ON (cod_cons_mb_pk)
            cod_cons_mb_pk,
            rep_period
          FROM budget_structure
          WHERE cod_budget = $1
            AND LOWER(classification_type) = LOWER($2)
            AND SUBSTRING(rep_period FROM 4 FOR 4) = $3
          ORDER BY cod_cons_mb_pk, rep_period DESC
        )
        SELECT
          bs.cod_cons_mb_pk AS code,
          bs.cod_cons_mb_pk_name AS name,
          SUM(bs.fakt_amt) AS total
        FROM last_periods lp
        JOIN budget_structure bs
          ON bs.cod_cons_mb_pk = lp.cod_cons_mb_pk
         AND bs.rep_period = lp.rep_period
         AND bs.cod_budget = $1
         AND LOWER(bs.classification_type) = LOWER($2)
        GROUP BY bs.cod_cons_mb_pk, bs.cod_cons_mb_pk_name
        ORDER BY total DESC
        LIMIT 10
      `, [budgetCode, type, year]);
      
      stats.top10 = top10Result.rows.map(r => ({
        code: r.code,
        name: r.name,
        total: Number(r.total || 0)
      }));
    }
    if (includeStructure) {
      // Use last month for each code (like StructureService)
      const structureResult = await pool.query(`
        WITH last_periods AS (
          SELECT DISTINCT ON (cod_cons_mb_pk)
            cod_cons_mb_pk,
            rep_period
          FROM budget_structure
          WHERE cod_budget = $1
            AND LOWER(classification_type) = LOWER($2)
            AND SUBSTRING(rep_period FROM 4 FOR 4) = $3
          ORDER BY cod_cons_mb_pk, rep_period DESC
        ),
        base AS (
          SELECT
            bs.cod_cons_mb_pk AS code,
            bs.cod_cons_mb_pk_name AS name,
            SUM(bs.fakt_amt) AS fact
          FROM last_periods lp
          JOIN budget_structure bs
            ON bs.cod_cons_mb_pk = lp.cod_cons_mb_pk
           AND bs.rep_period = lp.rep_period
           AND bs.cod_budget = $1
           AND LOWER(bs.classification_type) = LOWER($2)
          GROUP BY bs.cod_cons_mb_pk, bs.cod_cons_mb_pk_name
        ),
        sorted AS (
          SELECT *
          FROM base
          ORDER BY fact DESC
        ),
        top10 AS (
          SELECT * FROM sorted LIMIT 10
        ),
        other AS (
          SELECT 
            'other' AS code,
            'Інше' AS name,
            SUM(fact) AS fact
          FROM sorted OFFSET 10
        ),
        combined AS (
          SELECT * FROM top10
          UNION ALL
          SELECT * FROM other WHERE fact > 0
        ),
        total AS (
          SELECT SUM(fact) AS total_fact FROM combined
        )
        SELECT
          code,
          name,
          fact,
          ROUND(fact * 100.0 / NULLIF((SELECT total_fact FROM total), 0), 2)::numeric AS percent
        FROM combined
        ORDER BY fact DESC
      `, [budgetCode, type, year]);
      
      stats.structure = structureResult.rows.map(r => ({
        code: r.code,
        name: r.name,
        fact: Number(r.fact),
        percent: Number(r.percent)
      }));
    }
    if (includeDynamics) {
      stats.dynamics = await StructureStatsService.dynamics(budgetCode, type);
    }

    // Fetch forecast using ForecastService directly
    let forecast = null;
    if (includeForecast && Object.values(forecastMethods).some(v => v === true)) {
      try {
        const forecastResult = await ForecastService.forecast(budgetCode, type, { alpha, window });
        if (forecastResult && forecastResult.methods) {
          // Filter methods based on selection
          const selectedMethods = {};
          if (forecastMethods.arithmeticGrowth && forecastResult.methods.arithmeticGrowth) {
            selectedMethods.arithmeticGrowth = forecastResult.methods.arithmeticGrowth;
          }
          if (forecastMethods.movingAverage && forecastResult.methods.movingAverage) {
            selectedMethods.movingAverage = forecastResult.methods.movingAverage;
          }
          if (forecastMethods.exponential && forecastResult.methods.exponential) {
            selectedMethods.exponential = forecastResult.methods.exponential;
          }
          if (forecastMethods.regression && forecastResult.methods.regression) {
            selectedMethods.regression = forecastResult.methods.regression;
          }
          
          if (Object.keys(selectedMethods).length > 0) {
            forecast = {
              series: forecastResult.series,
              methods: selectedMethods
            };
          }
        }
      } catch (error) {
        console.error('Forecast calculation error:', error);
      }
    }

    // 1. Yearly Summary
    if (stats.yearly) {
      currentY = checkPageBreak(150);
      
      // Section header with colored background
      const sectionHeaderY = currentY;
      doc.rect(50, sectionHeaderY, 500, 25)
         .fillColor('#4c1d95')
         .fill();
      
      setFont('Helvetica-Bold', 16);
      doc.fillColor('#ffffff');
      addText('Річна статистика', 60, sectionHeaderY + 6);
      doc.fillColor('#111827');
      
      currentY = sectionHeaderY + 35;
      doc.y = currentY;
      
      // Summary cards
      const cardY = currentY;
      const cardHeight = 90;
      const cardWidth = 240;
      const gap = 20;
      
      // Card 1: Plans
      doc.rect(50, cardY, cardWidth, cardHeight)
         .fillColor('#faf5ff')
         .fill()
         .strokeColor('#e5e7eb')
         .lineWidth(1)
         .stroke();
      
      let cardTextY = cardY + 12;
      setFont('Helvetica-Bold', 10);
      doc.fillColor('#6d28d9');
      addText('Плани', 60, cardTextY);
      cardTextY += 15;
      
      setFont('Helvetica', 9);
      doc.fillColor('#111827');
      if (stats.yearly.zat && stats.yearly.zat > 0) {
        addText('Затверджений:', 60, cardTextY);
        setFont('Helvetica-Bold', 9);
        addText(formatNumber(stats.yearly.zat) + ' грн', 60, cardTextY + 12);
        cardTextY += 25;
      }
      if (stats.yearly.plan && stats.yearly.plan > 0) {
        setFont('Helvetica', 9);
        addText('Уточнений:', 60, cardTextY);
        setFont('Helvetica-Bold', 9);
        addText(formatNumber(stats.yearly.plan) + ' грн', 60, cardTextY + 12);
      }
      
      // Card 2: Fact and Execution
      doc.rect(50 + cardWidth + gap, cardY, cardWidth, cardHeight)
         .fillColor('#faf5ff')
         .fill()
         .strokeColor('#e5e7eb')
         .lineWidth(1)
         .stroke();
      
      cardTextY = cardY + 12;
      setFont('Helvetica-Bold', 10);
      doc.fillColor('#6d28d9');
      addText('Виконання', 60 + cardWidth + gap, cardTextY);
      cardTextY += 15;
      
      setFont('Helvetica', 9);
      doc.fillColor('#111827');
      addText('Фактичні витрати:', 60 + cardWidth + gap, cardTextY);
      setFont('Helvetica-Bold', 9);
      addText(formatNumber(stats.yearly.fact) + ' грн', 60 + cardWidth + gap, cardTextY + 12);
      cardTextY += 25;
      
      if (stats.yearly.execution_percent !== null) {
        setFont('Helvetica', 9);
        addText('Виконання плану:', 60 + cardWidth + gap, cardTextY);
        setFont('Helvetica-Bold', 11);
        doc.fillColor('#7c3aed');
        addText(formatNumber(stats.yearly.execution_percent) + '%', 60 + cardWidth + gap, cardTextY + 12);
      }
      
      doc.y = cardY + cardHeight + 20;
      doc.moveDown(1);
      currentY = doc.y;
    }

    // 2. Monthly Statistics with Chart
    if (stats.monthly && stats.monthly.length > 0) {
      currentY = checkPageBreak(300);
      
      // Section header
      const sectionHeaderY = currentY;
      doc.rect(50, sectionHeaderY, 500, 25)
         .fillColor('#4c1d95')
         .fill();
      
      setFont('Helvetica-Bold', 16);
      doc.fillColor('#ffffff');
      addText('Помісячна статистика', 60, sectionHeaderY + 6);
      doc.fillColor('#111827');
      
      currentY = sectionHeaderY + 35;
      doc.y = currentY;
      
      // Draw chart
      currentY = drawBarChart(
        stats.monthly,
        50,
        currentY,
        500,
        200,
        'rep_period',
        'fact',
        'Помісячні фактичні видатки'
      );
      
      // Table
      const monthlyHeaders = ['Період', 'План', 'Факт'];
      const monthlyRows = stats.monthly.map(row => [
        row.rep_period || '-',
        formatNumber(row.plan),
        formatNumber(row.fact)
      ]);
      const monthlyColumnWidths = [120, 150, 150];
      
      currentY = drawTable(monthlyHeaders, monthlyRows, 50, currentY, monthlyColumnWidths);
      doc.moveDown(1);
      currentY = doc.y;
    }

    // 3. Quarterly Statistics with Chart
    if (stats.quarterly && stats.quarterly.length > 0) {
      currentY = checkPageBreak(300);
      
      // Section header
      const sectionHeaderY = currentY;
      doc.rect(50, sectionHeaderY, 500, 25)
         .fillColor('#4c1d95')
         .fill();
      
      setFont('Helvetica-Bold', 16);
      doc.fillColor('#ffffff');
      addText('Поквартальна статистика', 60, sectionHeaderY + 6);
      doc.fillColor('#111827');
      
      currentY = sectionHeaderY + 35;
      doc.y = currentY;
      
      // Draw chart
      currentY = drawBarChart(
        stats.quarterly,
        50,
        currentY,
        500,
        200,
        'quarter',
        'fact',
        'Поквартальні фактичні видатки'
      );
      
      // Table
      const quarterlyHeaders = ['Квартал', 'План', 'Факт'];
      const quarterlyRows = stats.quarterly.map(row => [
        row.quarter || '-',
        formatNumber(row.plan),
        formatNumber(row.fact)
      ]);
      const quarterlyColumnWidths = [120, 150, 150];
      
      currentY = drawTable(quarterlyHeaders, quarterlyRows, 50, currentY, quarterlyColumnWidths);
      doc.moveDown(1);
      currentY = doc.y;
    }

    // 4. Top 10 Codes
    if (stats.top10 && stats.top10.length > 0) {
      currentY = checkPageBreak(320);
      
      // Section header
      const sectionHeaderY = currentY;
      doc.rect(50, sectionHeaderY, 500, 25)
         .fillColor('#4c1d95')
         .fill();
      
      setFont('Helvetica-Bold', 16);
      doc.fillColor('#ffffff');
      addText('ТОП-10 кодів за фактичними видатками', 60, sectionHeaderY + 6);
      doc.fillColor('#111827');
      
      currentY = sectionHeaderY + 35;
      doc.y = currentY;
      
      // Draw chart
      currentY = drawBarChart(
        stats.top10.slice(0, 10),
        50,
        currentY,
        500,
        250,
        'code',
        'total',
        'ТОП-10 за видатками'
      );
      
      // Table
      const top10Headers = ['№', 'Код', 'Назва', 'Сума'];
      const top10Rows = stats.top10.map((row, index) => [
        String(index + 1),
        row.code || '-',
        (row.name || '-').substring(0, 40),
        formatNumber(row.total)
      ]);
      const top10ColumnWidths = [40, 80, 240, 120]; // Increased № column width from 30 to 40
      
      currentY = drawTable(top10Headers, top10Rows, 50, currentY, top10ColumnWidths);
      doc.moveDown(1);
      currentY = doc.y;
    }

    // 5. Structure (Percentage) with Chart
    if (stats.structure && stats.structure.length > 0) {
      currentY = checkPageBreak(320);
      
      // Section header
      const sectionHeaderY = currentY;
      doc.rect(50, sectionHeaderY, 500, 25)
         .fillColor('#4c1d95')
         .fill();
      
      setFont('Helvetica-Bold', 16);
      doc.fillColor('#ffffff');
      addText('Структура видатків (%)', 60, sectionHeaderY + 6);
      doc.fillColor('#111827');
      
      currentY = sectionHeaderY + 35;
      doc.y = currentY;
      
      // Draw chart
      currentY = drawBarChart(
        stats.structure.slice(0, 10),
        50,
        currentY,
        500,
        200,
        'code',
        'percent',
        'Структура за відсотками'
      );
      
      // Table
      const structureHeaders = ['Код', 'Назва', 'Сума', '%'];
      const structureRows = stats.structure.map(row => [
        row.code || '-',
        (row.name || '-').substring(0, 30),
        formatNumber(row.fact),
        formatNumber(row.percent) + '%'
      ]);
      const structureColumnWidths = [80, 200, 120, 80];
      
      currentY = drawTable(structureHeaders, structureRows, 50, currentY, structureColumnWidths);
      doc.moveDown(1);
      currentY = doc.y;
    }

    // 6. Dynamics with Chart
    if (stats.dynamics && stats.dynamics.length > 0) {
      currentY = checkPageBreak(320);
      
      // Section header
      const sectionHeaderY = currentY;
      doc.rect(50, sectionHeaderY, 500, 25)
         .fillColor('#4c1d95')
         .fill();
      
      setFont('Helvetica-Bold', 16);
      doc.fillColor('#ffffff');
      addText('Динаміка за роками', 60, sectionHeaderY + 6);
      doc.fillColor('#111827');
      
      currentY = sectionHeaderY + 35;
      doc.y = currentY;
      
      // Draw line chart
      currentY = drawLineChart(
        stats.dynamics,
        50,
        currentY,
        500,
        250,
        'year',
        'fact',
        'Динаміка видатків за роками'
      );
      
      // Table
      const dynamicsHeaders = ['Рік', 'Факт'];
      const dynamicsRows = stats.dynamics.map(row => [
        String(row.year),
        formatNumber(row.fact)
      ]);
      const dynamicsColumnWidths = [100, 200];
      
      currentY = drawTable(dynamicsHeaders, dynamicsRows, 50, currentY, dynamicsColumnWidths);
      doc.moveDown(1);
      currentY = doc.y;
    }

    // 7. Forecast
    if (forecast && forecast.methods && Object.keys(forecast.methods).length > 0) {
      currentY = checkPageBreak(370);
      
      // Section header
      const sectionHeaderY = currentY;
      doc.rect(50, sectionHeaderY, 500, 25)
         .fillColor('#4c1d95')
         .fill();
      
      setFont('Helvetica-Bold', 16);
      doc.fillColor('#ffffff');
      addText('Прогноз на наступний рік', 60, sectionHeaderY + 6);
      doc.fillColor('#111827');
      
      currentY = sectionHeaderY + 35;
      doc.y = currentY;
      
      // Draw forecast chart with historical data and forecasts
      if (forecast.series && forecast.series.length > 0) {
        currentY = drawForecastChart(
          forecast.series,
          forecast.methods,
          50,
          currentY,
          500,
          280
        );
        doc.moveDown(1);
        currentY = doc.y;
      }
      
      // Forecast method details with styled boxes
      const textWidth = 450;
      const textX = 50;
      const methodBoxPadding = 12;
      const methodBoxGap = 20; // Increased gap between methods
      const lineHeight = 15;
      
      if (forecast.methods.arithmeticGrowth && forecast.methods.arithmeticGrowth.forecastValue !== null) {
        const f = forecast.methods.arithmeticGrowth;
        
        // Calculate box height dynamically
        let boxHeight = methodBoxPadding * 2; // Top and bottom padding
        boxHeight += lineHeight; // Title
        boxHeight += lineHeight; // "Прогноз на ..."
        boxHeight += lineHeight; // Forecast value
        if (f.avgRate !== null && f.avgRate !== undefined) {
          boxHeight += lineHeight; // Additional info line
        }
        boxHeight += 5; // Extra bottom padding
        
        currentY = checkPageBreak(boxHeight + methodBoxGap);
        const boxStartY = currentY;
        
        // Method box
        doc.rect(textX, boxStartY, textWidth, boxHeight)
           .fillColor('#faf5ff')
           .fill()
           .strokeColor('#e5e7eb')
           .lineWidth(1)
           .stroke();
        
        let textY = boxStartY + methodBoxPadding;
        setFont('Helvetica-Bold', 12);
        doc.fillColor('#6d28d9');
        addText('Метод середнього темпу приросту', textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        setFont('Helvetica', 11);
        doc.fillColor('#111827');
        addText(`Прогноз на ${f.forecastYear}:`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        setFont('Helvetica-Bold', 11);
        doc.fillColor('#7c3aed');
        addText(`${formatNumber(f.forecastValue)} грн`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        if (f.avgRate !== null && f.avgRate !== undefined) {
          setFont('Helvetica', 9);
          doc.fillColor('#6b7280');
          addText(`Середній темп приросту: ${(f.avgRate * 100).toFixed(2)}%`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        }
        
        currentY = boxStartY + boxHeight + methodBoxGap;
      }
      
      if (forecast.methods.movingAverage && forecast.methods.movingAverage.forecastValue !== null) {
        const f = forecast.methods.movingAverage;
        
        // Calculate box height dynamically
        let boxHeight = methodBoxPadding * 2;
        boxHeight += lineHeight; // Title
        boxHeight += lineHeight; // "Прогноз на ..."
        boxHeight += lineHeight; // Forecast value
        if (f.window) {
          boxHeight += lineHeight; // Additional info line
        }
        boxHeight += 5; // Extra bottom padding
        
        currentY = checkPageBreak(boxHeight + methodBoxGap);
        const boxStartY = currentY;
        
        doc.rect(textX, boxStartY, textWidth, boxHeight)
           .fillColor('#faf5ff')
           .fill()
           .strokeColor('#e5e7eb')
           .lineWidth(1)
           .stroke();
        
        let textY = boxStartY + methodBoxPadding;
        setFont('Helvetica-Bold', 12);
        doc.fillColor('#6d28d9');
        addText('Метод ковзного середнього', textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        setFont('Helvetica', 11);
        doc.fillColor('#111827');
        addText(`Прогноз на ${f.forecastYear}:`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        setFont('Helvetica-Bold', 11);
        doc.fillColor('#7c3aed');
        addText(`${formatNumber(f.forecastValue)} грн`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        if (f.window) {
          setFont('Helvetica', 9);
          doc.fillColor('#6b7280');
          addText(`Вікно: ${f.window} років`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        }
        
        currentY = boxStartY + boxHeight + methodBoxGap;
      }
      
      if (forecast.methods.exponential && forecast.methods.exponential.forecastValue !== null) {
        const f = forecast.methods.exponential;
        
        // Calculate box height dynamically
        let boxHeight = methodBoxPadding * 2;
        boxHeight += lineHeight; // Title
        boxHeight += lineHeight; // "Прогноз на ..."
        boxHeight += lineHeight; // Forecast value
        if (f.alpha !== null && f.alpha !== undefined) {
          boxHeight += lineHeight; // Additional info line
        }
        boxHeight += 5; // Extra bottom padding
        
        currentY = checkPageBreak(boxHeight + methodBoxGap);
        const boxStartY = currentY;
        
        doc.rect(textX, boxStartY, textWidth, boxHeight)
           .fillColor('#faf5ff')
           .fill()
           .strokeColor('#e5e7eb')
           .lineWidth(1)
           .stroke();
        
        let textY = boxStartY + methodBoxPadding;
        setFont('Helvetica-Bold', 12);
        doc.fillColor('#6d28d9');
        addText('Експоненційне згладжування', textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        setFont('Helvetica', 11);
        doc.fillColor('#111827');
        addText(`Прогноз на ${f.forecastYear}:`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        setFont('Helvetica-Bold', 11);
        doc.fillColor('#7c3aed');
        addText(`${formatNumber(f.forecastValue)} грн`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        if (f.alpha !== null && f.alpha !== undefined) {
          setFont('Helvetica', 9);
          doc.fillColor('#6b7280');
          addText(`Alpha: ${f.alpha}`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        }
        
        currentY = boxStartY + boxHeight + methodBoxGap;
      }
      
      if (forecast.methods.regression && forecast.methods.regression.forecastValue !== null) {
        const f = forecast.methods.regression;
        
        // Calculate box height dynamically
        let boxHeight = methodBoxPadding * 2;
        boxHeight += lineHeight; // Title
        boxHeight += lineHeight; // "Прогноз на ..."
        boxHeight += lineHeight; // Forecast value
        if (f.b !== null && f.b !== undefined) {
          boxHeight += lineHeight; // Additional info line
        }
        boxHeight += 5; // Extra bottom padding
        
        currentY = checkPageBreak(boxHeight + methodBoxGap);
        const boxStartY = currentY;
        
        doc.rect(textX, boxStartY, textWidth, boxHeight)
           .fillColor('#faf5ff')
           .fill()
           .strokeColor('#e5e7eb')
           .lineWidth(1)
           .stroke();
        
        let textY = boxStartY + methodBoxPadding;
        setFont('Helvetica-Bold', 12);
        doc.fillColor('#6d28d9');
        addText('Лінійна регресія', textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        setFont('Helvetica', 11);
        doc.fillColor('#111827');
        addText(`Прогноз на ${f.forecastYear}:`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        setFont('Helvetica-Bold', 11);
        doc.fillColor('#7c3aed');
        addText(`${formatNumber(f.forecastValue)} грн`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        textY += lineHeight;
        
        if (f.b !== null && f.b !== undefined) {
          setFont('Helvetica', 9);
          doc.fillColor('#6b7280');
          addText(`Коефіцієнт тренду: ${f.b.toFixed(4)}`, textX + methodBoxPadding, textY, { width: textWidth - methodBoxPadding * 2, align: 'left' });
        }
        
        currentY = boxStartY + boxHeight + methodBoxGap;
      }
      
      doc.y = currentY;
      
      doc.moveDown(2);
      currentY = doc.y;
    }

    // Flush all buffered pages before adding footer
    doc.flushPages();
    
    // Footer on all pages
    // Note: PDFKit may create empty pages, but we'll add footer only to pages with content
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      setFont('Helvetica', 8);
      addText(
        'Згенеровано системою OpenBudget',
        50,
        doc.page.height - 50,
        { align: 'center', width: doc.page.width - 100 }
      );
    }

    doc.end();

    // Wait for PDF to be generated
    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
    });
  }

  /**
   * Upload PDF to S3 and save report metadata to database
   * Requires S3 to be configured and upload to succeed
   */
  async saveReportWithPDF(userId, budgetCode, year, reportName, pdfBuffer, params, isPublic = false) {
    console.log('[saveReportWithPDF] Starting save process', {
      userId,
      budgetCode,
      year,
      reportName,
      pdfBufferSize: pdfBuffer?.length,
      isPublic
    });

    // Check if S3 is configured
    if (!S3Service.isConfigured()) {
      const errorMsg = 'S3 is not configured. Please configure AWS credentials and bucket name.';
      console.error('[saveReportWithPDF]', errorMsg, {
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        hasBucket: !!process.env.AWS_S3_BUCKET_NAME
      });
      throw new Error(errorMsg);
    }

    // Generate a temporary report ID for the S3 key (we'll use timestamp-based ID)
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const filename = `${reportName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    const key = S3Service.generateReportKey(userId, tempId, filename);
    
    // First, upload to S3
    let s3Url;
    try {
      console.log('[saveReportWithPDF] S3 is configured, uploading to S3 first...');
      console.log('[saveReportWithPDF] Generated S3 key:', key);
      console.log('[saveReportWithPDF] Uploading PDF to S3, buffer size:', pdfBuffer.length);
      
      // Upload PDF to S3
      s3Url = await S3Service.uploadPDF(pdfBuffer, key);
      console.log('[saveReportWithPDF] PDF uploaded to S3 successfully:', s3Url);
    } catch (error) {
      console.error('[saveReportWithPDF] Error uploading to S3:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      });
      throw new Error(`Failed to upload PDF to S3: ${error.message}`);
    }

    // Only save to database after successful S3 upload
    console.log('[saveReportWithPDF] S3 upload successful, saving report to database...');
    try {
      const dbParams = [userId, budgetCode, year, reportName, s3Url, JSON.stringify(params), isPublic];
      console.log('[saveReportWithPDF] Database query params:', {
        userId: dbParams[0],
        budgetCode: dbParams[1],
        year: dbParams[2],
        reportName: dbParams[3],
        s3Url: dbParams[4],
        paramsLength: dbParams[5]?.length,
        isPublic: dbParams[6]
      });

      const result = await pool.query(
        `INSERT INTO user_reports (user_id, budget_code, year, report_name, s3_url, params, is_public, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, user_id, budget_code, year, report_name, s3_url, params, is_public, created_at`,
        dbParams
      );

      const report = result.rows[0];
      console.log('[saveReportWithPDF] Report saved to database successfully:', {
        id: report.id,
        userId: report.user_id,
        budgetCode: report.budget_code,
        year: report.year,
        reportName: report.report_name,
        s3Url: report.s3_url,
        isPublic: report.is_public,
        createdAt: report.created_at
      });
      
      // Optionally, we could update the S3 key with the real report ID
      // But for now, we'll keep the temp ID in the key since it works fine
      
      return report;
    } catch (error) {
      console.error('[saveReportWithPDF] Error saving report to database after S3 upload:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position
      });
      
      // If DB save fails, we should ideally delete the file from S3
      // But for now, we'll just throw the error - the file will remain in S3
      // In production, you might want to implement cleanup logic
      console.warn('[saveReportWithPDF] Warning: S3 file uploaded but DB save failed. S3 file may need cleanup:', s3Url);
      
      throw new Error(`Failed to save report to database: ${error.message}`);
    }
  }

  /**
   * Save report metadata to database (without S3 upload)
   */
  async saveReport(userId, budgetCode, year, reportName, params, s3Url = '', isPublic = false) {
    const result = await pool.query(
      `INSERT INTO user_reports (user_id, budget_code, year, report_name, s3_url, params, is_public, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, user_id, budget_code, year, report_name, s3_url, params, is_public, created_at`,
      [userId, budgetCode, year, reportName, s3Url || '', JSON.stringify(params), isPublic]
    );

    return result.rows[0];
  }

  /**
   * Get report by ID
   */
  async getReportById(reportId) {
    const result = await pool.query(
      `SELECT id, user_id, budget_code, year, report_name, s3_url, params, is_public, created_at
       FROM user_reports
       WHERE id = $1`,
      [reportId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all reports for a user
   */
  async getUserReports(userId) {
    const result = await pool.query(
      `SELECT id, user_id, budget_code, year, report_name, s3_url, params, is_public, created_at
       FROM user_reports
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get public reports
   */
  async getPublicReports(limit = 50) {
    const result = await pool.query(
      `SELECT id, user_id, budget_code, year, report_name, s3_url, params, is_public, created_at
       FROM user_reports
       WHERE is_public = true
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Update report
   */
  async updateReport(reportId, updates) {
    const allowedFields = ['report_name', 's3_url', 'is_public', 'params'];
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        if (key === 'params') {
          fields.push(`${key} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(reportId);

    const result = await pool.query(
      `UPDATE user_reports 
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, user_id, budget_code, year, report_name, s3_url, params, is_public, created_at`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete report and its S3 file if exists
   */
  async deleteReport(reportId) {
    console.log('[deleteReport] Starting deletion process for report:', reportId);
    
    // First, get the report to check if it has S3 URL
    const report = await this.getReportById(reportId);
    
    if (!report) {
      console.log('[deleteReport] Report not found:', reportId);
      throw new Error('Report not found');
    }

    // Delete from S3 if URL exists
    if (report.s3_url && report.s3_url.trim()) {
      try {
        console.log('[deleteReport] Report has S3 URL, attempting to delete from S3:', report.s3_url);
        const s3Key = S3Service.extractKeyFromUrl(report.s3_url);
        
        if (s3Key && S3Service.isConfigured()) {
          await S3Service.deleteObject(s3Key);
          console.log('[deleteReport] File deleted from S3 successfully');
        } else {
          console.warn('[deleteReport] Could not extract S3 key or S3 not configured, skipping S3 deletion');
        }
      } catch (error) {
        console.error('[deleteReport] Error deleting from S3, continuing with DB deletion:', {
          message: error.message,
          stack: error.stack
        });
        // Continue with DB deletion even if S3 deletion fails
      }
    } else {
      console.log('[deleteReport] Report has no S3 URL, skipping S3 deletion');
    }

    // Delete from database
    await pool.query('DELETE FROM user_reports WHERE id = $1', [reportId]);
    console.log('[deleteReport] Report deleted from database successfully');
  }
}

export default new ReportsService();
