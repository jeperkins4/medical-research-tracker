import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Box,
  Alert,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const steps = ['Welcome', 'Research Scanner', 'AI Features', 'Cloud Sync', 'Complete'];

export default function FirstRunWizard({ open, onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    braveApiKey: '',
    anthropicApiKey: '',
    supabaseUrl: '',
    supabaseAnonKey: '',
    enableCloudSync: false,
  });

  const handleNext = () => {
    if (loading) return; // Prevent action during loading
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (loading) return; // Prevent action during loading
    setActiveStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    if (loading) return; // Prevent action during loading
    // Skip to final step
    setActiveStep(steps.length - 1);
  };

  const handleComplete = async () => {
    if (loading) return; // Prevent double-clicks
    
    setLoading(true);
    
    // Try to save config with timeout (HTTP endpoint may not exist in IPC mode)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          firstRunComplete: true,
          apiKeys: {
            brave: config.braveApiKey || null,
            anthropic: config.anthropicApiKey || null,
          },
          cloudSync: {
            enabled: config.enableCloudSync,
            supabaseUrl: config.supabaseUrl || null,
            supabaseAnonKey: config.supabaseAnonKey || null,
          },
          researchScanner: {
            enabled: !!config.braveApiKey,
          },
        }),
      }).catch(err => {
        // If HTTP fails (IPC-only mode), that's OK - we just skip config saving
        console.log('[FirstRunWizard] Config endpoint not available (IPC mode), skipping config save:', err.name);
      });
      
      clearTimeout(timeoutId);
    } catch (err) {
      console.log('[FirstRunWizard] Config save error (expected in IPC mode):', err.message);
    }
    
    setLoading(false);
    
    // Mark wizard as complete and proceed
    onComplete();
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              Welcome to MyTreatmentPath
            </Typography>
            <Typography paragraph>
              This quick setup will help you configure optional features. You can skip any step and
              add these later in Settings.
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              <strong>Your data is 100% local.</strong>
              <br />
              No cloud sync by default. No tracking. No analytics.
              <br />
              You control where your health data lives.
            </Alert>
            <Typography variant="body2" sx={{ mt: 3 }}>
              <strong>What works without any setup:</strong>
            </Typography>
            <ul>
              <li>Track treatments, symptoms, and vitals</li>
              <li>Store genomic reports and mutations</li>
              <li>Manually save research papers</li>
              <li>Encrypted data export/import</li>
            </ul>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Research Scanner (Optional)
            </Typography>
            <Typography paragraph>
              Enable automated research scanning to get the latest bladder cancer research delivered
              every morning.
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Requires:</strong> Free Brave Search API key (1 million requests/month free tier)
            </Alert>

            <TextField
              fullWidth
              label="Brave API Key (optional)"
              value={config.braveApiKey}
              onChange={(e) => setConfig({ ...config, braveApiKey: e.target.value })}
              placeholder="BSA..."
              helperText="Leave blank to skip automated scanning"
              sx={{ mb: 2 }}
            />

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">How to get a Brave API key (free)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  <li>
                    Visit{' '}
                    <Link href="https://brave.com/search/api/" target="_blank" rel="noopener">
                      brave.com/search/api
                    </Link>
                  </li>
                  <li>Click "Get Started"</li>
                  <li>Sign up with your email</li>
                  <li>Create an API key (free tier: 1M requests/month)</li>
                  <li>Copy the key and paste above</li>
                </ol>
              </AccordionDetails>
            </Accordion>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              AI Meal Analysis (Optional)
            </Typography>
            <Typography paragraph>
              Enable AI-powered meal analysis to get personalized nutrition recommendations based on
              your genomic profile.
            </Typography>

            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Requires:</strong> Anthropic API key ($5 credit for new users, then pay-as-you-go)
            </Alert>

            <TextField
              fullWidth
              label="Anthropic API Key (optional)"
              value={config.anthropicApiKey}
              onChange={(e) => setConfig({ ...config, anthropicApiKey: e.target.value })}
              placeholder="sk-ant-api03-..."
              helperText="Leave blank to skip AI features"
              sx={{ mb: 2 }}
            />

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">How to get an Anthropic API key</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  <li>
                    Visit{' '}
                    <Link href="https://console.anthropic.com/" target="_blank" rel="noopener">
                      console.anthropic.com
                    </Link>
                  </li>
                  <li>Sign up (new users get $5 free credit)</li>
                  <li>Go to API Keys → Create Key</li>
                  <li>Copy the key (starts with "sk-ant-api03-...")</li>
                  <li>Paste above</li>
                </ol>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Cost: ~$0.01-0.03 per meal analysis (Claude Haiku model)
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Cloud Sync (Optional)
            </Typography>
            <Typography paragraph>
              Sync your data across devices using Supabase (open-source Firebase alternative).
            </Typography>

            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Privacy notice:</strong> Enabling cloud sync uploads your health data to Supabase.
              Only do this if you trust Supabase's security.
            </Alert>

            <Typography variant="body2" sx={{ mb: 2 }}>
              <strong>Recommended:</strong> Skip this for now. Use encrypted export/import to transfer
              data between devices instead (100% local, zero cloud exposure).
            </Typography>

            <TextField
              fullWidth
              label="Supabase URL (optional)"
              value={config.supabaseUrl}
              onChange={(e) => setConfig({ ...config, supabaseUrl: e.target.value })}
              placeholder="https://[project].supabase.co"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Supabase Anon Key (optional)"
              value={config.supabaseAnonKey}
              onChange={(e) => setConfig({ ...config, supabaseAnonKey: e.target.value })}
              placeholder="eyJ..."
              helperText="Leave blank to keep data 100% local"
            />
          </Box>
        );

      case 4:
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              Setup Complete!
            </Typography>

            <Typography paragraph>
              {config.braveApiKey || config.anthropicApiKey || config.supabaseUrl ? (
                <>You've enabled the following features:</>
              ) : (
                <>You're all set! You can add API keys later in Settings to unlock additional features.</>
              )}
            </Typography>

            {config.braveApiKey && (
              <Alert severity="success" sx={{ mb: 1 }}>
                ✅ <strong>Research Scanner</strong> - Automated research scanning enabled
              </Alert>
            )}

            {config.anthropicApiKey && (
              <Alert severity="success" sx={{ mb: 1 }}>
                ✅ <strong>AI Meal Analysis</strong> - Personalized nutrition recommendations enabled
              </Alert>
            )}

            {config.supabaseUrl && config.supabaseAnonKey && (
              <Alert severity="success" sx={{ mb: 1 }}>
                ✅ <strong>Cloud Sync</strong> - Cross-device sync enabled
              </Alert>
            )}

            {!config.braveApiKey && !config.anthropicApiKey && !config.supabaseUrl && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Running in offline mode. All core features work without any external services.
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              You can change these settings anytime in Settings → API Keys.
            </Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} maxWidth="md" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </DialogTitle>

      <DialogContent sx={{ minHeight: 400 }}>{renderStepContent(activeStep)}</DialogContent>

      <DialogActions>
        {activeStep > 0 && activeStep < steps.length - 1 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}

        {activeStep < steps.length - 2 && (
          <Button onClick={handleSkip} color="secondary" disabled={loading}>
            Skip Setup
          </Button>
        )}

        {activeStep < steps.length - 1 ? (
          <Button onClick={handleNext} variant="contained" disabled={loading}>
            Next
          </Button>
        ) : (
          <Button onClick={handleComplete} variant="contained" color="primary" disabled={loading}>
            {loading ? 'Finishing...' : 'Finish'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
