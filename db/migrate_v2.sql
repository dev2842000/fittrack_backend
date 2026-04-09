-- FitTrack v2 Migration
-- Run this against your Neon database after initial schema

-- 1. Add instructions column to exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions TEXT;

-- 2. Seed instructions for common exercises
UPDATE exercises SET instructions = 'Lie flat on bench, grip bar slightly wider than shoulders. Unrack and lower bar to mid-chest. Press explosively until arms locked. Keep feet flat, back neutral, shoulders retracted.' WHERE name ILIKE 'bench press';
UPDATE exercises SET instructions = 'Stand feet shoulder-width, bar over mid-foot. Brace core, grip bar outside legs. Drive through heels keeping bar close to body. Lockout hips at top, lower with control.' WHERE name ILIKE 'deadlift';
UPDATE exercises SET instructions = 'Bar on upper traps or rear delts. Feet shoulder-width, toes slightly out. Hinge hips back, lower until thighs parallel. Drive through heels, chest up throughout.' WHERE name ILIKE 'squat' OR name ILIKE 'back squat';
UPDATE exercises SET instructions = 'Grip bar slightly wider than shoulder-width. Hang with arms straight. Initiate with shoulder blades, pull chest to bar. Control descent fully.' WHERE name ILIKE 'pull-up' OR name ILIKE 'pull up' OR name ILIKE 'pullup';
UPDATE exercises SET instructions = 'Hinge at hips until torso near parallel, back flat. Pull bar to lower chest/upper abdomen. Squeeze shoulder blades at top. Lower with control.' WHERE name ILIKE 'barbell row' OR name ILIKE 'bent over row';
UPDATE exercises SET instructions = 'Bar at shoulder height, grip just outside shoulders. Brace core, press bar directly overhead until elbows lock. Lower back to collarbone with control.' WHERE name ILIKE 'overhead press' OR name ILIKE 'ohp' OR name ILIKE 'military press';
UPDATE exercises SET instructions = 'Support on parallel bars. Slight forward lean for chest. Lower until upper arms are parallel to floor. Press back to start, lock elbows at top.' WHERE name ILIKE 'dip' OR name ILIKE 'dips' OR name ILIKE 'chest dip';
UPDATE exercises SET instructions = 'Stand tall, dumbbell in each hand. Curl weight up by flexing at elbow, keeping upper arm still. Squeeze at top, lower with control.' WHERE name ILIKE 'bicep curl' OR name ILIKE 'dumbbell curl' OR name ILIKE 'barbell curl';
UPDATE exercises SET instructions = 'Attach rope to high cable. Elbows pinned at sides. Extend forearms downward until straight, squeezing triceps. Control the return.' WHERE name ILIKE 'tricep pushdown' OR name ILIKE 'triceps pushdown' OR name ILIKE 'cable pushdown';
UPDATE exercises SET instructions = 'Step forward with one leg, lower rear knee toward floor. Keep front shin vertical, torso upright. Push back to starting position.' WHERE name ILIKE 'lunge' OR name ILIKE 'lunges' OR name ILIKE 'walking lunge';
UPDATE exercises SET instructions = 'Stand at cable, single arm. Pull handle to side of chest, elbow driving back. Squeeze lat at peak. Control return.' WHERE name ILIKE 'lat pulldown' OR name ILIKE 'cable pulldown';
UPDATE exercises SET instructions = 'Lie on incline bench 30-45°. Grip bar wider than shoulders. Lower to upper chest, press to lockout. Controls the eccentric.' WHERE name ILIKE 'incline bench' OR name ILIKE 'incline press';
UPDATE exercises SET instructions = 'Sit at machine, grip handles. Pull bar to upper chest with elbows flaring slightly back. Squeeze lats. Return with control.' WHERE name ILIKE 'lat pull' OR name ILIKE 'pulldown';
UPDATE exercises SET instructions = 'Lie on flat bench, dumbbells extended above chest. Lower arms in wide arc until chest stretch is felt. Bring dumbbells back up squeezing chest.' WHERE name ILIKE 'dumbbell fly' OR name ILIKE 'chest fly';
UPDATE exercises SET instructions = 'Lie on back, knees bent. Drive through heels and upper back to lift hips. Squeeze glutes at top. Lower slowly without touching floor.' WHERE name ILIKE 'hip thrust' OR name ILIKE 'glute bridge';
UPDATE exercises SET instructions = 'Stand on one leg or two. Rise up onto toes, hold briefly. Lower heel below platform for full range. Add weight to increase resistance.' WHERE name ILIKE 'calf raise' OR name ILIKE 'standing calf raise';
UPDATE exercises SET instructions = 'Lie face down, forearms on floor. Keep body in straight line from head to heels. Brace core and glutes. Hold position without sagging.' WHERE name ILIKE 'plank';
UPDATE exercises SET instructions = 'Upper back on bench, shoulders centered. Drive through heels and push hips high. Squeeze glutes at top. Barbell rests across hip crease.' WHERE name ILIKE 'barbell hip thrust';
UPDATE exercises SET instructions = 'Grip rings or bar. Start in dead hang. Pull yourself up until chin clears bar/rings. Lower with control for full range.' WHERE name ILIKE 'chin up' OR name ILIKE 'chin-up';
UPDATE exercises SET instructions = 'Hold dumbbells at sides. Raise arms to shoulder height, keeping slight bend in elbows. Control descent. Do not swing.' WHERE name ILIKE 'lateral raise' OR name ILIKE 'side raise';
UPDATE exercises SET instructions = 'Sit at machine. Place ankles under pad. Extend legs fully, squeezing quads at top. Lower with control through full range.' WHERE name ILIKE 'leg extension';
UPDATE exercises SET instructions = 'Lie face down on machine. Place ankles above pad. Curl heels to glutes, squeezing hamstrings. Lower with control.' WHERE name ILIKE 'leg curl' OR name ILIKE 'hamstring curl';
UPDATE exercises SET instructions = 'Sit at leg press. Feet shoulder-width on platform. Lower until knees ~90°, press back without locking out. Keep lower back in contact with pad.' WHERE name ILIKE 'leg press';
UPDATE exercises SET instructions = 'Stand holding dumbbells, palms facing in. Raise arms forward to shoulder height. Lower with control. Keep core tight.' WHERE name ILIKE 'front raise';
UPDATE exercises SET instructions = 'Hinge at hips, arm hanging straight. Pull dumbbell to hip height, elbow driving back. Brace on bench. Lower fully.' WHERE name ILIKE 'dumbbell row' OR name ILIKE 'one arm row';

-- 3. Create measurements table
CREATE TABLE IF NOT EXISTS measurements (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_date     DATE NOT NULL,
  chest_cm        NUMERIC(5,1),
  waist_cm        NUMERIC(5,1),
  hips_cm         NUMERIC(5,1),
  left_arm_cm     NUMERIC(5,1),
  right_arm_cm    NUMERIC(5,1),
  left_thigh_cm   NUMERIC(5,1),
  right_thigh_cm  NUMERIC(5,1),
  UNIQUE (user_id, logged_date)
);

-- 4. Add weekly_goal and age/height/sex columns to users if not present
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sex VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
