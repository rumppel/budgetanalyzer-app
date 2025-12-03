import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

class S3Service {
  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'openbudget-reports';
  }

  /**
   * Upload PDF buffer to S3
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @param {string} key - S3 object key (path)
   * @param {string} contentType - Content type (default: application/pdf)
   * @returns {Promise<string>} S3 URL of the uploaded file
   */
  async uploadPDF(pdfBuffer, key, contentType = 'application/pdf') {
    console.log('[S3Service.uploadPDF] Starting upload', {
      bucketName: this.bucketName,
      key,
      bufferSize: pdfBuffer?.length,
      contentType,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: pdfBuffer,
        ContentType: contentType,
        // Make files publicly readable if needed (or use presigned URLs)
        // ACL: 'public-read',
      });

      console.log('[S3Service.uploadPDF] Sending PutObjectCommand...');
      await this.s3Client.send(command);
      console.log('[S3Service.uploadPDF] Upload successful');

      // Return the S3 URL
      const region = process.env.AWS_REGION || 'us-east-1';
      // Handle different S3 URL formats
      let url;
      if (region === 'us-east-1') {
        // us-east-1 uses a different URL format
        url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      } else {
        url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
      }
      console.log('[S3Service.uploadPDF] Generated S3 URL:', url);
      return url;
    } catch (error) {
      console.error('[S3Service.uploadPDF] Upload error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        $metadata: error.$metadata,
        requestId: error.$metadata?.requestId
      });
      throw new Error(`Failed to upload PDF to S3: ${error.message}`);
    }
  }

  /**
   * Download object from S3 and return as buffer
   * @param {string} key - S3 object key
   * @returns {Promise<Buffer>} File buffer
   */
  async downloadObject(key) {
    console.log('[S3Service.downloadObject] Downloading object', {
      bucketName: this.bucketName,
      key
    });

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      console.log('[S3Service.downloadObject] Sending GetObjectCommand...');
      const response = await this.s3Client.send(command);
      
      // Convert stream to buffer
      // AWS SDK v3 returns Body as a stream
      const chunks = [];
      const stream = response.Body;
      
      // Handle Readable stream
      if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      } else if (stream && typeof stream.transformToByteArray === 'function') {
        // Handle Blob-like objects
        const data = await stream.transformToByteArray();
        chunks.push(Buffer.from(data));
      } else {
        throw new Error('Unsupported stream type from S3');
      }
      
      const buffer = Buffer.concat(chunks);
      
      console.log('[S3Service.downloadObject] Object downloaded successfully, size:', buffer.length);
      return buffer;
    } catch (error) {
      console.error('[S3Service.downloadObject] Download error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        key,
        bucketName: this.bucketName
      });
      throw new Error(`Failed to download object from S3: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for private S3 objects
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} Presigned URL
   */
  async getPresignedUrl(key, expiresIn = 3600) {
    console.log('[S3Service.getPresignedUrl] Generating presigned URL', {
      bucketName: this.bucketName,
      key,
      expiresIn,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      console.log('[S3Service.getPresignedUrl] Sending GetObjectCommand...');
      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      console.log('[S3Service.getPresignedUrl] Presigned URL generated successfully');
      return url;
    } catch (error) {
      console.error('[S3Service.getPresignedUrl] Error generating presigned URL:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        key,
        bucketName: this.bucketName
      });
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Delete object from S3
   * @param {string} key - S3 object key
   * @returns {Promise<void>}
   */
  async deleteObject(key) {
    console.log('[S3Service.deleteObject] Starting deletion', {
      bucketName: this.bucketName,
      key
    });

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      console.log('[S3Service.deleteObject] Object deleted successfully:', key);
    } catch (error) {
      console.error('[S3Service.deleteObject] Delete error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        $metadata: error.$metadata
      });
      throw new Error(`Failed to delete object from S3: ${error.message}`);
    }
  }

  /**
   * Extract S3 key from S3 URL
   * @param {string} s3Url - Full S3 URL
   * @returns {string} S3 key
   */
  extractKeyFromUrl(s3Url) {
    if (!s3Url || !s3Url.trim()) {
      return null;
    }
    
    try {
      // Handle different S3 URL formats:
      // https://bucket.s3.amazonaws.com/key
      // https://bucket.s3.region.amazonaws.com/key
      const url = new URL(s3Url);
      // Remove leading slash from pathname
      return url.pathname.substring(1);
    } catch (error) {
      console.error('[S3Service.extractKeyFromUrl] Error parsing URL:', s3Url, error);
      return null;
    }
  }

  /**
   * Generate S3 key for a report
   * @param {number} userId - User ID
   * @param {string} reportId - Report ID
   * @param {string} filename - Original filename
   * @returns {string} S3 key
   */
  generateReportKey(userId, reportId, filename) {
    const sanitizedFilename = filename.replace(/[^a-z0-9._-]/gi, '_');
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `reports/${userId}/${timestamp}/${reportId}_${sanitizedFilename}`;
  }

  /**
   * Check if S3 is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET_NAME
    );
  }
}

export default new S3Service();

