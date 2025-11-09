import express from "express";
import pg from "pg";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up your PostgreSQL pool
// We'll need this for the Passport database logic
const db = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const NUMERIC_OID = 1700;
pg.types.setTypeParser(NUMERIC_OID, (value) => {
  return value === null ? null : parseFloat(value);
});

const app = express();

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("trust proxy", 1);

// Configure Express Session
// This MUST come before Passport
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Add this to your .env file
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Set to true in production (HTTPS)
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session()); // This links Passport to the session

// Main Page Route
app.get("/", (req, res) => {
  res.render("index");
});

// Auth Routes
app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

// Page Routes
app.get("/services", (req, res) => {
  res.render("services");
});

app.get("/doctors", (req, res) => {
  res.render("doctors");
});

// Patient Portal Route
app.get("/dashboard", (req, res) => {
  // TODO: Add middleware to check if user is authenticated
  // Example: if (!req.isAuthenticated()) { return res.redirect("/login"); }
  res.render("dashboard"); // Add { user: req.user }
});

// Passport Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID, // Add to .env
      clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Add to .env
      callbackURL: "http://localhost:3000/auth/google/callback", // Must match Google Console
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists in your DB
        const result = await db.query(
          "SELECT * FROM users WHERE google_id = $1",
          [profile.id]
        );

        if (result.rows.length > 0) {
          // User exists, log them in
          return done(null, result.rows[0]);
        } else {
          // User does not exist, create them in your DB
          const newUser = await db.query(
            "INSERT INTO users (google_id, email, first_name, last_name, profile_pic) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [
              profile.id,
              profile.emails[0].value,
              profile.name.givenName,
              profile.name.familyName,
              profile.photos[0].value,
            ]
          );
          return done(null, newUser.rows[0]);
        }
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Passport Google Auth Routes
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/dashboard", // On success, go to dashboard
    failureRedirect: "/login", // On failure, go back to login
  })
);

// Passport Serialization
// Tells Passport how to save a user to the session
passport.serializeUser((user, done) => {
  done(null, user.id); // Save only the user ID
});

// Passport Deserialization
// Tells Passport how to get a user from the session
passport.deserializeUser(async (id, done) => {
  try {
    // Fetch the user from the database using their ID
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    if (result.rows.length > 0) {
      done(null, result.rows[0]); // Add user to req.user
    } else {
      done(new Error("User not found"));
    }
  } catch (err) {
    done(err);
  }
});

// === Server Start ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
