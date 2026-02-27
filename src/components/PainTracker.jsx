import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Alert, Snackbar, Slider, Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MedicalServices as PainIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const PAIN_TYPES = ['aching', 'burning', 'sharp', 'throbbing', 'pressure', 'tingling', 'other'];
const COMMON_LOCATIONS = [
  'Lower back', 'Upper back', 'Abdomen', 'Pelvis', 'Hip', 'Knee', 'Leg',
  'Shoulder', 'Neck', 'Head', 'Bladder', 'Flank', 'Chest', 'Other'
];

const PAIN_COLOR = (level) => {
  if (level <= 2) return '#4caf50';
  if (level <= 4) return '#8bc34a';
  if (level <= 6) return '#ff9800';
  if (level <= 8) return '#ff5722';
  return '#f44336';
};

const PAIN_LABEL = (level) => {
  if (level === 0) return 'None';
  if (level <= 2) return 'Mild';
  if (level <= 4) return 'Moderate';
  if (level <= 6) return 'Significant';
  if (level <= 8) return 'Severe';
  return 'Extreme';
};

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  pain_level: 5,
  location: '',
  type: '',
  triggers: '',
  relieved_by: '',
  duration_min: '',
  notes: '',
});

export default function PainTracker() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [view, setView] = useState('log'); // 'log' | 'trend'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const ipc = window.electron?.trackers?.pain;

  const load = useCallback(async () => {
    if (!ipc) return;
    try {
      const [data, s] = await Promise.all([ipc.get({ limit: 200 }), ipc.stats()]);
      setLogs(data || []);
      setStats(s);
    } catch (e) {
      console.error('[PainTracker] load failed:', e);
    }
  }, [ipc]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm()); setEditId(null); setDialogOpen(true); };
  const openEdit = (row) => {
    setForm({ ...emptyForm(), ...row });
    setEditId(row.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.date || form.pain_level === undefined) return;
    try {
      if (editId) {
        await ipc.update(editId, form);
        setSnack({ open: true, msg: 'Pain log updated', severity: 'success' });
      } else {
        await ipc.add(form);
        setSnack({ open: true, msg: 'Pain entry logged', severity: 'success' });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      setSnack({ open: true, msg: 'Save failed: ' + e.message, severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await ipc.delete(id);
      setSnack({ open: true, msg: 'Deleted', severity: 'info' });
      setDeleteConfirm(null);
      load();
    } catch (e) {
      setSnack({ open: true, msg: 'Delete failed', severity: 'error' });
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (!ipc) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        Pain tracker requires Electron IPC (run the packaged app).
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PainIcon color="error" /> Pain Tracker
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant={view === 'log' ? 'contained' : 'outlined'} size="small" onClick={() => setView('log')}>Log</Button>
          <Button variant={view === 'trend' ? 'contained' : 'outlined'} size="small" startIcon={<TimelineIcon />} onClick={() => setView('trend')}>Trend</Button>
          <Button variant="contained" color="error" startIcon={<AddIcon />} onClick={openAdd}>Log Pain</Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      {stats?.last30 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Entries (30d)', value: stats.last30.entries ?? 0 },
            { label: 'Avg Pain', value: stats.last30.avg_pain != null ? `${stats.last30.avg_pain}/10` : '—' },
            { label: 'Max Pain', value: stats.last30.max_pain != null ? `${stats.last30.max_pain}/10` : '—' },
            { label: 'Min Pain', value: stats.last30.min_pain != null ? `${stats.last30.min_pain}/10` : '—' },
          ].map(({ label, value }) => (
            <Grid item xs={6} sm={3} key={label}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1, '&:last-child': { pb: 1 } }}>
                  <Typography variant="h6">{value}</Typography>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Top Locations */}
      {stats?.byLocation?.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>Top Pain Locations (30d)</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {stats.byLocation.slice(0, 6).map(l => (
              <Chip key={l.location} label={`${l.location} (${l.count}× avg ${l.avg_pain})`}
                size="small" color="default" />
            ))}
          </Box>
        </Box>
      )}

      {/* Trend Chart */}
      {view === 'trend' && stats?.trend?.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Pain Level Trend (30d)</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                <RechartTooltip />
                <ReferenceLine y={7} stroke="#f44336" strokeDasharray="4 2" label={{ value: 'Severe', fill: '#f44336', fontSize: 11 }} />
                <ReferenceLine y={4} stroke="#ff9800" strokeDasharray="4 2" label={{ value: 'Moderate', fill: '#ff9800', fontSize: 11 }} />
                <Line type="monotone" dataKey="avg_pain" name="Avg Pain" stroke="#f44336" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Log Table */}
      {view === 'log' && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date/Time</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Triggers</TableCell>
                <TableCell>Relieved By</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No pain logs yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {logs.map(row => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.date}{row.time ? ` ${row.time}` : ''}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${row.pain_level}/10 ${PAIN_LABEL(row.pain_level)}`}
                      size="small"
                      sx={{ bgcolor: PAIN_COLOR(row.pain_level), color: '#fff', fontSize: 11 }}
                    />
                  </TableCell>
                  <TableCell>{row.location || '—'}</TableCell>
                  <TableCell>{row.type || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Tooltip title={row.triggers || ''}><span>{row.triggers || '—'}</span></Tooltip>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Tooltip title={row.relieved_by || ''}><span>{row.relieved_by || '—'}</span></Tooltip>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Tooltip title={row.notes || ''}><span>{row.notes || '—'}</span></Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteConfirm(row.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Pain Log' : 'Log Pain Entry'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}><TextField label="Date" type="date" value={form.date} onChange={e => set('date', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth required /></Grid>
            <Grid item xs={6}><TextField label="Time" type="time" value={form.time} onChange={e => set('time', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth /></Grid>

            {/* Pain Level Slider */}
            <Grid item xs={12}>
              <Typography gutterBottom>
                Pain Level: <strong style={{ color: PAIN_COLOR(form.pain_level) }}>
                  {form.pain_level}/10 — {PAIN_LABEL(form.pain_level)}
                </strong>
              </Typography>
              <Slider
                value={form.pain_level}
                min={0} max={10} step={1}
                marks={[0,1,2,3,4,5,6,7,8,9,10].map(v => ({ value: v, label: String(v) }))}
                onChange={(_, v) => set('pain_level', v)}
                sx={{
                  color: PAIN_COLOR(form.pain_level),
                  '& .MuiSlider-thumb': { width: 20, height: 20 },
                }}
              />
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Location</InputLabel>
                <Select value={form.location} label="Location" onChange={e => set('location', e.target.value)}>
                  <MenuItem value="">—</MenuItem>
                  {COMMON_LOCATIONS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Pain Type</InputLabel>
                <Select value={form.type} label="Pain Type" onChange={e => set('type', e.target.value)}>
                  <MenuItem value="">—</MenuItem>
                  {PAIN_TYPES.map(t => <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}><TextField label="Duration (min)" type="number" value={form.duration_min} onChange={e => set('duration_min', e.target.value)} fullWidth /></Grid>
            <Grid item xs={6}></Grid>
            <Grid item xs={12}><TextField label="Triggers (what caused it?)" value={form.triggers} onChange={e => set('triggers', e.target.value)} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Relieved by (what helped?)" value={form.relieved_by} onChange={e => set('relieved_by', e.target.value)} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Notes" multiline rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} fullWidth placeholder="Any additional context, medications taken, doctor notified, etc." /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleSave} disabled={!form.date}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete this pain log?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => handleDelete(deleteConfirm)}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
