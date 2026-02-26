import React, { useState, useEffect } from 'react';
// Packaged Electron app has no HTTP nutrition server — IPC handlers not yet implemented.
// Guard all /api/nutrition/* calls so the component degrades gracefully.
const isElectron = typeof window !== 'undefined' && !!window.electron;
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Autocomplete,
  Stack,
  Divider
} from '@mui/material';
import {
  Restaurant as RestaurantIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Psychology as PsychologyIcon,
  Stars as StarsIcon
} from '@mui/icons-material';

export default function NutritionTracker() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [allFoods, setAllFoods] = useState([]);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [editingMealId, setEditingMealId] = useState(null);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [analyzingMeal, setAnalyzingMeal] = useState(false);
  
  // Meal logging form state
  const [mealForm, setMealForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    meal_type: 'lunch',
    description: '',
    treatment_phase: 'maintenance',
    energy_level: 7,
    nausea_level: 0,
    notes: '',
    foods: []
  });
  
  useEffect(() => {
    fetchDashboard();
    fetchFoods();
  }, []);
  
  const fetchDashboard = async () => {
    if (isElectron) {
      // window.electron: no nutrition IPC implemented yet — degrade gracefully
      setLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/nutrition/dashboard');
      const data = await response.json();
      setDashboard(data);
      
      // Fetch recommendations
      const recsResponse = await fetch('/api/nutrition/recommendations');
      const recsData = await recsResponse.json();
      setRecommendations(recsData);
    } catch (error) {
      console.error('Error fetching nutrition dashboard:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchFoods = async () => {
    if (isElectron) {
      // window.electron: no nutrition IPC implemented yet — degrade gracefully
      return;
    }
    try {
      const response = await fetch('/api/nutrition/foods');
      const data = await response.json();
      setAllFoods(data);
    } catch (error) {
      console.error('Error fetching foods:', error);
    }
  };
  
  const handleLogMeal = async () => {
    // Validate required fields
    if (!mealForm.description || mealForm.description.trim() === '') {
      alert('Please describe what you ate');
      return;
    }
    
    if (isElectron) {
      // window.electron: no nutrition IPC implemented yet — log is a no-op in packaged app
      alert('Nutrition logging is not yet available in the offline app.');
      return;
    }

    try {
      console.log('Submitting meal:', mealForm);
      
      const url = editingMealId 
        ? `/api/nutrition/meals/${editingMealId}`
        : '/api/nutrition/meals';
      
      const method = editingMealId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mealForm)
      });
      
      const data = await response.json();
      console.log('Response:', response.status, data);
      
      if (response.ok) {
        setLogDialogOpen(false);
        setEditingMealId(null);
        fetchDashboard(); // Refresh
        
        // Reset form
        setMealForm({
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          meal_type: 'lunch',
          description: '',
          treatment_phase: 'maintenance',
          energy_level: 7,
          nausea_level: 0,
          notes: '',
          foods: []
        });
        
        alert(editingMealId ? '✅ Meal updated successfully!' : '✅ Meal logged successfully!');
      } else {
        alert(`❌ Failed to save meal: ${data.error || data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error logging meal:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };
  
  const handleEditMeal = (meal) => {
    setEditingMealId(meal.id);
    setMealForm({
      date: meal.date,
      time: meal.time || '',
      meal_type: meal.meal_type,
      description: meal.description,
      treatment_phase: meal.treatment_phase || 'maintenance',
      energy_level: meal.energy_level || 7,
      nausea_level: meal.nausea_level || 0,
      notes: meal.notes || '',
      foods: meal.foods || []
    });
    setLogDialogOpen(true);
  };
  
  const handleDeleteMeal = async (mealId) => {
    if (!confirm('Are you sure you want to delete this meal?')) {
      return;
    }
    
    if (isElectron) {
      // window.electron: no nutrition IPC implemented yet
      alert('Meal deletion is not yet available in the offline app.');
      return;
    }

    try {
      const response = await fetch(`/api/nutrition/meals/${mealId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert('✅ Meal deleted successfully!');
        fetchDashboard(); // Refresh
      } else {
        const data = await response.json();
        alert(`❌ Failed to delete meal: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting meal:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };
  
  const handleAnalyzeMeal = async (meal, forceReanalyze = false) => {
    setAnalyzingMeal(true);
    setAnalysisDialogOpen(true);
    if (forceReanalyze) {
      setCurrentAnalysis(null); // Clear previous when re-analyzing
    }
    
    try {
      let data;
      const isElectronAI = typeof window !== 'undefined' && window.electron?.ai?.analyzeMeal;

      if (isElectronAI) {
        // Packaged Electron app: use IPC (no HTTP server)
        data = await window.electron.ai.analyzeMeal(meal.description, {
          treatment_phase: meal.treatment_phase,
          energy_level:    meal.energy_level,
          nausea_level:    meal.nausea_level,
        });
      } else {
        // Web / dev mode: use HTTP
        const response = await fetch('/api/nutrition/analyze-meal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            mealId:          meal.id,
            description:     meal.description,
            treatment_phase: meal.treatment_phase,
            energy_level:    meal.energy_level,
            nausea_level:    meal.nausea_level,
            forceReanalyze,
          }),
        });
        data = await response.json();
      }
      
      if (data.success) {
        setCurrentAnalysis({
          ...data.analysis,
          cached: data.cached,
          savedAt: data.savedAt,
          mealData: meal // Store meal data for re-analysis
        });
      } else {
        setCurrentAnalysis({ error: data.error || data.message || 'Analysis failed' });
      }
    } catch (error) {
      console.error('Error analyzing meal:', error);
      setCurrentAnalysis({ error: error.message });
    } finally {
      setAnalyzingMeal(false);
    }
  };
  
  if (loading) {
    return <LinearProgress />;
  }
  
  const genomicScore = dashboard?.summary?.genomicScore || 0;
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🥗 Nutrition Tracker
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Genomics-Driven Meal Planning & Anti-Cancer Nutrition
      </Typography>
      
      {/* Today's Genomic Plate Summary */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h5" gutterBottom>
                Today's Genomic Nutrition Score
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 'bold', mb: 1 }}>
                {genomicScore}%
              </Typography>
              <Typography variant="body1">
                Supporting {dashboard?.summary?.pathwaysCovered || 0} of {dashboard?.summary?.pathwaysTotal || 0} active pathways
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                {dashboard?.summary?.mealsLogged || 0} meals logged today
              </Typography>
            </Grid>
            <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => setLogDialogOpen(true)}
                sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
              >
                Log Meal
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Pathway Coverage */}
      {dashboard?.pathwayCoverage && dashboard.pathwayCoverage.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              ✅ Pathways Supported Today
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              {dashboard.pathwayCoverage.map((pathway) => (
                <Grid item xs={12} md={6} key={pathway.id}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      {pathway.pathway_name}
                    </Typography>
                    <Chip 
                      label={`${pathway.food_count} foods`} 
                      size="small" 
                      color="success" 
                      sx={{ mr: 1 }} 
                    />
                    <Chip 
                      label={`Potency: ${pathway.avg_potency?.toFixed(1)}/10`} 
                      size="small" 
                      color="primary" 
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Foods: {pathway.foods}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}
      
      {/* Recommendations for Uncovered Pathways */}
      {recommendations.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              💡 Recommended Foods (Fill Pathway Gaps)
            </Typography>
            <Divider sx={{ my: 2 }} />
            {recommendations.map((rec, idx) => (
              <Box key={idx} sx={{ mb: 3 }}>
                <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Pathway not supported today: {rec.pathway}
                  </Typography>
                </Alert>
                <Grid container spacing={2}>
                  {rec.foods.map((food) => (
                    <Grid item xs={12} sm={6} md={4} key={food.id}>
                      <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {food.name}
                        </Typography>
                        <Chip 
                          label={`Anti-cancer: ${food.anti_cancer_score}/10`} 
                          size="small" 
                          color="success" 
                          sx={{ mt: 1, mb: 1 }} 
                        />
                        <Typography variant="caption" display="block" color="text.secondary">
                          {food.mechanism}
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                          Evidence: {food.evidence_level}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Today's Meals */}
      {dashboard?.meals && dashboard.meals.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🍽️ Today's Meals
            </Typography>
            <Divider sx={{ my: 2 }} />
            {dashboard.meals.map((meal) => (
              <Paper key={meal.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {meal.meal_type.toUpperCase()}
                    </Typography>
                    <Typography variant="body2">
                      {meal.time || 'No time specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={7}>
                    <Typography variant="body1" gutterBottom>
                      {meal.description}
                    </Typography>
                    {meal.foods && meal.foods.length > 0 && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                        {meal.foods.map((food, idx) => (
                          <Chip 
                            key={idx}
                            label={`${food.name} (${food.portion_size})`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    )}
                    {meal.energy_level && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Energy: {meal.energy_level}/10 | Nausea: {meal.nausea_level}/10
                      </Typography>
                    )}
                  </Grid>
                  <Grid item xs={12} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                    <Button
                      size="small"
                      startIcon={<StarsIcon />}
                      onClick={() => handleAnalyzeMeal(meal)}
                      variant="contained"
                      color="secondary"
                    >
                      Rate This Meal
                    </Button>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleEditMeal(meal)}
                      variant="outlined"
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDeleteMeal(meal.id)}
                      variant="outlined"
                      color="error"
                    >
                      Delete
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </CardContent>
        </Card>
      )}
      
      {dashboard?.meals && dashboard.meals.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No meals logged today. Click "Log Meal" to start tracking your genomic nutrition!
        </Alert>
      )}
      
      {/* Meal Logging Dialog */}
      <Dialog open={logDialogOpen} onClose={() => { setLogDialogOpen(false); setEditingMealId(null); }} maxWidth="md" fullWidth>
        <DialogTitle>{editingMealId ? 'Edit Meal' : 'Log Meal'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={mealForm.date}
                onChange={(e) => setMealForm({ ...mealForm, date: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Time"
                type="time"
                value={mealForm.time}
                onChange={(e) => setMealForm({ ...mealForm, time: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Meal Type</InputLabel>
                <Select
                  value={mealForm.meal_type}
                  label="Meal Type"
                  onChange={(e) => setMealForm({ ...mealForm, meal_type: e.target.value })}
                >
                  <MenuItem value="breakfast">Breakfast</MenuItem>
                  <MenuItem value="lunch">Lunch</MenuItem>
                  <MenuItem value="dinner">Dinner</MenuItem>
                  <MenuItem value="snack">Snack</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Treatment Phase</InputLabel>
                <Select
                  value={mealForm.treatment_phase}
                  label="Treatment Phase"
                  onChange={(e) => setMealForm({ ...mealForm, treatment_phase: e.target.value })}
                >
                  <MenuItem value="chemo_week">Chemo Week</MenuItem>
                  <MenuItem value="recovery_week">Recovery Week</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="pre_treatment">Pre-Treatment</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="What did you eat?"
                placeholder="e.g., Organic carrot juice with ginger and turmeric"
                value={mealForm.description}
                onChange={(e) => setMealForm({ ...mealForm, description: e.target.value })}
                required
                helperText="Describe your meal (required)"
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={allFoods}
                getOptionLabel={(option) => option.name}
                value={mealForm.foods.map(f => allFoods.find(food => food.id === f.food_id)).filter(Boolean)}
                onChange={(event, newValue) => {
                  setMealForm({
                    ...mealForm,
                    foods: newValue.map(food => ({
                      food_id: food.id,
                      portion_size: '1 serving'
                    }))
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Add anti-cancer foods (optional)"
                    placeholder="Select foods from database..."
                    helperText="Select from our database of anti-cancer foods for pathway tracking"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.name}
                      {...getTagProps({ index })}
                      color="primary"
                      size="small"
                    />
                  ))
                }
              />
            </Grid>
            {mealForm.foods.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Portion Sizes:
                </Typography>
                <Stack spacing={1}>
                  {mealForm.foods.map((food, idx) => {
                    const foodData = allFoods.find(f => f.id === food.food_id);
                    return (
                      <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ minWidth: 150 }}>
                          {foodData?.name}:
                        </Typography>
                        <TextField
                          size="small"
                          value={food.portion_size}
                          onChange={(e) => {
                            const newFoods = [...mealForm.foods];
                            newFoods[idx].portion_size = e.target.value;
                            setMealForm({ ...mealForm, foods: newFoods });
                          }}
                          placeholder="e.g., 1 cup, 2 tbsp, 100g"
                          sx={{ flexGrow: 1 }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Energy Level After Meal"
                helperText="1 = very tired, 10 = energized"
                value={mealForm.energy_level}
                onChange={(e) => setMealForm({ ...mealForm, energy_level: parseInt(e.target.value) || 7 })}
                inputProps={{ min: 1, max: 10 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Nausea Level"
                helperText="0 = none, 10 = severe"
                value={mealForm.nausea_level}
                onChange={(e) => setMealForm({ ...mealForm, nausea_level: parseInt(e.target.value) || 0 })}
                inputProps={{ min: 0, max: 10 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes (optional)"
                placeholder="Any observations about this meal..."
                value={mealForm.notes}
                onChange={(e) => setMealForm({ ...mealForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setLogDialogOpen(false); setEditingMealId(null); }}>Cancel</Button>
          <Button onClick={handleLogMeal} variant="contained">
            {editingMealId ? 'Update Meal' : 'Log Meal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Meal Analysis Dialog */}
      <Dialog open={analysisDialogOpen} onClose={() => setAnalysisDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PsychologyIcon color="secondary" />
              <Typography variant="h6">AI Meal Analysis</Typography>
            </Box>
            {currentAnalysis && currentAnalysis.cached && !analyzingMeal && (
              <Chip 
                label={`Saved ${new Date(currentAnalysis.savedAt).toLocaleDateString()}`}
                color="info" 
                size="small" 
                icon={<CheckCircleIcon />}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {analyzingMeal && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Analyzing your meal against your genomic profile...
              </Typography>
            </Box>
          )}
          
          {currentAnalysis && currentAnalysis.error && (
            <Alert severity="error">
              {currentAnalysis.error}
            </Alert>
          )}
          
          {currentAnalysis && !currentAnalysis.error && (
            <Box>
              {/* Overall Score */}
              <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight="bold">
                    {currentAnalysis.overall_score}/100
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    Overall Health Score
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 2, opacity: 0.9 }}>
                    {currentAnalysis.summary}
                  </Typography>
                </CardContent>
              </Card>

              {/* Category Scores */}
              {currentAnalysis.category_scores && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Category Breakdown</Typography>
                    <Grid container spacing={2}>
                      {Object.entries(currentAnalysis.category_scores).map(([category, score]) => (
                        <Grid item xs={12} sm={6} key={category}>
                          <Box sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                {category.replace(/_/g, ' ')}
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">{score}/100</Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={score} 
                              sx={{ height: 8, borderRadius: 4 }}
                              color={score >= 75 ? 'success' : score >= 50 ? 'warning' : 'error'}
                            />
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Pathway Support */}
              {currentAnalysis.pathway_support && currentAnalysis.pathway_support.length > 0 && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon color="success" />
                      Genomic Pathway Support
                    </Typography>
                    <Stack spacing={1}>
                      {currentAnalysis.pathway_support.map((pathway, idx) => (
                        <Chip 
                          key={idx}
                          label={pathway}
                          color="success"
                          variant="outlined"
                          sx={{ height: 'auto', py: 1, '& .MuiChip-label': { whiteSpace: 'normal' } }}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Strengths */}
              {currentAnalysis.strengths && currentAnalysis.strengths.length > 0 && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="success.main">✓ What's Working</Typography>
                    <Stack spacing={1}>
                      {currentAnalysis.strengths.map((strength, idx) => (
                        <Alert key={idx} severity="success" variant="outlined">
                          {strength}
                        </Alert>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Gaps & Recommendations */}
              {currentAnalysis.gaps && currentAnalysis.gaps.length > 0 && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="warning.main">⚠ Areas to Improve</Typography>
                    <Stack spacing={1}>
                      {currentAnalysis.gaps.map((gap, idx) => (
                        <Alert key={idx} severity="warning" variant="outlined">
                          {gap}
                        </Alert>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {currentAnalysis.recommendations && currentAnalysis.recommendations.length > 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">💡 Recommendations</Typography>
                    <Stack spacing={1}>
                      {currentAnalysis.recommendations.map((rec, idx) => (
                        <Alert key={idx} severity="info" variant="outlined">
                          {rec}
                        </Alert>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Box>
            {currentAnalysis && currentAnalysis.cached && currentAnalysis.mealData && !analyzingMeal && (
              <Button 
                startIcon={<PsychologyIcon />}
                onClick={() => {
                  handleAnalyzeMeal(currentAnalysis.mealData, true);
                }}
                variant="outlined"
                color="secondary"
              >
                Re-analyze
              </Button>
            )}
          </Box>
          <Button onClick={() => setAnalysisDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
