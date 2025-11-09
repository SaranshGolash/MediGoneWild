import express from "express";
import pg from "pg";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import passport from "passport";
import { OpenAI } from "openai";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

// NEW: Import LocalStrategy and bcrypt
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new pg.Pool({
  host: process.env.DBHOST,
  port: process.env.DBPORT,
  user: process.env.DBUSER,
  password: process.env.DBPASSWORD,
  database: process.env.DBDATABASE,
});

// Initialize OPENAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const saltRounds = 10; // NEW: For bcrypt hashing

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

// Global middleware to pass user to all templates
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
  if (req.user) return res.redirect("/dashboard");
  res.render("login");
});

app.get("/signup", (req, res) => {
  if (req.user) return res.redirect("/dashboard");
  res.render("signup");
});

// NEW: POST Route for Local Login
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    // failureFlash: true, // Optional: if you add connect-flash
  })
);

// NEW: POST Route for Local Signup
app.post("/signup", async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    // 1. Check if user already exists
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      // TODO: Add flash message "Email already in use."
      return res.redirect("/signup");
    }

    // 2. If not, hash password and create new user
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = await db.query(
      "INSERT INTO users (first_name, last_name, email, password) VALUES ($1, $2, $3, $4) RETURNING *",
      [firstName, lastName, email, hashedPassword]
    );

    // 3. Log the new user in
    req.login(newUser.rows[0], (err) => {
      if (err) {
        return next(err);
      }
      res.redirect("/dashboard");
    });
  } catch (err) {
    console.error("Signup error:", err);
    return next(err);
  }
});

// Logout Route
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session:", err);
      }
      res.redirect("/");
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

app.get("/settings", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.render("settings");
});

// Patient Portal Route
app.get("/dashboard", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.render("dashboard");
});

// Patient Portal Route
app.get("/dashboard", (req, res) => {
  if (!req.user) return res.redirect("/login"); // Protect this route
  res.render("dashboard"); // user is already passed via middleware
});

// Appointments Route
app.get("/my-appointments", (req, res) => {
  if (!req.user) return res.redirect("/login"); // Protect this route
  // In the future, you'll fetch appointments from your database
  res.render("my-appointments", { appointments: [] }); // Pass user from middleware
});

// Profile/Edit Route
app.get("/my-profile", (req, res) => {
  if (!req.user) return res.redirect("/login"); // Protect this route
  res.render("my-profile"); // Pass user from middleware
});

// Contact Us Route
app.get("/contact", (req, res) => {
  res.render("contact"); // user is passed via global middleware
});

app.post("/contact", async (req, res) => {
  const { name, email, subject, message } = req.body;
  // Get user ID if they are logged in
  const userId = req.user ? req.user.id : null;

  try {
    await db.query(
      "INSERT INTO messages (name, email, subject, message, user_id) VALUES ($1, $2, $3, $4, $5)",
      [name, email, subject, message, userId]
    );

    // TODO: Add a flash message for success
    res.redirect("/contact?status=success"); // Redirect back with a success query
  } catch (err) {
    console.error("Contact form error:", err);
    res.redirect("/contact?status=error"); // Redirect with an error
  }
});

// Chatbot API Route
app.post("/chat", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Please log in to use the chatbot." });
  }

  const { message } = req.body;

  try {
    // This is the "innovation" from your CareFlow project.
    // We give the bot a persona and rules.
    const systemPrompt = `
      You are a helpful and friendly assistant for MediGoneWild, a hospital.
      Your name is "CareFlow Assist".
      Your role is to help patients by:
      1. Answering general questions about the hospital's services, visiting hours, and departments.
      2. Helping users find doctors by specialty.
      3. Providing general health and wellness tips.

      **Your STRICT rules are:**
      - You MUST NOT provide any medical advice, diagnoses, or treatment plans.
      - If a user asks for medical advice, you MUST refuse and advise them to "book an appointment with one of our doctors" or "call 911 in an emergency."
      - Be compassionate, clear, and concise.
      - Do not make up information about the hospital. If you don't know, say "I can't find that information, but you can contact our staff at 123-456-7890."
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // You can use gpt-4 if you prefer
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// Passport Local Strategy
// This strategy is for verifying email/password logins
passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          email,
        ]);
        const user = result.rows[0];

        // 1. Check if user exists
        if (!user) {
          return done(null, false, { message: "Incorrect email or password." });
        }

        // 2. Check if user has a local password (not a Google-only account)
        if (!user.password) {
          return done(null, false, {
            message:
              "This email is registered with Google. Please use 'Sign in with Google'.",
          });
        }

        // 3. Check if password is correct
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect email or password." });
        }

        // 4. If all checks pass, return the user
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Passport Google OAuth Strategy
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
          // Check if email exists from a local signup
          const emailCheck = await db.query(
            "SELECT * FROM users WHERE email = $1",
            [profile.emails[0].value]
          );
          if (emailCheck.rows.length > 0) {
            // TODO: Link accounts
            // For now, just return the existing local user
            return done(null, emailCheck.rows[0]);
          }

          // Create new Google user
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
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  })
);

// === Passport Serialization ===
// (Unchanged - this works for both strategies)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// === Passport Deserialization ===
// (Unchanged - this works for both strategies)
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
