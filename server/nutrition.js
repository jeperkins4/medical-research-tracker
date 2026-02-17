/**
 * Nutrition API - Meal logging and genomics-driven food recommendations
 */

import { query, run } from './db-secure.js';

/**
 * Get all foods in database
 */
export function getAllFoods() {
  return query('SELECT * FROM foods ORDER BY anti_cancer_score DESC, name ASC');
}

/**
 * Get food by ID with pathway connections
 */
export function getFoodWithPathways(foodId) {
  const food = query('SELECT * FROM foods WHERE id = ?', [foodId])[0];
  
  if (!food) return null;
  
  const pathways = query(`
    SELECT fp.*, gp.pathway_name, gp.pathway_category
    FROM food_pathways fp
    JOIN genomic_pathways gp ON fp.pathway_id = gp.id
    WHERE fp.food_id = ?
    ORDER BY fp.potency_score DESC
  `, [foodId]);
  
  return { ...food, pathways };
}

/**
 * Get meals with foods for a date range
 */
export function getMeals(startDate, endDate, limit = 50) {
  const meals = query(`
    SELECT * FROM meals 
    WHERE date BETWEEN ? AND ?
    ORDER BY date DESC, time DESC
    LIMIT ?
  `, [startDate, endDate, limit]);
  
  // Enrich with foods
  return meals.map(meal => {
    const foods = query(`
      SELECT f.*, mf.portion_size
      FROM meal_foods mf
      JOIN foods f ON mf.food_id = f.id
      WHERE mf.meal_id = ?
    `, [meal.id]);
    
    return { ...meal, foods };
  });
}

/**
 * Get today's meals (using EST timezone)
 */
export function getTodaysMeals() {
  // Use EST timezone to match user's local date
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const today = formatter.format(new Date()); // Returns YYYY-MM-DD
  
  return getMeals(today, today);
}

/**
 * Log a new meal
 */
