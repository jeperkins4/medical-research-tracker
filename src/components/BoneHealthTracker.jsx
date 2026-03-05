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
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDropDown as ArrowDropDownIcon,
  VerifiedUser as VerifiedUserIcon,
  AttachMoney as AttachMoneyIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

// Trusted supplement sources (medical-grade)
const supplementSources = {
  'Vitamin K2-MK7': [
    { name: 'Thorne K2 Liquid', url: 'https://www.thorne.com/products/dp/vitamin-k2-liquid', tier: 'Medical Grade', icon: <VerifiedUserIcon fontSize="small" /> },
    { name: 'Pure Encaps K2-MK7', url: 'https://www.pureencapsulations.com/vitamin-k2.html', tier: 'Medical Grade', icon: <VerifiedUserIcon fontSize="small" /> },
    { name: 'Life Extension K2', url: 'https://www.lifeextension.com/vitamins-supplements/item01224/super-k', tier: 'Research-Backed', icon: <AttachMoneyIcon fontSize="small" /> },
    { name: 'Amazon (Budget)', url: 'https://www.amazon.com/s?k=vitamin+k2+mk7', tier: 'Budget', icon: <AttachMoneyIcon fontSize="small" /> }
  ]
};

function ProtectiveSupplementsCard({ supplements }) {
  if (!supplements?.length) return null;
  return (
    <Box sx={{ mt: 3 }}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon color="success" />
            Supplements Already Protecting Your Bones
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            {supplements.map((s, i) => (
              <Grid item xs={12} sm={6} key={i}>
                <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold">{s.name}</Typography>
                  {s.dosage && <Typography variant="body2" color="text.secondary">{s.dosage}</Typography>}
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8rem' }}>{s.reason}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}

// Credentialed fetch fallback (used when apiFetch prop is not passed)
const credFetch = (url, opts = {}) =>
  fetch(url, { ...opts, credentials: 'include' });

export default function BoneHealthTracker({ apiFetch: propApiFetch }) {
  const apiFetch = propApiFetch || credFetch;
  const [enabled, setEnabled] = useState(false);
  const [disabledReason, setDisabledReason] = useState('');
  const [alkPhosData, setAlkPhosData] = useState([]);
  const [currentSupplements, setCurrentSupplements] = useState([]);
  const [missingSupplements, setMissingSupplements] = useState([]);
  const [protectiveSupplements, setProtectiveSupplements] = useState([]);
  const [labFlags, setLabFlags] = useState([]);
  const [tumorFlags, setTumorFlags] = useState([]);
  const [panelData, setPanelData] = useState({});
  const [softTissueData, setSoftTissueData] = useState({});
  const [tumorMarkerData, setTumorMarkerData] = useState({});
  const [imagingFindings, setImagingFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderMenuAnchor, setOrderMenuAnchor] = useState(null);
  const [selectedSupplement, setSelectedSupplement] = useState(null);

  useEffect(() => {
    fetchBoneHealthData();
  }, []);

  const normalizeIpcFlags = (flags = []) =>
    flags.map((f) => ({
      marker: 'Bone Marker',
      value: f.label || 'Abnormal finding',
      status: f.severity?.toUpperCase?.() || 'FLAG',
      note: f.label || 'Clinical flag detected',
      severity: f.severity === 'high' ? 'critical' : 'warning'
    }));

  const fetchBoneHealthData = async () => {
    try {
      let data;
      if (window.electron?.organHealth?.getBone) {
        data = await window.electron.organHealth.getBone();
      } else {
        const response = await apiFetch('/api/bone-health');
        data = await response.json();
      }

      // Check if bone health monitoring is enabled
      if (!data.enabled) {
        setEnabled(false);
        setDisabledReason(data.message || 'No clinical indicators for bone health monitoring');
        setLoading(false);
        return;
      }

      // Normalize payloads across HTTP API and Electron IPC shapes
      const alkData = data.alkPhosData || data.series?.alkPhos || [];
      const supplements = data.currentSupplements || data.protectiveSupplements || [];
      const gaps = data.missingSupplements || [];
      const flags = data.labFlags || normalizeIpcFlags(data.flags || []);

      setEnabled(true);
      setAlkPhosData(alkData);
      setCurrentSupplements(supplements);
      setMissingSupplements(gaps);
      setProtectiveSupplements(data.protectiveSupplements || []);
      setLabFlags(flags);
      setTumorFlags(data.tumorFlags || []);
      setPanelData(data.panelData || {});
      setSoftTissueData(data.softTissueData || {});
      setTumorMarkerData(data.tumorMarkerData || {});
      setImagingFindings(data.imagingFindings || []);
    } catch (error) {
      console.error('Error fetching bone health data:', error);
      setEnabled(false);
      setDisabledReason('Error loading bone health data');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderClick = (event, supplement) => {
    setSelectedSupplement(supplement);
    setOrderMenuAnchor(event.currentTarget);
  };

  const handleOrderClose = () => {
    setOrderMenuAnchor(null);
    setSelectedSupplement(null);
  };

  const handleSupplierSelect = (url) => {
    window.open(url, '_blank');
    handleOrderClose();
  };

  // Detect how many consecutive rising values at the end of a series
  const detectRisingTrend = (series) => {
    if (!series || series.length < 2) return 0;
    let count = 0;
    for (let i = series.length - 1; i > 0; i--) {
      if (series[i].value > series[i - 1].value) count++;
      else break;
    }
    return count;
  };

  // Build chart data from a series array with date + value
  const buildChartData = (series) =>
    (series || []).map(r => ({
      date: r.date?.slice(0, 10),
      value: typeof r.value === 'number' ? r.value : parseFloat(r.value) || null,
    })).filter(r => r.value !== null);

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

  // Show message if bone health monitoring is not enabled
  if (!enabled) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircleIcon sx={{ color: 'success.main', fontSize: 40, mr: 2 }} />
              <Box>
                <Typography variant="h6">
                  Bone Health Monitoring Not Required
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {disabledReason}
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              <strong>Bone health monitoring is triggered when:</strong>
            </Typography>
            <Box component="ul" sx={{ mt: 1, pl: 2 }}>
              <Typography component="li" variant="body2" color="text.secondary">
                Bone metastases or osseous lesions are present
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Alkaline Phosphatase is elevated (&gt;147 U/L)
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Calcium is elevated (&gt;10.2 mg/dL)
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Abnormal bone imaging findings
              </Typography>
            </Box>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                If you develop any of these conditions, bone health tracking will automatically activate to help monitor for skeletal-related events.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      </Box>
    );
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

      {/* ── Cancer Spread Signals ────────────────────────────────────────── */}
      {(() => {
        // Key markers for metastasis / spread in urothelial cancer
        const spreadMarkers = [
          {
            key: 'ldh',
            label: 'LDH (Lactate Dehydrogenase)',
            unit: 'U/L',
            normal: { min: 100, max: 246 },
            color: '#e53935',
            tooltip: 'Elevated LDH = cell death / tumor burden. Rising trend is a key metastasis signal.',
            series: panelData?.ldh?.series,
          },
          {
            key: 'alkPhos',
            label: 'Alkaline Phosphatase',
            unit: 'U/L',
            normal: { min: 39, max: 147 },
            color: '#ff6b6b',
            tooltip: 'Bone resorption marker. Elevated / rising = possible bone mets.',
            series: alkPhosData,
          },
          {
            key: 'calcium',
            label: 'Calcium',
            unit: 'mg/dL',
            normal: { min: 8.5, max: 10.2 },
            color: '#fb8c00',
            tooltip: 'Hypercalcemia can signal osteolytic bone metastases.',
            series: panelData?.calcium?.series,
          },
          {
            key: 'vitaminD',
            label: 'Vitamin D (25-OH)',
            unit: 'ng/mL',
            normal: { min: 30, max: 80 },
            color: '#ffd600',
            tooltip: 'Low Vit D = impaired bone protection. Cancer patients need 50–80 ng/mL.',
            series: panelData?.vitaminD?.series,
            invertAlert: true, // alert when LOW not high
          },
          {
            key: 'albumin',
            label: 'Albumin',
            unit: 'g/dL',
            normal: { min: 3.5, max: 5.0 },
            color: '#8e24aa',
            tooltip: 'Falling albumin = tumor burden / malnutrition / systemic disease progression.',
            series: softTissueData?.albumin?.series,
            invertAlert: true,
          },
          {
            key: 'crp',
            label: 'CRP (C-Reactive Protein)',
            unit: 'mg/L',
            normal: { min: 0, max: 1.0 },
            color: '#ef5350',
            tooltip: 'Rising CRP = systemic inflammation, possible disease progression.',
            series: softTissueData?.crp?.series,
          },
        ].filter(m => m.series && m.series.length >= 1);

        if (spreadMarkers.length === 0) return null;

        const risingMarkers = spreadMarkers.filter(m => {
          const count = detectRisingTrend(m.series);
          return m.invertAlert ? false : count >= 2;
        });
        const fallingConcernMarkers = spreadMarkers.filter(m => {
          if (!m.invertAlert) return false;
          const s = m.series;
          if (!s || s.length < 2) return false;
          let count = 0;
          for (let i = s.length - 1; i > 0; i--) {
            if (s[i].value < s[i - 1].value) count++;
            else break;
          }
          return count >= 2;
        });

        return (
          <Card sx={{ mb: 3, border: risingMarkers.length > 0 || fallingConcernMarkers.length > 0 ? '2px solid #ef5350' : '1px solid #e0e0e0' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                📈 Cancer Spread Signals
                {(risingMarkers.length > 0 || fallingConcernMarkers.length > 0) && (
                  <Chip label="⚠️ Rising Trend Detected" color="error" size="small" />
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Key blood markers tracked over time. Rising trends in these values may indicate disease progression or metastatic spread.
              </Typography>

              {/* Rising trend alert banners */}
              {risingMarkers.map(m => {
                const count = detectRisingTrend(m.series);
                const latest = m.series[m.series.length - 1];
                const isAbove = latest.value > m.normal.max;
                return (
                  <Alert
                    key={m.key}
                    severity={isAbove ? 'error' : 'warning'}
                    sx={{ mb: 1 }}
                    icon={<ArrowUpwardIcon />}
                  >
                    <strong>{m.label}:</strong> Rising for {count} consecutive tests.
                    Latest: <strong>{latest.value} {m.unit}</strong>
                    {isAbove ? ` — above normal (≤${m.normal.max} ${m.unit})` : ` — still within range but trending up`}.
                    {' '}{m.tooltip}
                  </Alert>
                );
              })}
              {fallingConcernMarkers.map(m => {
                const latest = m.series[m.series.length - 1];
                return (
                  <Alert key={m.key} severity="warning" sx={{ mb: 1 }}>
                    <strong>{m.label}:</strong> Declining for 2+ consecutive tests.
                    Latest: <strong>{latest.value} {m.unit}</strong> (normal: {m.normal.min}–{m.normal.max} {m.unit}).
                    {' '}{m.tooltip}
                  </Alert>
                );
              })}

              {/* Individual trend charts */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mt: 2 }}>
                {spreadMarkers.map(m => {
                  const chartData = buildChartData(m.series);
                  const risingCount = m.invertAlert ? 0 : detectRisingTrend(m.series);
                  const latestVal = chartData.at(-1)?.value ?? null;
                  const isAbnormal = latestVal !== null && (
                    m.invertAlert ? latestVal < m.normal.min : latestVal > m.normal.max
                  );
                  return (
                    <Box key={m.key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={700}>{m.label}</Typography>
                        {isAbnormal && (
                          <Chip
                            label={m.invertAlert ? 'LOW' : 'HIGH'}
                            color="error"
                            size="small"
                          />
                        )}
                        {risingCount >= 2 && (
                          <Chip label={`▲ ${risingCount} rising`} color="warning" size="small" />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                        {m.tooltip}
                      </Typography>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} unit={` ${m.unit}`} width={60} />
                          <Tooltip formatter={(v) => [`${v} ${m.unit}`, m.label]} />
                          {/* Normal range reference lines */}
                          <ReferenceLine
                            y={m.normal.max}
                            stroke="#ef5350"
                            strokeDasharray="4 3"
                            label={{ value: `Max ${m.normal.max}`, position: 'insideTopRight', fontSize: 10, fill: '#ef5350' }}
                          />
                          {m.normal.min > 0 && (
                            <ReferenceLine
                              y={m.normal.min}
                              stroke="#43a047"
                              strokeDasharray="4 3"
                              label={{ value: `Min ${m.normal.min}`, position: 'insideBottomRight', fontSize: 10, fill: '#43a047' }}
                            />
                          )}
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={isAbnormal ? '#ef5350' : m.color}
                            strokeWidth={2.5}
                            dot={(props) => {
                              const { cx, cy, payload } = props;
                              const aboveMax = payload.value > m.normal.max;
                              const belowMin = payload.value < (m.normal.min || -Infinity);
                              const fill = (aboveMax || belowMin) ? '#ef5350' : m.color;
                              return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={fill} stroke="#fff" strokeWidth={1} />;
                            }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      {latestVal !== null && (
                        <Typography variant="caption" color={isAbnormal ? 'error' : 'text.secondary'} display="block" sx={{ mt: 0.5 }}>
                          Latest: <strong>{latestVal} {m.unit}</strong> · Normal: {m.normal.min}–{m.normal.max} {m.unit}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Lab Flags — all abnormal values ─────────────────────────────── */}
      {(labFlags.length > 0 || tumorFlags.length > 0 || imagingFindings.length > 0) && (
        <Card sx={{ mb: 3, border: '1px solid #fecaca', background: '#fef2f2' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1 }}>
              ⚠️ Active Clinical Flags
            </Typography>
            {labFlags.map((f, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, background: '#fff', borderRadius: 1, border: '1px solid #fecaca' }}>
                <Chip label={f.status} color={f.severity === 'critical' ? 'error' : 'warning'} size="small" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{f.marker}: {f.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{f.note}</Typography>
                </Box>
              </Box>
            ))}
            {tumorFlags.map((f, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, background: '#fff', borderRadius: 1, border: '1px solid #fbbf24' }}>
                <Chip label={f.status} color="warning" size="small" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{f.marker}: {f.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{f.note}</Typography>
                </Box>
              </Box>
            ))}
            {imagingFindings.map((f, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, background: '#fff', borderRadius: 1, border: '1px solid #a78bfa' }}>
                <Chip label="IMAGING" color="secondary" size="small" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {f.type} — {f.region || f.keywords?.join(', ')}{f.size_mm ? ` (${f.size_mm}mm)` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {f.docTitle || 'Radiology Report'}{f.docDate ? ` · ${f.docDate}` : ''}
                    {f.finding && ` · ${f.finding}`}
                  </Typography>
                </Box>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Extended Blood Panel ─────────────────────────────────────────── */}
      {Object.keys(panelData).length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>🧪 Bone Panel — Blood Markers</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
              {Object.values(panelData).map((m, i) => m.latest !== null && (
                <Box key={i} sx={{
                  p: 1.5, borderRadius: 2, border: '1px solid',
                  borderColor: m.latest < (m.normal?.min ?? -Infinity) || m.latest > (m.normal?.max ?? Infinity) ? '#fca5a5' : '#bbf7d0',
                  background: m.latest < (m.normal?.min ?? -Infinity) || m.latest > (m.normal?.max ?? Infinity) ? '#fef2f2' : '#f0fdf4',
                }}>
                  <Typography variant="caption" color="text.secondary" display="block">{m.label}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {m.latest} <Typography component="span" variant="caption">{m.unit}</Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Normal: {m.normal?.min ?? '–'}–{m.normal?.max} {m.unit}
                    {m.trend && ` · ${m.trend.direction === 'up' ? '▲' : '▼'} ${Math.abs(m.trend.change)}%`}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── Soft Tissue & Inflammatory Markers ───────────────────────────── */}
      {Object.keys(softTissueData).length > 0 && Object.values(softTissueData).some(m => m.latest !== null) && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>🫀 Soft Tissue & Inflammatory Markers</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
              {Object.values(softTissueData).map((m, i) => m.latest !== null && (
                <Box key={i} sx={{
                  p: 1.5, borderRadius: 2, border: '1px solid',
                  borderColor: m.latest < (m.normal?.min ?? -Infinity) || m.latest > (m.normal?.max ?? Infinity) ? '#fca5a5' : '#bbf7d0',
                  background: m.latest < (m.normal?.min ?? -Infinity) || m.latest > (m.normal?.max ?? Infinity) ? '#fef2f2' : '#f0fdf4',
                }}>
                  <Typography variant="caption" color="text.secondary" display="block">{m.label}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {m.latest} <Typography component="span" variant="caption">{m.unit}</Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Normal: {m.normal?.min !== undefined ? `${m.normal.min}–` : '≤'}{m.normal?.max} {m.unit}
                    {m.trend && ` · ${m.trend.direction === 'up' ? '▲' : '▼'} ${Math.abs(m.trend.change)}%`}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── Tumor Markers ────────────────────────────────────────────────── */}
      {Object.values(tumorMarkerData).some(m => m.latest !== null) && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>🔬 Tumor Markers</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
              {Object.values(tumorMarkerData).map((m, i) => m.latest !== null && (
                <Box key={i} sx={{
                  p: 1.5, borderRadius: 2, border: '1px solid',
                  borderColor: m.latest > (m.normal?.max ?? Infinity) ? '#fca5a5' : '#bbf7d0',
                  background: m.latest > (m.normal?.max ?? Infinity) ? '#fef2f2' : '#f0fdf4',
                }}>
                  <Typography variant="caption" color="text.secondary" display="block">{m.label}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {m.latest} <Typography component="span" variant="caption">{m.unit}</Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Normal: ≤{m.normal?.max} {m.unit}
                    {m.trend && ` · ${m.trend.direction === 'up' ? '▲' : '▼'} ${Math.abs(m.trend.change)}%`}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

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
                <Typography color="text.secondary">No bone-support supplements found in current records.</Typography>
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
                <Typography color="text.secondary">No critical supplement gaps identified from available data.</Typography>
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
                    <Button 
                      size="small" 
                      variant="outlined" 
                      endIcon={<ArrowDropDownIcon />}
                      onClick={(e) => handleOrderClick(e, 'Vitamin K2-MK7')}
                    >
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

      {/* Dynamic protective supplements from current protocol */}
      <ProtectiveSupplementsCard supplements={protectiveSupplements} />

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

      {/* Supplement Ordering Menu */}
      <Menu
        anchorEl={orderMenuAnchor}
        open={Boolean(orderMenuAnchor)}
        onClose={handleOrderClose}
      >
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            Trusted Sources (FDA-compliant, third-party tested)
          </Typography>
        </MenuItem>
        <Divider />
        {selectedSupplement && supplementSources[selectedSupplement]?.map((source) => (
          <MenuItem 
            key={source.name}
            onClick={() => handleSupplierSelect(source.url)}
          >
            <ListItemIcon>
              {source.icon}
            </ListItemIcon>
            <ListItemText 
              primary={source.name}
              secondary={source.tier}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
