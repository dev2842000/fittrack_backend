-- FitTrack Database Schema (PostgreSQL / Neon)
-- Run this once against your Neon database

-- Users (M2)
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100)        NOT NULL,
  email      VARCHAR(150) UNIQUE NOT NULL,
  password   VARCHAR(255)        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exercises (M3)
CREATE TABLE IF NOT EXISTS exercises (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  muscle_group VARCHAR(100) NOT NULL,
  is_custom    BOOLEAN      DEFAULT FALSE,
  created_by   INT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Workouts (M4)
CREATE TABLE IF NOT EXISTS workouts (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(150),
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes        TEXT
);

-- Workout sets (M4)
CREATE TABLE IF NOT EXISTS sets (
  id          SERIAL PRIMARY KEY,
  workout_id  INT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INT NOT NULL REFERENCES exercises(id),
  set_number  INT NOT NULL,
  weight_kg   NUMERIC(6,2),
  reps        INT,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Bodyweight log (M5)
CREATE TABLE IF NOT EXISTS bodyweight_log (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight_kg   NUMERIC(5,2) NOT NULL,
  logged_date DATE NOT NULL,
  UNIQUE (user_id, logged_date)
);
