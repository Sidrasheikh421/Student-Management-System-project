import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, Users, UserPlus, Search, LogOut, GraduationCap, Bell, Menu, X, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, BookOpen, CheckCircle2, UserRound, LockKeyhole, Mail, Phone, Hash, Plus, ArrowUpRight } from "lucide-react";

const API = "http://localhost:5000/api";
const blank = { name: "", email: "", phone: "", course: "", rollNumber: "", status: "Active" };
async function request(path, options = {}) {
  const token = localStorage.getItem("devixo-token");
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}
const initials = name => (name || "DS").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
const date = value => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async e => {
    e.preventDefault(); setError("");
    if (mode === "register" && form.password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    try { const data = await request(`/auth/${mode}`, { method: "POST", body: JSON.stringify(form) }); onAuth(data); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="auth-wrap"><div className="auth-art"><div className="brand light"><span className="brand-icon"><GraduationCap /></span> Edu Track<span className="brand-muted">STUDENT MANAGEMENT SYSTEM</span></div><div className="art-copy"><span className="eyebrow">STUDENT SUCCESS STARTS HERE</span><h1>Manage your campus.<br/><em>Empower every student.</em></h1><p>A smarter, simpler way to manage student records, track progress and keep everything organized.</p><div className="art-stat"><div className="avatar-stack"><i>AM</i><i>SK</i><i>JD</i></div><span>Everything in one place</span></div></div><div className="art-orb orb-one"/><div className="art-orb orb-two"/></div><div className="auth-panel"><div className="auth-card"><div className="mobile-brand"><GraduationCap/> Edu Track</div><span className="eyebrow purple">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</span><h2>{mode === "login" ? "Sign in to your account" : "Create your account"}</h2><p className="muted">{mode === "login" ? "Enter your details to continue to your dashboard." : "Join your student management workspace."}</p><form onSubmit={submit}>{mode === "register" && <label>Full name<div className="input-wrap"><UserRound/><input required placeholder="Your full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div></label>}<label>Email address<div className="input-wrap"><Mail/><input required type="email" placeholder="name@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div></label><label>Password<div className="input-wrap"><LockKeyhole/><input required type="password" placeholder="At least 6 characters" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div></label>{error && <div className="error-msg">{error}</div>}<button className="primary full" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"} <ArrowUpRight size={17}/></button></form><p className="switch-auth">{mode === "login" ? "Don't have an account?" : "Already have an account?"} <button onClick={()=>{setMode(mode==="login"?"register":"login");setError("");}}>{mode==="login"?"Create account":"Sign in"}</button></p><p className="auth-foot">© 2026 Devixo Solutions. All rights reserved.</p></div></div></div>;
}

function StudentModal({ student, onClose, onSave }) {
  const [form, setForm] = useState(student || blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async e => { e.preventDefault(); setError(""); setBusy(true); try { await onSave(form); onClose(); } catch(err) { setError(err.message); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><div><span className="eyebrow purple">{student ? "UPDATE RECORD" : "NEW RECORD"}</span><h2>{student ? "Edit student" : "Add new student"}</h2></div><button className="icon-btn" onClick={onClose}><X/></button></div><form onSubmit={submit}><div className="form-grid">{[["name","Full name","e.g. Ayesha Khan"],["email","Email address","student@email.com"],["phone","Phone number","+92 300 1234567"],["course","Course / Program","e.g. Web Development"],["rollNumber","Roll number","e.g. DEV-2026-01"]].map(([name,label,placeholder])=><label key={name}>{label}<input name={name} required value={form[name]||""} placeholder={placeholder} onChange={update}/></label>)}<label>Status<select name="status" value={form.status||"Active"} onChange={update}><option>Active</option><option>Inactive</option></select></label></div>{error&&<div className="error-msg">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?"Saving...":student?"Save changes":"Add student"}</button></div></form></div></div>;
}

function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("devixo-token"); const user = localStorage.getItem("devixo-user");
    return token && user ? { token, user: JSON.parse(user) } : null;
  });
  const [tab, setTab] = useState("Dashboard");
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, recent: [] });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const isAdmin = auth?.user?.role === "Admin";

  const load = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      const [list, dashboard] = await Promise.all([
        request(`/students?page=${page}&limit=6&search=${encodeURIComponent(search)}`),
        request("/students/stats")
      ]);
      setStudents(list.students); setPages(list.pages); setStats(dashboard);
    } catch(err) { setNotice(err.message); if(err.message.toLowerCase().includes("session")) logout(); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); }, [auth, page, search]);
  const logout = () => { localStorage.removeItem("devixo-token"); localStorage.removeItem("devixo-user"); setAuth(null); setStudents([]); };
  const handleAuth = data => { localStorage.setItem("devixo-token",data.token); localStorage.setItem("devixo-user",JSON.stringify(data.user)); setAuth(data); };
  const saveStudent = async form => {
    if (!/^\S+@\S+\.\S+$/.test(form.email)) throw new Error("Please enter a valid email address.");
    const path = modal?.student ? `/students/${modal.student._id}` : "/students";
    await request(path,{method:modal?.student?"PUT":"POST",body:JSON.stringify(form)});
    setNotice(modal?.student?"Student updated successfully.":"Student added successfully."); await load();
  };
  const deleteStudent = async id => {
    if(!window.confirm("Are you sure you want to delete this student?")) return;
    try { await request(`/students/${id}`,{method:"DELETE"}); setNotice("Student deleted successfully."); await load(); }
    catch(err) { setNotice(err.message); }
  };
  const openDetails = async id => { try { const d=await request(`/students/${id}`); setDetail(d.student); } catch(err) { setNotice(err.message); } };
  if (!auth) return <AuthScreen onAuth={handleAuth}/>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?"show":""}`}><div className="brand"><span className="brand-icon"><GraduationCap/></span><span>DEVIXO<small>SOLUTIONS</small></span><button className="mobile-close" onClick={()=>setMobileNav(false)}><X/></button></div><div className="side-label">WORKSPACE</div><button className={`nav-link ${tab==="Dashboard"?"active":""}`} onClick={()=>{setTab("Dashboard");setMobileNav(false)}}><LayoutDashboard/> Dashboard</button><button className={`nav-link ${tab==="Students"?"active":""}`} onClick={()=>{setTab("Students");setMobileNav(false)}}><Users/> Students <span className="nav-count">{stats.total}</span></button><div className="side-bottom"><div className="help-card"><div className="help-icon"><BookOpen/></div><b>Need a hand?</b><p>Keep your student records up to date.</p><span>DEVIXO SUPPORT</span></div><div className="profile"><div className="profile-avatar">{initials(auth.user.name)}</div><div className="profile-info"><b>{auth.user.name}</b><span>{auth.user.role} account</span></div><button title="Logout" onClick={logout}><LogOut/></button></div></div></aside>
    {mobileNav&&<div className="nav-scrim" onClick={()=>setMobileNav(false)}/>}
    <main className="main-area"><header className="topbar"><button className="mobile-menu icon-btn" onClick={()=>setMobileNav(true)}><Menu/></button><div className="crumb">Workspace <span>/</span> <b>{tab}</b></div><div className="top-actions"><span className="today">{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span><button className="notification icon-btn"><Bell/><i/></button><div className="top-avatar">{initials(auth.user.name)}</div></div></header>
      <div className="page-content"><div className="page-heading"><div><span className="eyebrow purple">OVERVIEW</span><h1>{tab==="Dashboard"?"Good day, "+auth.user.name.split(" ")[0]+"!":"Student directory"}</h1><p>{tab==="Dashboard"?"Here’s what’s happening with your students today.":"Manage, search and organize all your student records."}</p></div>{tab==="Students"&&<button className="primary" onClick={()=>setModal({student:null})}><Plus size={18}/> Add student</button>}</div>
      {notice&&<div className="notice"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice("")}><X size={16}/></button></div>}
      {tab==="Dashboard"&&<><div className="stats-grid"><Stat icon={<Users/>} label="Total students" value={stats.total} note="All registered students" tone="purple"/><Stat icon={<CheckCircle2/>} label="Active students" value={stats.active} note="Currently enrolled" tone="green"/><Stat icon={<UserRound/>} label="Inactive students" value={stats.inactive} note="Not currently active" tone="orange"/><Stat icon={<GraduationCap/>} label="Courses" value={new Set(stats.recent.map(s=>s.course)).size} note="In recent registrations" tone="blue"/></div><div className="content-card recent-card"><div className="card-heading"><div><h3>Recent registrations</h3><p>Your latest student records</p></div><button className="text-link" onClick={()=>setTab("Students")}>View all <ArrowUpRight size={15}/></button></div><StudentTable students={stats.recent} isAdmin={isAdmin} onEdit={s=>setModal({student:s})} onDelete={deleteStudent} onView={openDetails}/></div><div className="welcome-strip"><div className="welcome-icon"><GraduationCap/></div><div><b>Your student workspace is ready</b><p>Add new students and keep all your records organized in one place.</p></div><button className="secondary" onClick={()=>{setTab("Students");setModal({student:null})}}>Add a student <ArrowUpRight size={16}/></button></div></>}
      {tab==="Students"&&<div className="content-card directory-card"><div className="directory-toolbar"><div><h3>All students <span className="total-pill">{stats.total}</span></h3><p>Browse and manage student information</p></div><div className="search-box"><Search size={18}/><input placeholder="Search students..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/><kbd>⌕</kbd></div></div><StudentTable students={students} isAdmin={isAdmin} onEdit={s=>setModal({student:s})} onDelete={deleteStudent} onView={openDetails} busy={busy}/><div className="pagination"><span>Showing <b>{students.length?((page-1)*6+1):0}-{(page-1)*6+students.length}</b> of <b>{search?students.length:stats.total}</b> students</span><div><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft/></button><span>{page} / {pages}</span><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}><ChevronRight/></button></div></div></div>}
      <footer>© 2026 Devixo Solutions <span>Made for better student management</span></footer></div>
    </main>
    {modal&&<StudentModal student={modal.student} onClose={()=>setModal(null)} onSave={saveStudent}/>}
    {detail&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setDetail(null)}><div className="modal detail-modal"><div className="modal-head"><div><span className="eyebrow purple">STUDENT PROFILE</span><h2>Student details</h2></div><button className="icon-btn" onClick={()=>setDetail(null)}><X/></button></div><div className="detail-person"><div className="detail-avatar">{initials(detail.name)}</div><div><h3>{detail.name}</h3><p>{detail.course}</p><span className={`status ${detail.status==="Active"?"active-status":"inactive-status"}`}>{detail.status}</span></div></div><div className="detail-grid">{[["Email",detail.email],["Phone",detail.phone],["Roll number",detail.rollNumber],["Registered",date(detail.createdAt)]].map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b></div>)}</div><button className="primary full" onClick={()=>setDetail(null)}>Close details</button></div></div>}
  </div>;
}
function Stat({icon,label,value,note,tone}) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><strong>{value}</strong><small>{note}</small><div className="stat-decoration"/></div>; }
function StudentTable({students,isAdmin,onEdit,onDelete,onView,busy=false}) {
  return <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>ROLL NUMBER</th><th>COURSE</th><th>STATUS</th><th>JOINED</th><th>ACTIONS</th></tr></thead><tbody>{busy?<tr><td colSpan="6" className="empty-state">Loading student records...</td></tr>:students.length===0?<tr><td colSpan="6" className="empty-state">No students found. Add your first student to get started.</td></tr>:students.map(s=><tr key={s._id}><td><div className="student-cell"><div className="student-avatar">{initials(s.name)}</div><div><b>{s.name}</b><small>{s.email}</small></div></div></td><td><span className="roll">{s.rollNumber}</span></td><td>{s.course}</td><td><span className={`status ${s.status==="Active"?"active-status":"inactive-status"}`}><i/>{s.status}</span></td><td>{date(s.createdAt)}</td><td><div className="row-actions"><button title="View details" onClick={()=>onView(s._id)}><Eye/></button><button title="Edit" onClick={()=>onEdit(s)}><Pencil/></button>{isAdmin&&<button title="Delete" className="delete-action" onClick={()=>onDelete(s._id)}><Trash2/></button>}</div></td></tr>)}</tbody></table></div>;
}
export default App;
