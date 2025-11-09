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

const db = new pg.Pool(); // Assumes PGHOST, PGUSER, etc. are in .env

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
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// NEW: Global middleware to pass user to all templates
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// === Main Page Route ===
app.get("/", (req, res) => {
  res.render("index");
});

// === Auth Routes ===
app.get("/login", (req, res) => {
  if (req.user) return res.redirect("/dashboard"); // Redirect if already logged in
  res.render("login");
});

app.get("/signup", (req, res) => {
  if (req.user) return res.redirect("/dashboard"); // Redirect if already logged in
  res.render("signup");
});

// NEW: Logout Route
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    // req.logout() is now async
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session:", err);
      }
      res.redirect("/"); // Redirect to homepage
    });
  });
});

// === Page Routes ===
app.get("/services", (req, res) => {
  res.render("services");
});

app.get("/doctors", (req, res) => {
  res.render("doctors");
});

// NEW: Placeholder Settings Route
app.get("/settings", (req, res) => {
  if (!req.user) return res.redirect("/login"); // Protect this route
  res.render("settings"); // We will create settings.ejs
});

// === Patient Portal Route ===
app.get("/dashboard", (req, res) => {
  if (!req.user) return res.redirect("/login"); // Protect this route
  res.render("dashboard"); // user is already passed via middleware
});

// === Passport Google OAuth Strategy ===
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await db.query(
          "SELECT * FROM users WHERE google_id = $1",
          [profile.id]
        );
        if (result.rows.length > 0) {
          return done(null, result.rows[0]);
        } else {
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

// === Passport Google Auth Routes ===
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  })
);

// === Passport Serialization ===
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// === Passport Deserialization ===
passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    if (result.rows.length > 0) {
      done(null, result.rows[0]);
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
