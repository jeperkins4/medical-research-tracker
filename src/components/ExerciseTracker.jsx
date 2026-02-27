import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Alert, Snackbar, Divider, Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FitnessCenter as FitnessCenterIcon,
  DirectionsRun as RunIcon,
  DirectionsBike as BikeIcon,
  Pool as PoolIcon,
  SelfImprovement as YogaIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Legend
} from 'recharts';

const EXERCISE_TYPES = [
  'Walking', 'Running', 'Cycling', 'Swimming', 'Strength Training',
  'Yoga', 'Stretching', 'HIIT', 'Elliptical', 'Rowing', 'Other'
];

const INTENSITY_COLORS = { low: '#4caf50', moderate: '#ff9800', high: '#f44336' };

const TYPE_ICON = (type) => {
  if (!type) return <FitnessCenterIcon />;
  const t = type.toLowerCase();
  if (t.includes('run')) return <RunIcon />;
  if (t.includes('cycl') || t.includes('bike')) return <BikeIcon />;
  if (t.includes('swim')) return <PoolIcon />;
  if (t.includes('yoga') || t.includes('stretch')) return <YogaIcon />;
  return <FitnessCenterIcon />;
};

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  type: '',
  duration_min: '',
  intensity: '',
  distance_miles: '',
  calories: '',
  heart_rate_avg: '',
  heart_rate_max: '',
  steps: '',
  sets: '',
  reps: '',
  weight_lbs: '',
  notes: '',
});

export default function ExerciseTracker() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [view, setView] = useState('log'); // 'log' | 'stats'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const ipc = window.electron?.trackers?.exercise;

  const load = useCallback(async () => {
    if (!ipc) return;
    try {
      const [data, s] = await Promise.all([ipc.get({ limit: 200 }), ipc.stats()]);
      setLogs(data || []);
      setStats(s);
    } catch (e) {
      console.error('[ExerciseTracker] load failed:', e);
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
    if (!form.type || !form.date) return;
    try {
      if (editId) {
        await ipc.update(editId, form);
        setSnack({ open: true, msg: 'Exercise updated', severity: 'success' });
      } else {
        await ipc.add(form);
        setSnack({ open: true, msg: 'Exercise logged!', severity: 'success' });
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

  // Show fallback if IPC not available (dev/web mode)
  if (!ipc) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        Exercise tracker requires Electron IPC (run the packaged app).
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FitnessCenterIcon color="primary" /> Exercise Tracker
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant={view === 'log' ? 'contained' : 'outlined'} size="small" onClick={() => setView('log')}>Log</Button>
          <Button variant={view === 'stats' ? 'contained' : 'outlined'} size="small" startIcon={<TimelineIcon />} onClick={() => setView('stats')}>Stats</Button>
          <Button variant="contained" color="success" startIcon={<AddIcon />} onClick={openAdd}>Log Exercise</Button>
        </Box>
      </Box>

      {/* Stats Cards (always visible) */}
      {stats?.last30 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Sessions (30d)', value: stats.last30.sessions ?? 0 },
            { label: 'Avg Duration', value: stats.last30.avg_duration ? `${stats.last30.avg_duration} min` : '—' },
            { label: 'Total Minutes', value: stats.last30.total_minutes ?? 0 },
            { label: 'Total Calories', value: stats.last30.total_calories ?? 0 },
            { label: 'Total Miles', value: stats.last30.total_miles ? Number(stats.last30.total_miles).toFixed(1) : '—' },
            { label: 'Total Steps', value: stats.last30.total_steps?.toLocaleString() ?? '—' },
          ].map(({ label, value }) => (
            <Grid item xs={6} sm={4} md={2} key={label}>
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

      {/* Charts (stats view) */}
      {view === 'stats' && stats?.weekly?.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Weekly Activity (12 weeks)</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[...stats.weekly].reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis />
                <RechartTooltip />
                <Legend />
                <Bar dataKey="sessions" name="Sessions" fill="#2196f3" />
                <Bar dataKey="total_minutes" name="Minutes" fill="#4caf50" />
              </BarChart>
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
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Intensity</TableCell>
                <TableCell>Distance</TableCell>
                <TableCell>Calories</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No exercises logged yet. Hit "Log Exercise" to start!</Typography>
                  </TableCell>
                </TableRow>
              )}
              {logs.map(row => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.date}{row.time ? ` ${row.time}` : ''}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {TYPE_ICON(row.type)} {row.type}
                    </Box>
                  </TableCell>
                  <TableCell>{row.duration_min ? `${row.duration_min} min` : '—'}</TableCell>
                  <TableCell>
                    {row.intensity && (
                      <Chip label={row.intensity} size="small"
                        sx={{ bgcolor: INTENSITY_COLORS[row.intensity], color: '#fff', fontSize: 11 }} />
                    )}
                  </TableCell>
                  <TableCell>{row.distance_miles ? `${row.distance_miles} mi` : '—'}</TableCell>
                  <TableCell>{row.calories ?? '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        <DialogTitle>{editId ? 'Edit Exercise' : 'Log Exercise'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}><TextField label="Date" type="date" value={form.date} onChange={e => set('date', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth required /></Grid>
            <Grid item xs={6}><TextField label="Time" type="time" value={form.time} onChange={e => set('time', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth /></Grid>
            <Grid item xs={8}>
              <FormControl fullWidth required>
                <InputLabel>Exercise Type</InputLabel>
                <Select value={form.type} label="Exercise Type" onChange={e => set('type', e.target.value)}>
                  {EXERCISE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth>
                <InputLabel>Intensity</InputLabel>
                <Select value={form.intensity} label="Intensity" onChange={e => set('intensity', e.target.value)}>
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="moderate">Moderate</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}><TextField label="Duration (min)" type="number" value={form.duration_min} onChange={e => set('duration_min', e.target.value)} fullWidth /></Grid>
            <Grid item xs={4}><TextField label="Distance (miles)" type="number" value={form.distance_miles} onChange={e => set('distance_miles', e.target.value)} fullWidth /></Grid>
            <Grid item xs={4}><TextField label="Calories" type="number" value={form.calories} onChange={e => set('calories', e.target.value)} fullWidth /></Grid>
            <Grid item xs={4}><TextField label="Avg Heart Rate" type="number" value={form.heart_rate_avg} onChange={e => set('heart_rate_avg', e.target.value)} fullWidth /></Grid>
            <Grid item xs={4}><TextField label="Max Heart Rate" type="number" value={form.heart_rate_max} onChange={e => set('heart_rate_max', e.target.value)} fullWidth /></Grid>
            <Grid item xs={4}><TextField label="Steps" type="number" value={form.steps} onChange={e => set('steps', e.target.value)} fullWidth /></Grid>
            <Grid item xs={4}><TextField label="Sets" type="number" value={form.sets} onChange={e => set('sets', e.target.value)} fullWidth /></Grid>
            <Grid item xs={4}><TextField label="Reps" type="number" value={form.reps} onChange={e => set('reps', e.target.value)} fullWidth /></Grid>
            <Grid item xs={4}><TextField label="Weight (lbs)" type="number" value={form.weight_lbs} onChange={e => set('weight_lbs', e.target.value)} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Notes" multiline rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} fullWidth /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.type || !form.date}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete this exercise log?</DialogTitle>
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
