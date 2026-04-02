import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  ThreeDRotation as ThreeDIcon,
  ViewInAr as ViewInArIcon,
  Timeline as TimelineIcon,
  BookmarkBorder as BookmarkIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RotateLeft as RotateLeftIcon,
  RestartAlt as ResetIcon,
  Edit as EditIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import * as THREE from 'three';

const MODALITIES = ['CT', 'MRI', 'PET', 'PET/CT', 'X-Ray', 'Ultrasound', 'Bone Scan', 'DEXA'];
const BODY_REGIONS = [
  'Head/Neck', 'Chest', 'Abdomen', 'Pelvis', 'Abdomen/Pelvis',
  'Spine', 'Extremity', 'Whole Body', 'Brain', 'Breast'
];

const apiFetch = (url, options = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
};

// ─── 3D Volume Renderer ─────────────────────────────────────────────
function VolumeRenderer({ volumeData, annotations, onSliceChange }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const meshRef = useRef(null);
  const animationRef = useRef(null);
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: -0.3, y: 0.4 });

  const initScene = useCallback(() => {
    if (!mountRef.current || !volumeData) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 2.5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 3, 2);
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0x4466aa, 0.3);
    backLight.position.set(-2, -1, -2);
    scene.add(backLight);

    // Build volume mesh from data
    buildVolumeMesh(scene, volumeData);

    // Add annotation markers
    if (annotations && annotations.length > 0) {
      addAnnotationMarkers(scene, annotations);
    }

    // Animate
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      if (meshRef.current) {
        meshRef.current.rotation.x = rotationRef.current.x;
        meshRef.current.rotation.y = rotationRef.current.y;
      }

      renderer.render(scene, camera);
    };
    animate();
  }, [volumeData, annotations]);

  const buildVolumeMesh = (scene, data) => {
    const [sizeX, sizeY, sizeZ] = data.size;
    const group = new THREE.Group();

    // Create isosurface-like rendering using layered transparent planes
    // and a central volume representation
    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);

    // Body volume — semi-transparent outer shell
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0xd4a574,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const bodyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 32),
      bodyMaterial
    );
    bodyMesh.scale.set(1, 1.1, 0.75);
    group.add(bodyMesh);

    // Extract structures from volume data as point clouds / meshes
    const structures = extractStructures(data);

    structures.forEach(structure => {
      group.add(structure);
    });

    // Bounding wireframe
    const wireGeo = new THREE.BoxGeometry(1.3, 1.4, 1.0);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.3 });
    const wireframe = new THREE.LineSegments(new THREE.EdgesGeometry(wireGeo), wireMat);
    group.add(wireframe);

    // Axis helper lines (subtle)
    const axisLength = 0.75;
    const axisMaterial = (color) => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 });

    // X axis (red — lateral)
    const xGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-axisLength, -0.75, -0.55),
      new THREE.Vector3(axisLength, -0.75, -0.55)
    ]);
    group.add(new THREE.Line(xGeo, axisMaterial(0xff4444)));

    // Y axis (green — superior/inferior)
    const yGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.7, -axisLength, -0.55),
      new THREE.Vector3(-0.7, axisLength, -0.55)
    ]);
    group.add(new THREE.Line(yGeo, axisMaterial(0x44ff44)));

    // Z axis (blue — anterior/posterior)
    const zGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.7, -0.75, -axisLength),
      new THREE.Vector3(-0.7, -0.75, axisLength)
    ]);
    group.add(new THREE.Line(zGeo, axisMaterial(0x4444ff)));

    scene.add(group);
    meshRef.current = group;
  };

  const extractStructures = (data) => {
    const structures = [];
    const [sizeX, sizeY, sizeZ] = data.size;
    const vol = data.data;

    // Extract bone-like structures (high intensity > 0.8)
    const bonePositions = [];
    // Extract organ structures (medium intensity 0.4-0.7)
    const organPositions = [];
    // Extract lesion areas (specific intensity around 0.6-0.7)
    const lesionPositions = [];

    const step = 2; // Sample every 2nd voxel for performance
    for (let z = 0; z < sizeZ; z += step) {
      for (let y = 0; y < sizeY; y += step) {
        for (let x = 0; x < sizeX; x += step) {
          const value = vol[z][y][x];
          const px = (x / sizeX) * 1.2 - 0.6;
          const py = (y / sizeY) * 1.3 - 0.65;
          const pz = (z / sizeZ) * 0.9 - 0.45;

          if (value > 0.8) {
            bonePositions.push(px, py, pz);
          } else if (value > 0.55 && value <= 0.7) {
            lesionPositions.push(px, py, pz);
          } else if (value > 0.35 && value <= 0.55) {
            organPositions.push(px, py, pz);
          }
        }
      }
    }

    // Bone structure
    if (bonePositions.length > 0) {
      const boneGeo = new THREE.BufferGeometry();
      boneGeo.setAttribute('position', new THREE.Float32BufferAttribute(bonePositions, 3));
      const boneMat = new THREE.PointsMaterial({
        color: 0xe8dcc8,
        size: 0.035,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true
      });
      structures.push(new THREE.Points(boneGeo, boneMat));
    }

    // Organ structures
    if (organPositions.length > 0) {
      const organGeo = new THREE.BufferGeometry();
      organGeo.setAttribute('position', new THREE.Float32BufferAttribute(organPositions, 3));
      const organMat = new THREE.PointsMaterial({
        color: 0xcc7755,
        size: 0.03,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true
      });
      structures.push(new THREE.Points(organGeo, organMat));
    }

    // Lesion areas (highlighted)
    if (lesionPositions.length > 0) {
      const lesionGeo = new THREE.BufferGeometry();
      lesionGeo.setAttribute('position', new THREE.Float32BufferAttribute(lesionPositions, 3));
      const lesionMat = new THREE.PointsMaterial({
        color: 0xff6b6b,
        size: 0.04,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true
      });
      structures.push(new THREE.Points(lesionGeo, lesionMat));
    }

    return structures;
  };

  const addAnnotationMarkers = (scene, annotations) => {
    annotations.forEach(ann => {
      const markerGeo = new THREE.SphereGeometry(0.02, 8, 8);
      const markerMat = new THREE.MeshBasicMaterial({ color: ann.color || '#ff6b6b' });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(
        (ann.position_x || 0) / 32 - 0.6,
        (ann.position_y || 0) / 32 - 0.65,
        (ann.position_z || 0) / 32 - 0.45
      );

      // Ring around marker
      const ringGeo = new THREE.RingGeometry(0.025, 0.035, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ann.color || '#ff6b6b',
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(marker.position);

      scene.add(marker);
      scene.add(ring);
    });
  };

  // Mouse interaction handlers
  const handleMouseDown = (e) => {
    isDragging.current = true;
    previousMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMouse.current.x;
    const deltaY = e.clientY - previousMouse.current.y;

    rotationRef.current.y += deltaX * 0.005;
    rotationRef.current.x += deltaY * 0.005;

    previousMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e) => {
    if (cameraRef.current) {
      cameraRef.current.position.z = Math.max(1.5, Math.min(5, cameraRef.current.position.z + e.deltaY * 0.002));
    }
  };

  useEffect(() => {
    initScene();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [initScene]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Box
      ref={mountRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      sx={{
        width: '100%',
        height: 420,
        borderRadius: 2,
        overflow: 'hidden',
        cursor: isDragging.current ? 'grabbing' : 'grab',
        position: 'relative',
        border: '1px solid',
        borderColor: 'divider'
      }}
    />
  );
}

// ─── Multi-Planar Reconstruction View ────────────────────────────────
function MPRView({ volumeData, plane, sliceIndex, onSliceChange }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !volumeData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const [sizeX, sizeY, sizeZ] = volumeData.size;
    const vol = volumeData.data;

    const displaySize = 200;
    canvas.width = displaySize;
    canvas.height = displaySize;

    const imageData = ctx.createImageData(displaySize, displaySize);

    for (let dy = 0; dy < displaySize; dy++) {
      for (let dx = 0; dx < displaySize; dx++) {
        let value = 0;
        const sx = Math.floor((dx / displaySize) * sizeX);
        const sy = Math.floor((dy / displaySize) * sizeY);
        const sz = sliceIndex;

        try {
          if (plane === 'axial') {
            value = vol[Math.min(sz, sizeZ - 1)][Math.min(sy, sizeY - 1)][Math.min(sx, sizeX - 1)];
          } else if (plane === 'sagittal') {
            const vx = Math.min(sliceIndex, sizeX - 1);
            const vy = Math.min(Math.floor((dx / displaySize) * sizeY), sizeY - 1);
            const vz = Math.min(Math.floor((dy / displaySize) * sizeZ), sizeZ - 1);
            value = vol[vz][vy][vx];
          } else if (plane === 'coronal') {
            const vx = Math.min(Math.floor((dx / displaySize) * sizeX), sizeX - 1);
            const vy = Math.min(sliceIndex, sizeY - 1);
            const vz = Math.min(Math.floor((dy / displaySize) * sizeZ), sizeZ - 1);
            value = vol[vz][vy][vx];
          }
        } catch {
          value = 0;
        }

        const intensity = Math.floor(value * 255);
        const idx = (dy * displaySize + dx) * 4;
        imageData.data[idx] = intensity;
        imageData.data[idx + 1] = intensity;
        imageData.data[idx + 2] = intensity + Math.floor(value * 20); // slight blue tint
        imageData.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Draw crosshair
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(displaySize / 2, 0);
    ctx.lineTo(displaySize / 2, displaySize);
    ctx.moveTo(0, displaySize / 2);
    ctx.lineTo(displaySize, displaySize / 2);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(100, 180, 255, 0.8)';
    ctx.font = '11px monospace';
    ctx.fillText(plane.toUpperCase(), 4, 14);
    ctx.fillText(`Slice ${sliceIndex}`, 4, 26);

  }, [volumeData, plane, sliceIndex]);

  return (
    <Box sx={{ textAlign: 'center' }}>
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: 4,
          border: '1px solid rgba(100, 180, 255, 0.2)',
          cursor: 'crosshair',
          width: '100%',
          maxWidth: 200,
          imageRendering: 'pixelated'
        }}
      />
      <Slider
        size="small"
        value={sliceIndex}
        min={0}
        max={(volumeData?.size?.[plane === 'axial' ? 2 : plane === 'sagittal' ? 0 : 1] || 64) - 1}
        onChange={(_, val) => onSliceChange(val)}
        sx={{ maxWidth: 200, mt: 0.5 }}
      />
    </Box>
  );
}

