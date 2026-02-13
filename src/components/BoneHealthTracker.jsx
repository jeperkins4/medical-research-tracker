import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  AlertTitle,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Divider
} from '@mui/material';
import {
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ArrowUpward as ArrowUpwardIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function BoneHealthTracker() {
  const [alkPhosData, setAlkPhosData] = useState([]);
  const [currentSupplements, setCurrentSupplements] = useState([]);
  const [missingSupplements, setMissingSupplements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBoneHealthData();
  }, []);

  const fetchBoneHealthData = async () => {
    try {
      const response = await fetch('/api/bone-health');
      const data = await response.json();
      setAlkPhosData(data.alkPhosData || []);
      setCurrentSupplements(data.currentSupplements || []);
      setMissingSupplements(data.missingSupplements || []);
    } catch (error) {
      console.error('Error fetching bone health data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate trend
  const calculateTrend = () => {
    if (alkPhosData.length < 2) return null;
    const latest = alkPhosData[alkPhosData.length - 1].value;
    const earliest = alkPhosData[0].value;
    const change = ((latest - earliest) / earliest) * 100;
    return {
      change: change.toFixed(1),
      direction: change > 0 ? 'up' : 'down',
      severity: Math.abs(change) > 20 ? 'high' : Math.abs(change) > 10 ? 'medium' : 'low'
    };
  };

  const trend = calculateTrend();
  const latestValue = alkPhosData.length > 0 ? alkPhosData[alkPhosData.length - 1].value : null;
  const isAbnormal = latestValue && latestValue > 147;

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🦴 Bone Health Tracker
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Monitoring Alkaline Phosphatase & Bone Metastases Risk
      </Typography>

      {/* Alert Banner */}
      {isAbnormal && trend && trend.direction === 'up' && (
        <Alert severity="error" sx={{ mb: 3 }} icon={<WarningIcon />}>
          <AlertTitle>⚠️ URGENT: Rising Alkaline Phosphatase Detected</AlertTitle>
          <Typography variant="body2">
            Your Alk Phos has increased by <strong>{trend.change}%</strong> over the past 8 weeks and is now{' '}
            <strong>above normal range ({latestValue} U/L, normal: 39-147)</strong>.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Action Required:</strong> Schedule appointment with Dr. Do to discuss bone scan and bisphosphonates/denosumab therapy.
          </Typography>
        </Alert>
      )}

      {/* Alk Phos Trend Chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Alkaline Phosphatase Trend
          </Typography>
          {alkPhosData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={alkPhosData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'U/L', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <ReferenceLine y={147} stroke="red" strokeDasharray="3 3" label="Upper Normal Limit" />
                <ReferenceLine y={39} stroke="green" strokeDasharray="3 3" label="Lower Normal Limit" />
                <Line type="monotone" dataKey="value" stroke="#ff6b6b" strokeWidth={2} name="Alk Phos" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Typography color="text.secondary">No Alkaline Phosphatase data available</Typography>
          )}
          {trend && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon color={trend.direction === 'up' ? 'error' : 'success'} />
              <Typography variant="body2">
                {trend.direction === 'up' ? 'Increasing' : 'Decreasing'} by {Math.abs(trend.change)}% over tracking period
              </Typography>
              <Chip
                label={trend.severity === 'high' ? 'High Risk' : trend.severity === 'medium' ? 'Moderate Risk' : 'Low Risk'}
                color={trend.severity === 'high' ? 'error' : trend.severity === 'medium' ? 'warning' : 'success'}
                size="small"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Current Supplements Supporting Bone Health */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon color="success" />
                What You're Doing Right
              </Typography>
              <Divider sx={{ my: 2 }} />
              {currentSupplements.length > 0 ? (
                currentSupplements.map((supp, idx) => (
                  <Box key={idx} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {supp.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {supp.dosage} - {supp.benefit}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">Loading supplement data...</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Missing Supplements - Critical Gaps */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CancelIcon color="error" />
                Critical Gaps - Action Needed
              </Typography>
              <Divider sx={{ my: 2 }} />
              {missingSupplements.length > 0 ? (
                missingSupplements.map((supp, idx) => (
                  <Box key={idx} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" color="error.main">
                      {supp.name} - {supp.urgency === 'urgent' ? '🚨 URGENT' : '⚠️ Important'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Needed:</strong> {supp.dosage}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Why:</strong> {supp.reason}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">Loading recommendations...</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Items Checklist */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 Action Items (Priority Order)
          </Typography>
          <Divider sx={{ my: 2 }} />
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Priority</strong></TableCell>
                  <TableCell><strong>Action</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Chip label="URGENT" color="error" size="small" />
                  </TableCell>
                  <TableCell>Schedule appointment with Dr. Do to discuss rising Alk Phos</TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined" color="error">
                      Schedule Now
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Chip label="URGENT" color="error" size="small" />
                  </TableCell>
                  <TableCell>Request bone scan to rule out metastases</TableCell>
                  <TableCell>Pending</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Chip label="URGENT" color="error" size="small" />
                  </TableCell>
                  <TableCell>Discuss Zoledronic acid or Denosumab with oncology</TableCell>
                  <TableCell>Pending</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Chip label="High" color="warning" size="small" />
                  </TableCell>
                  <TableCell>Labs: Alk Phos, Calcium, 25-OH Vitamin D, PTH, CTX</TableCell>
                  <TableCell>Pending</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Chip label="High" color="warning" size="small" />
                  </TableCell>
                  <TableCell>Order Vitamin K2-MK7 200mcg supplement</TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined">
                      Order Online
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Chip label="High" color="warning" size="small" />
                  </TableCell>
                  <TableCell>Increase Vitamin D3 from 1,000 IU to 5,000 IU daily</TableCell>
                  <TableCell>Ready to Start</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Chip label="Medium" color="info" size="small" />
                  </TableCell>
                  <TableCell>Add Calcium Citrate 1200mg/day (split doses)</TableCell>
                  <TableCell>Pending</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Chip label="Medium" color="info" size="small" />
                  </TableCell>
                  <TableCell>Add Magnesium Glycinate 400mg/day</TableCell>
                  <TableCell>Pending</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Chip label="Medium" color="info" size="small" />
                  </TableCell>
                  <TableCell>Add Boron 3mg/day</TableCell>
                  <TableCell>Pending</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Evidence Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📚 Supporting Evidence
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" paragraph>
            <strong>PLOS One (2017):</strong> "Serum calcium, alkaline phosphotase and hemoglobin as risk factors for bone metastases in bladder cancer"
            <br />
            <em>ALP significantly higher in patients with bone mets (P = 0.015). Early detection critical.</em>
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>TUGAMO Study (British Journal of Cancer, 2013):</strong> Biochemical markers of bone turnover in bladder/RCC patients treated with zoledronic acid.
            <br />
            <em>Bisphosphonates reduce SRE and lower ALP when effective.</em>
          </Typography>
          <Button size="small" variant="text" href="/BONE-HEALTH-ANALYSIS.md" target="_blank">
            View Full Analysis Document
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
