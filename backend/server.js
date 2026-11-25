import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["Admin", "User"], default: "User" }
}, { timestamps: true });

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  course: { type: String, required: true, trim: true },
  rollNumber: { type: String, required: true, trim: true, unique: true },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Student = mongoose.model("Student", studentSchema);

const makeToken = user => jwt.sign(
  { id: user._id, name: user.name, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "1d" }
);

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Please log in first." });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Session expired. Please log in again." });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== "Admin") return res.status(403).json({ message: "Admin permission required." });
  next();
};

app.get("/api/health", (_req, res) => res.json({ status: "API is running" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "All fields are required." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: "Email already registered." });
    const role = (await User.countDocuments()) === 0 ? "Admin" : "User";
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10), role });
    res.status(201).json({ token: makeToken(user), user: { name: user.name, email: user.email, role: user.role } });
  } catch (error) { res.status(500).json({ message: "Could not create account.", error: error.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user || !(await bcrypt.compare(password || "", user.password))) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }
    res.json({ token: makeToken(user), user: { name: user.name, email: user.email, role: user.role } });
  } catch (error) { res.status(500).json({ message: "Login failed.", error: error.message }); }
});

app.get("/api/auth/me", auth, (req, res) => res.json({ user: req.user }));

app.get("/api/students", auth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 6));
    const search = (req.query.search || "").trim();
    const filter = search ? { $or: ["name", "email", "course", "rollNumber"].map(key => ({ [key]: { $regex: search, $options: "i" } })) } : {};
    const [students, total] = await Promise.all([
      Student.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Student.countDocuments(filter)
    ]);
    res.json({ students, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) { res.status(500).json({ message: "Could not load students.", error: error.message }); }
});

app.get("/api/students/stats", auth, async (_req, res) => {
  try {
    const [total, active, inactive, recent] = await Promise.all([
      Student.countDocuments(), Student.countDocuments({ status: "Active" }),
      Student.countDocuments({ status: "Inactive" }),
      Student.find().sort({ createdAt: -1 }).limit(5)
    ]);
    res.json({ total, active, inactive, recent });
  } catch (error) { res.status(500).json({ message: "Could not load dashboard.", error: error.message }); }
});

app.get("/api/students/:id", auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found." });
    res.json({ student });
  } catch { res.status(400).json({ message: "Invalid student ID." }); }
});

app.post("/api/students", auth, async (req, res) => {
  try {
    const { name, email, phone, course, rollNumber, status } = req.body;
    if (![name, email, phone, course, rollNumber].every(v => String(v || "").trim())) {
      return res.status(400).json({ message: "Please complete all required fields." });
    }
    const student = await Student.create({ name, email, phone, course, rollNumber, status });
    res.status(201).json({ student, message: "Student added successfully." });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000 ? "Roll number already exists." : "Could not add student." });
  }
});

app.put("/api/students/:id", auth, async (req, res) => {
  try {
    const { name, email, phone, course, rollNumber, status } = req.body;
    if (![name, email, phone, course, rollNumber].every(v => String(v || "").trim())) {
      return res.status(400).json({ message: "Please complete all required fields." });
    }
    const student = await Student.findByIdAndUpdate(req.params.id,
      { name, email, phone, course, rollNumber, status }, { new: true, runValidators: true });
    if (!student) return res.status(404).json({ message: "Student not found." });
    res.json({ student, message: "Student updated successfully." });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? "Roll number already exists." : "Could not update student." });
  }
});

app.delete("/api/students/:id", auth, adminOnly, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found." });
    res.json({ message: "Student deleted successfully." });
  } catch { res.status(400).json({ message: "Could not delete student." }); }
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/devixo_students")
  .then(() => app.listen(PORT, () => console.log(`API ready at http://localhost:${PORT}`)))
  .catch(error => { console.error("MongoDB connection failed:", error.message); process.exit(1); });