// ─── Add Study Dialog ────────────────────────────────────────────────
function AddStudyDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState({
    study_date: new Date().toISOString().split('T')[0],
    modality: 'CT',
    body_region: 'Abdomen/Pelvis',
    description: '',
    facility: '',
    ordering_physician: '',
    findings: '',
    impression: ''
  });

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    onSave(form);
    setForm({
      study_date: new Date().toISOString().split('T')[0],
      modality: 'CT',
      body_region: 'Abdomen/Pelvis',
      description: '',
      facility: '',
      ordering_physician: '',
      findings: '',
      impression: ''
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Imaging Study</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={6}>
            <TextField
              label="Study Date"
              type="date"
              fullWidth
              value={form.study_date}
              onChange={handleChange('study_date')}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Modality"
              select
              fullWidth
              value={form.modality}
              onChange={handleChange('modality')}
            >
              {MODALITIES.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Body Region"
              select
              fullWidth
              value={form.body_region}
              onChange={handleChange('body_region')}
            >
              {BODY_REGIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Facility"
              fullWidth
              value={form.facility}
              onChange={handleChange('facility')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              fullWidth
              value={form.description}
              onChange={handleChange('description')}
              placeholder="e.g., CT Abdomen/Pelvis with contrast"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Ordering Physician"
              fullWidth
              value={form.ordering_physician}
              onChange={handleChange('ordering_physician')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Findings"
              fullWidth
              multiline
              rows={3}
              value={form.findings}
              onChange={handleChange('findings')}
              placeholder="Key findings from the radiology report..."
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Impression"
              fullWidth
              multiline
              rows={2}
              value={form.impression}
              onChange={handleChange('impression')}
              placeholder="Radiologist's overall impression..."
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">Add Study</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Study Detail Panel ──────────────────────────────────────────────
function StudyDetailPanel({ study, volumeData, volumeLoading, onLoadVolume, onAddAnnotation, onDeleteAnnotation }) {
  const [detailTab, setDetailTab] = useState(0);
  const [slices, setSlices] = useState({ axial: 32, sagittal: 32, coronal: 32 });
  const [annotationForm, setAnnotationForm] = useState({ label: '', description: '' });

  const handleAddAnnotation = () => {
    if (!annotationForm.label) return;
    onAddAnnotation({
      ...annotationForm,
      position_x: slices.sagittal,
      position_y: slices.coronal,
      position_z: slices.axial,
      slice_index: slices.axial,
      plane: 'axial'
    });
    setAnnotationForm({ label: '', description: '' });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            {study.description || `${study.modality} - ${study.body_region}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Chip label={study.modality} color="primary" size="small" />
            <Chip label={study.body_region} variant="outlined" size="small" />
            <Chip label={study.study_date} variant="outlined" size="small" />
            {study.facility && <Chip label={study.facility} variant="outlined" size="small" />}
          </Box>
        </Box>
      </Box>

      <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<ThreeDIcon />} label="3D View" />
        <Tab icon={<ViewInArIcon />} label="MPR Slices" />
        <Tab icon={<NotesIcon />} label="Report" />
        <Tab icon={<BookmarkIcon />} label="Annotations" />
      </Tabs>

      {/* 3D Volume View */}
      {detailTab === 0 && (
        <Box>
          {!volumeData && !volumeLoading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ThreeDIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                3D volume rendering for this study
              </Typography>
              <Button
                variant="contained"
                startIcon={<ViewInArIcon />}
                onClick={onLoadVolume}
                sx={{ mt: 1 }}
              >
                Load 3D View
              </Button>
            </Box>
          )}
          {volumeLoading && (
            <Box sx={{ py: 4 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                Generating volume rendering...
              </Typography>
            </Box>
          )}
          {volumeData && (
            <Box>
              <VolumeRenderer
                volumeData={volumeData}
                annotations={study.annotations || []}
              />
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Drag to rotate | Scroll to zoom
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Alert severity="info" variant="outlined" sx={{ fontSize: '0.85rem' }}>
                  <AlertTitle sx={{ fontSize: '0.9rem' }}>Volume Rendering</AlertTitle>
                  Showing volumetric reconstruction from {study.modality} data.
                  Bone structures appear white, soft tissue in warm tones, and areas of
                  interest are highlighted in red.
                </Alert>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* MPR Slice View */}
      {detailTab === 1 && (
        <Box>
          {!volumeData && !volumeLoading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Button variant="contained" onClick={onLoadVolume}>
                Load Volume Data
              </Button>
            </Box>
          )}
          {volumeLoading && <LinearProgress />}
          {volumeData && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <MPRView
                  volumeData={volumeData}
                  plane="axial"
                  sliceIndex={slices.axial}
                  onSliceChange={(v) => setSlices(s => ({ ...s, axial: v }))}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <MPRView
                  volumeData={volumeData}
                  plane="sagittal"
                  sliceIndex={slices.sagittal}
                  onSliceChange={(v) => setSlices(s => ({ ...s, sagittal: v }))}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <MPRView
                  volumeData={volumeData}
                  plane="coronal"
                  sliceIndex={slices.coronal}
                  onSliceChange={(v) => setSlices(s => ({ ...s, coronal: v }))}
                />
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {/* Report Tab */}
      {detailTab === 2 && (
        <Box>
          {study.findings ? (
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Findings
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {study.findings}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
              No findings recorded for this study. Edit the study to add radiology report findings.
            </Alert>
          )}

          {study.impression && (
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Impression
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>
                  {study.impression}
                </Typography>
              </CardContent>
            </Card>
          )}

          {study.comparison_notes && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Comparison
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {study.comparison_notes}
                </Typography>
              </CardContent>
            </Card>
          )}

          {study.ordering_physician && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Ordered by: {study.ordering_physician}
            </Typography>
          )}
        </Box>
      )}

      {/* Annotations Tab */}
      {detailTab === 3 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              label="Label"
              value={annotationForm.label}
              onChange={(e) => setAnnotationForm(f => ({ ...f, label: e.target.value }))}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Note"
              value={annotationForm.description}
              onChange={(e) => setAnnotationForm(f => ({ ...f, description: e.target.value }))}
              sx={{ flex: 2 }}
            />
            <Button
              variant="outlined"
              onClick={handleAddAnnotation}
              disabled={!annotationForm.label}
              startIcon={<AddIcon />}
            >
              Add
            </Button>
          </Box>

          {(!study.annotations || study.annotations.length === 0) ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No annotations yet. Add notes to mark areas of interest on this study.
            </Typography>
          ) : (
            <List dense>
              {study.annotations.map(ann => (
                <ListItem key={ann.id} sx={{ borderRadius: 1, mb: 0.5, bgcolor: 'action.hover' }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: ann.color || '#ff6b6b',
                      mr: 1.5,
                      flexShrink: 0
                    }}
                  />
                  <ListItemText
                    primary={ann.label}
                    secondary={ann.description || `${ann.plane} slice ${ann.slice_index}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small" onClick={() => onDeleteAnnotation(ann.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── Main RadiologyViewer Component ──────────────────────────────────
export default function RadiologyViewer() {
  const [studies, setStudies] = useState([]);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [volumeLoading, setVolumeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'timeline'

  useEffect(() => {
    fetchStudies();
  }, []);

  const fetchStudies = async () => {
    try {
      const response = await apiFetch('/api/radiology/studies');
      const data = await response.json();
      setStudies(data);
    } catch (error) {
      console.error('Error fetching radiology studies:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectStudy = async (id) => {
    try {
      const response = await apiFetch(`/api/radiology/studies/${id}`);
      const data = await response.json();
      setSelectedStudy(data);
      setVolumeData(null); // Reset volume when switching studies
    } catch (error) {
      console.error('Error fetching study:', error);
    }
  };

  const loadVolume = async () => {
    if (!selectedStudy) return;
    setVolumeLoading(true);
    try {
      const response = await apiFetch(`/api/radiology/studies/${selectedStudy.id}/volume`);
      const data = await response.json();
      setVolumeData(data);
    } catch (error) {
      console.error('Error loading volume:', error);
    } finally {
      setVolumeLoading(false);
    }
  };

  const handleAddStudy = async (form) => {
    try {
      const response = await apiFetch('/api/radiology/studies', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      if (response.ok) {
        setAddDialogOpen(false);
        fetchStudies();
      }
    } catch (error) {
      console.error('Error adding study:', error);
    }
  };

  const handleDeleteStudy = async (id) => {
    try {
      await apiFetch(`/api/radiology/studies/${id}`, { method: 'DELETE' });
      if (selectedStudy?.id === id) {
        setSelectedStudy(null);
        setVolumeData(null);
      }
      fetchStudies();
    } catch (error) {
      console.error('Error deleting study:', error);
    }
  };

  const handleAddAnnotation = async (annotation) => {
    if (!selectedStudy) return;
    try {
      const response = await apiFetch(`/api/radiology/studies/${selectedStudy.id}/annotations`, {
        method: 'POST',
        body: JSON.stringify(annotation)
      });
      if (response.ok) {
        selectStudy(selectedStudy.id);
      }
    } catch (error) {
      console.error('Error adding annotation:', error);
    }
  };

  const handleDeleteAnnotation = async (annotationId) => {
    try {
      await apiFetch(`/api/radiology/annotations/${annotationId}`, { method: 'DELETE' });
      selectStudy(selectedStudy.id);
    } catch (error) {
      console.error('Error deleting annotation:', error);
    }
  };

  const modalityIcon = (modality) => {
    switch (modality) {
      case 'CT': return 'CT';
      case 'MRI': return 'MR';
      case 'PET': case 'PET/CT': return 'PT';
      case 'X-Ray': return 'XR';
      case 'Ultrasound': return 'US';
      case 'Bone Scan': return 'BS';
      case 'DEXA': return 'DX';
      default: return modality.substring(0, 2).toUpperCase();
    }
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Radiology
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
          >
            <ToggleButton value="list">
              <Tooltip title="Study List"><ViewIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="timeline">
              <Tooltip title="Timeline"><TimelineIcon fontSize="small" /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Study
          </Button>
        </Box>
      </Box>

      {studies.length === 0 && !selectedStudy ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <ThreeDIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No imaging studies yet</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Add your CT, MRI, PET, or other imaging studies to track changes over time
            and view 3D reconstructions.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            Add Your First Study
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {/* Study List / Timeline */}
          <Grid item xs={12} md={selectedStudy ? 4 : 12}>
            {viewMode === 'list' ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Region</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {studies.map(study => (
                      <TableRow
                        key={study.id}
                        hover
                        selected={selectedStudy?.id === study.id}
                        onClick={() => selectStudy(study.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{study.study_date}</TableCell>
                        <TableCell>
                          <Chip
                            label={modalityIcon(study.modality)}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontFamily: 'monospace', minWidth: 36 }}
                          />
                        </TableCell>
                        <TableCell>{study.body_region}</TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {study.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleDeleteStudy(study.id); }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              /* Timeline View */
              <Box>
                {studies.map((study, idx) => (
                  <Box
                    key={study.id}
                    onClick={() => selectStudy(study.id)}
                    sx={{
                      display: 'flex',
                      cursor: 'pointer',
                      mb: 0,
                      '&:hover': { bgcolor: 'action.hover' },
                      borderRadius: 1,
                      p: 1.5,
                      bgcolor: selectedStudy?.id === study.id ? 'action.selected' : 'transparent',
                      borderLeft: '3px solid',
                      borderColor: selectedStudy?.id === study.id ? 'primary.main' : 'divider'
                    }}
                  >
                    <Box sx={{ minWidth: 85, mr: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {study.study_date}
                      </Typography>
                      <Chip
                        label={study.modality}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {study.body_region}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {study.description || study.facility || 'No description'}
                      </Typography>
                      {study.impression && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                          {study.impression.substring(0, 120)}{study.impression.length > 120 ? '...' : ''}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Grid>

          {/* Study Detail */}
          {selectedStudy && (
            <Grid item xs={12} md={8}>
              <Card variant="outlined">
                <CardContent>
                  <StudyDetailPanel
                    study={selectedStudy}
                    volumeData={volumeData}
                    volumeLoading={volumeLoading}
                    onLoadVolume={loadVolume}
                    onAddAnnotation={handleAddAnnotation}
                    onDeleteAnnotation={handleDeleteAnnotation}
                  />
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      <AddStudyDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSave={handleAddStudy}
      />
    </Box>
  );
}
