// src/services/SyncService.js
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class SyncService {
  /**
   * Запускає syncOpenBudget.cjs з аргументами
   * @param {number} year
   * @param {string[]} types — ['program','functional','economic'] або ['all']
   * @param {string} period — 'MONTH' або 'QUARTER'
   * @param {number|null} limit
   */
  static runOpenBudgetSync({ year, types, period, limit }) {
    return new Promise((resolve, reject) => {
      const startTime = new Date();
      const scriptPath = path.join(__dirname, '../scripts/syncOpenBudget.cjs');

      const args = [String(year)];

      // Якщо types = ['program'], period='MONTH', limit=null → args залишаються тільки [year]
      if (!(types.length === 1 && types[0] === 'program' && period === 'MONTH' && !limit)) {
        args.push(types.join(','));
        args.push(period);
        if (limit) args.push(String(limit));
      }

      console.log('[SyncService.runOpenBudgetSync] Starting sync script', {
        scriptPath,
        args,
        year,
        types: Array.isArray(types) ? types : [types],
        period,
        limit: limit || 'unlimited',
        startTime: startTime.toISOString()
      });

      const child = spawn('node', [scriptPath, ...args], {
        stdio: 'inherit', // показуватиме лог синхронізації прямо в консолі сервера
        env: process.env
      });

      child.on('exit', (code) => {
        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        
        if (code === 0) {
          console.log('[SyncService.runOpenBudgetSync] Sync script completed successfully', {
            year,
            types: Array.isArray(types) ? types : [types],
            period,
            duration: `${duration}s`,
            completedAt: endTime.toISOString(),
            exitCode: code
          });
          resolve({ success: true, message: 'Sync completed', duration });
        } else {
          console.error('[SyncService.runOpenBudgetSync] Sync script exited with error', {
            year,
            types: Array.isArray(types) ? types : [types],
            period,
            duration: `${duration}s`,
            exitCode: code,
            failedAt: endTime.toISOString()
          });
          reject(new Error(`Sync script exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        console.error('[SyncService.runOpenBudgetSync] Sync script spawn error', {
          year,
          types: Array.isArray(types) ? types : [types],
          period,
          duration: `${duration}s`,
          error: err.message,
          stack: err.stack,
          failedAt: endTime.toISOString()
        });
        reject(err);
      });
    });
  }
}
