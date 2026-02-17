import Database from 'better-sqlite3-multiple-ciphers';
import dotenv from 'dotenv';

dotenv.config();

const db = new Database('data/health-secure.db');
db.pragma(`key='${process.env.DB_ENCRYPTION_KEY}'`);
db.pragma('cipher_compatibility = 4');

console.log('=== MEALS ===');
const meals = db.prepare(`
  SELECT m.*, 
    (SELECT COUNT(*) FROM meal_foods WHERE meal_id = m.id) as food_count
  FROM meals m
`).all();
console.log(JSON.stringify(meals, null, 2));

console.log('\n=== MEAL FOODS ===');
const mealFoods = db.prepare(`
  SELECT mf.*, f.name as food_name
  FROM meal_foods mf
  JOIN foods f ON f.id = mf.food_id
`).all();
console.log(JSON.stringify(mealFoods, null, 2));

console.log('\n=== NUTRITION GOALS ===');
const goals = db.prepare('SELECT * FROM nutrition_goals').all();
console.log(JSON.stringify(goals, null, 2));

db.close();
