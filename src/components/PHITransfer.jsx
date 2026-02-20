/**
 * PHI Data Transfer Component
 * 
 * Encrypted export/import for transferring data between devices
 * WITHOUT cloud sync (e.g., Macbook → Mac Mini)
 */

import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  Lock as LockIcon,
} from '@mui/icons-material';

export default function PHITransfer() {
  // Export state
  const [exportPassword, setExportPassword] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importPassword, setImportPassword] = useState('');
  const [importMode, setImportMode] = useState('merge');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(null);

  /**
   * Export encrypted database
   */
  const handleExport = async () => {
    if (!exportPassword || exportPassword.length < 8) {
      setExportError('Password must be at least 8 characters');
      return;
    }

    setExportLoading(true);
    setExportError('');
    setExportSuccess(false);

    try {
      const response = await fetch('http://localhost:3000/api/phi/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: exportPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Download the file
      const blob = await response.blob();
      const filename = response.headers
        .get('Content-Disposition')
        ?.match(/filename="(.+)"/)?.[1] || 'health-data-export.enc';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportSuccess(true);
      setExportPassword('');
    } catch (error) {
      console.error('Export error:', error);
      setExportError(error.message);
    } finally {
      setExportLoading(false);
    }
  };

  /**
   * Import encrypted database
   */
  const handleImport = async () => {
    if (!importFile) {
      setImportError('Please select a file');
      return;
    }

    if (!importPassword || importPassword.length < 8) {
      setImportError('Password must be at least 8 characters');
      return;
    }

    setImportLoading(true);
    setImportError('');
    setImportSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('password', importPassword);
      formData.append('mode', importMode);

      const response = await fetch('http://localhost:3000/api/phi/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setImportSuccess(result.stats);
      setImportFile(null);
      setImportPassword('');

      // Reload page after successful import to refresh data
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('Import error:', error);
      setImportError(error.message);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, margin: '0 auto', padding: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockIcon /> PHI Data Transfer
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Securely transfer your health data between devices using AES-256-GCM encryption.
        Data is encrypted with your password and can only be decrypted with the same password.
      </Alert>

      {/* EXPORT SECTION */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon /> Export Data
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Export your entire database as an encrypted file. Save the file to transfer to another device.
        </Typography>

        <TextField
          type="password"
          label="Encryption Password"
          value={exportPassword}
          onChange={(e) => setExportPassword(e.target.value)}
          fullWidth
          margin="normal"
          helperText="Minimum 8 characters. Remember this password - you'll need it to import!"
          disabled={exportLoading}
        />

        {exportError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {exportError}
          </Alert>
        )}

        {exportSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Export complete! File downloaded successfully.
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={handleExport}
          disabled={exportLoading || !exportPassword}
          startIcon={exportLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
          sx={{ mt: 2 }}
        >
          {exportLoading ? 'Exporting...' : 'Export Database'}
        </Button>
      </Paper>

      <Divider sx={{ my: 3 }} />

      {/* IMPORT SECTION */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <UploadIcon /> Import Data
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Import data from an encrypted export file. Choose merge to combine with existing data,
          or replace to overwrite everything.
        </Typography>

        <FormControl component="fieldset" sx={{ mb: 2 }}>
          <FormLabel component="legend">Import Mode</FormLabel>
          <RadioGroup
            value={importMode}
            onChange={(e) => setImportMode(e.target.value)}
          >
            <FormControlLabel
              value="merge"
              label="Merge"
              control={<Radio />}
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: -1, mb: 1 }}>
              Combine imported data with existing data (recommended)
            </Typography>

            <FormControlLabel
              value="replace"
              label="Replace"
              control={<Radio />}
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
              Delete all existing data and replace with import (⚠️ destructive)
            </Typography>
          </RadioGroup>
        </FormControl>

        <Button
          variant="outlined"
          component="label"
          fullWidth
          sx={{ mb: 2 }}
        >
          {importFile ? `Selected: ${importFile.name}` : 'Select Export File (.enc)'}
          <input
            type="file"
            hidden
            accept=".enc"
            onChange={(e) => setImportFile(e.target.files[0])}
          />
        </Button>

        <TextField
          type="password"
          label="Decryption Password"
          value={importPassword}
          onChange={(e) => setImportPassword(e.target.value)}
          fullWidth
          margin="normal"
          helperText="Enter the password you used when exporting"
          disabled={importLoading}
        />

        {importError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {importError}
          </Alert>
        )}

        {importSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              Import complete! Reloading page in 3 seconds...
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              • Inserted: {importSuccess.totalInserted} records
              • Updated: {importSuccess.totalUpdated} records
              • Skipped: {importSuccess.totalSkipped} duplicates
            </Typography>
          </Alert>
        )}

        <Button
          variant="contained"
          color="primary"
          onClick={handleImport}
          disabled={importLoading || !importFile || !importPassword}
          startIcon={importLoading ? <CircularProgress size={20} /> : <UploadIcon />}
          sx={{ mt: 2 }}
        >
          {importLoading ? 'Importing...' : 'Import Database'}
        </Button>
      </Paper>

      <Alert severity="warning" sx={{ mt: 3 }}>
        <Typography variant="body2" fontWeight="bold">
          Security Notes:
        </Typography>
        <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
          <li>Use a strong, unique password for each export</li>
          <li>Store the export file securely (encrypted USB drive, password manager)</li>
          <li>Delete the export file after successful import</li>
          <li>This is a one-time transfer, not continuous sync</li>
        </Typography>
      </Alert>
    </Box>
  );
}