export function logMeal(mealData) {
  const { date, time, meal_type, description, treatment_phase, energy_level, nausea_level, notes, foods } = mealData;
  
  // Insert meal
  const result = run(`
    INSERT INTO meals (date, time, meal_type, description, treatment_phase, energy_level, nausea_level, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [date, time, meal_type, description, treatment_phase, energy_level, nausea_level, notes]);
  
  const mealId = result.lastInsertRowid;
  
  // Insert meal-food associations
  if (foods && foods.length > 0) {
    const insertFood = run.bind(null, `INSERT INTO meal_foods (meal_id, food_id, portion_size) VALUES (?, ?, ?)`);
    
    foods.forEach(food => {
      run(`INSERT INTO meal_foods (meal_id, food_id, portion_size) VALUES (?, ?, ?)`, 
        [mealId, food.food_id, food.portion_size]);
    });
  }
  
  return { id: mealId, ...mealData };
}

/**
 * Update an existing meal
 */
export function updateMeal(mealId, mealData) {
  const { date, time, meal_type, description, treatment_phase, energy_level, nausea_level, notes, foods } = mealData;
  
  // Update meal
  run(`
    UPDATE meals 
    SET date = ?, time = ?, meal_type = ?, description = ?, 
        treatment_phase = ?, energy_level = ?, nausea_level = ?, notes = ?
    WHERE id = ?
  `, [date, time, meal_type, description, treatment_phase, energy_level, nausea_level, notes, mealId]);
  
  // Delete existing meal-food associations
  run('DELETE FROM meal_foods WHERE meal_id = ?', [mealId]);
  
  // Insert new meal-food associations
  if (foods && foods.length > 0) {
    foods.forEach(food => {
      run(`INSERT INTO meal_foods (meal_id, food_id, portion_size) VALUES (?, ?, ?)`, 
        [mealId, food.food_id, food.portion_size]);
    });
  }
  
  return { id: mealId, ...mealData };
}

/**
 * Delete a meal
 */
export function deleteMeal(mealId) {
  // Delete meal-food associations (cascade will handle this, but explicit is clear)
  run('DELETE FROM meal_foods WHERE meal_id = ?', [mealId]);
  
  // Delete meal
  const result = run('DELETE FROM meals WHERE id = ?', [mealId]);
  
  return { deleted: result.changes > 0 };
}

/**
 * Get pathway coverage for a date (which pathways were supported by foods eaten)
 */
export function getPathwayCoverageForDate(date) {
  const pathwayCoverage = query(`
    SELECT 
      gp.id,
      gp.pathway_name,
      gp.pathway_category,
      COUNT(DISTINCT f.id) as food_count,
      AVG(fp.potency_score) as avg_potency,
      GROUP_CONCAT(DISTINCT f.name) as foods
    FROM meals m
    JOIN meal_foods mf ON m.id = mf.meal_id
    JOIN foods f ON mf.food_id = f.id
    JOIN food_pathways fp ON f.id = fp.food_id
    JOIN genomic_pathways gp ON fp.pathway_id = gp.id
    WHERE m.date = ?
    GROUP BY gp.id, gp.pathway_name, gp.pathway_category
    ORDER BY avg_potency DESC
  `, [date]);
  
  return pathwayCoverage;
}

/**
 * Get genomic nutrition dashboard (today's plate analysis)
 */
export function getGenomicNutritionDashboard() {
  try {
    // Use EST timezone to match user's local date
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const today = formatter.format(new Date()); // Returns YYYY-MM-DD
    
    // Get today's meals
    const meals = getTodaysMeals();
    
    // Get pathway coverage (safe - returns empty array if no data)
    let pathwayCoverage = [];
    try {
      pathwayCoverage = getPathwayCoverageForDate(today);
    } catch (err) {
      console.log('No pathway coverage data yet:', err.message);
    }
    
    // Get user's active pathways (from mutations)
    let activePathways = [];
    try {
      activePathways = query(`
        SELECT DISTINCT gp.*
        FROM genomic_pathways gp
        JOIN mutation_pathway_map mpm ON gp.id = mpm.pathway_id
        JOIN genomic_mutations gm ON mpm.mutation_id = gm.id
      `);
    } catch (err) {
      console.log('No genomic pathways data yet:', err.message);
    }
  
    // Calculate coverage percentage
    const coveredPathwayIds = pathwayCoverage.map(p => p.id);
    const totalPathways = activePathways.length;
    const coveredPathways = activePathways.filter(p => coveredPathwayIds.includes(p.id)).length;
    const coveragePercent = totalPathways > 0 ? Math.round((coveredPathways / totalPathways) * 100) : 0;
    
    // Top foods eaten today
    let topFoods = [];
    try {
      topFoods = query(`
        SELECT 
          f.name,
          f.anti_cancer_score,
          COUNT(*) as times_eaten,
          GROUP_CONCAT(DISTINCT gp.pathway_name) as pathways_supported
        FROM meals m
        JOIN meal_foods mf ON m.id = mf.meal_id
        JOIN foods f ON mf.food_id = f.id
        LEFT JOIN food_pathways fp ON f.id = fp.food_id
        LEFT JOIN genomic_pathways gp ON fp.pathway_id = gp.id
        WHERE m.date = ?
        GROUP BY f.id, f.name, f.anti_cancer_score
        ORDER BY f.anti_cancer_score DESC
        LIMIT 10
      `, [today]);
    } catch (err) {
      console.log('No food data for top foods yet:', err.message);
    }
    
    return {
      date: today,
      meals,
      pathwayCoverage,
      activePathways,
      totalPathways,
      coveredPathways,
      coveragePercent,
      topFoods,
      summary: {
        mealsLogged: meals.length,
        pathwaysCovered: coveredPathways,
        pathwaysTotal: totalPathways,
        genomicScore: coveragePercent
      }
    };
  } catch (error) {
    console.error('Dashboard error:', error);
    // Return minimal safe response with EST date
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return {
      date: formatter.format(new Date()),
      meals: [],
      pathwayCoverage: [],
      activePathways: [],
      totalPathways: 0,
      coveredPathways: 0,
      coveragePercent: 0,
      topFoods: [],
      summary: {
        mealsLogged: 0,
        pathwaysCovered: 0,
        pathwaysTotal: 0,
        genomicScore: 0
      }
    };
  }
}

/**
 * Get recommended foods for uncovered pathways
 */
export function getRecommendedFoods(date) {
  try {
    let pathwayCoverage = [];
    try {
      pathwayCoverage = getPathwayCoverageForDate(date);
    } catch (err) {
      console.log('No pathway coverage for recommendations:', err.message);
    }
    
    const coveredPathwayIds = pathwayCoverage.map(p => p.id);
    
    // Get user's active pathways that aren't covered
    let uncoveredPathways = [];
    try {
      uncoveredPathways = query(`
        SELECT DISTINCT gp.*
        FROM genomic_pathways gp
        JOIN mutation_pathway_map mpm ON gp.id = mpm.pathway_id
        JOIN genomic_mutations gm ON mpm.mutation_id = gm.id
        WHERE gp.id NOT IN (${coveredPathwayIds.length > 0 ? coveredPathwayIds.join(',') : '0'})
      `);
    } catch (err) {
      console.log('No uncovered pathways data:', err.message);
      return [];
    }
    
    // For each uncovered pathway, recommend top foods
    const recommendations = [];
    
    for (const pathway of uncoveredPathways) {
      try {
        const foods = query(`
          SELECT 
            f.*,
            fp.mechanism,
            fp.potency_score,
            fp.evidence_level
          FROM food_pathways fp
          JOIN foods f ON fp.food_id = f.id
          WHERE fp.pathway_id = ?
          ORDER BY fp.potency_score DESC
          LIMIT 3
        `, [pathway.id]);
        
        if (foods.length > 0) {
          recommendations.push({
            pathway: pathway.pathway_name,
            pathway_category: pathway.pathway_category,
            foods
          });
        }
      } catch (err) {
        console.log(`No food recommendations for pathway ${pathway.id}:`, err.message);
      }
    }
    
    return recommendations;
  } catch (error) {
    console.error('Recommendations error:', error);
    return [];
  }
}
