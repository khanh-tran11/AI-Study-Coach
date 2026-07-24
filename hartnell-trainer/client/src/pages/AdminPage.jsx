import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { HartnellLogo } from '../HartnellLogo';
import styles from './AdminPage.module.css';

const MODULE_TEMPLATES = [
  { title:'Canvas Orientation',       duration:'45 min', source:'canvas-orientation-guide.pdf',  topics:['Navigating the dashboard','Course shell overview','Student roster'] },
  { title:'Setting Up Your Shell',    duration:'60 min', source:'shell-setup-howto.docx',         topics:['Course details & visibility','Enrollment dates','Co-instructor access'] },
  { title:'Course Content Upload',    duration:'50 min', source:'content-upload-video.mp4',       topics:['File uploads','Creating pages','Embedding video'] },
  { title:'Assignments & Quizzes',    duration:'55 min', source:'assignments-guide.pdf',          topics:['Graded assignments','Quiz banks','Due/availability dates'] },
  { title:'Gradebook & Exports',      duration:'40 min', source:'gradebook-export.docx',          topics:['Reading the gradebook','Posting grades','CSV export'] },
  { title:'Communication Tools',      duration:'35 min', source:'comms-guide.pdf',                topics:['Canvas Inbox','Announcements','Discussion boards'] },
  { title:'Accessibility Standards',  duration:'50 min', source:'accessibility-policy.pdf',       topics:['Alt text','Video captions','Accessibility Checker'] },
  { title:'Student View & Testing',   duration:'30 min', source:'student-view-walkthrough.mp4',   topics:['Student View mode','Testing submissions','Grade visibility'] },
  { title:'LMS Admin Intro',          duration:'45 min', source:'lms-admin-info.docx',            topics:['LMS Admin contact','Instructure 24/7','Scheduling training'] },
  { title:'Capstone & Certification', duration:'60 min', source:'capstone-assessment.pdf',        topics:['Module review','Final assessment','Certificate delivery'] },
];

function fileIcon(name) {
  const ext = name?.split('.').pop().toLowerCase();
  return { pdf:'📄', docx:'📝', doc:'📝', txt:'📃', mp4:'🎬', mov:'🎬', pptx:'📊', ppt:'📊' }[ext] || '📁';
}
function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  return (b/(1024*1024)).toFixed(1) + ' MB';
}

export default function AdminPage() {
  const { user, logout }     = useAuth();
  const navigate             = useNavigate();
  const [tab, setTab]        = useState('upload');  // 'upload' | 'modules' | 'applicants'
  const [files, setFiles]    = useState([]);
  const [generating, setGen] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [published, setPublished] = useState(false);
  const [openMod, setOpenMod]    = useState(null);
  const [dragOver, setDragOver]  = useState(false);
  const fileRef = useRef();

  // Applicant mock data
  const APPLICANTS = [
    { name:'Dr. Maria Santos',    email:'m.santos@hartnell.edu', done:10, hours:14.5, last:'Jul 21' },
    { name:'Prof. James Okafor',  email:'j.okafor@hartnell.edu', done:10, hours:12.0, last:'Jul 19' },
    { name:'Dr. Linda Cheng',     email:'l.cheng@hartnell.edu',  done:10, hours:16.0, last:'Jul 20' },
    { name:'Prof. Ahmed Yusuf',   email:'a.yusuf@hartnell.edu',  done:7,  hours:9.5,  last:'Jul 22' },
    { name:'Dr. Rachel Kim',      email:'r.kim@hartnell.edu',    done:5,  hours:6.5,  last:'Jul 18' },
    { name:'Prof. Carlos Rivera', email:'c.rivera@hartnell.edu', done:0,  hours:0,    last:'—' },
  ];

  function addFiles(incoming) {
    const newFiles = incoming.filter(f => !files.find(e => e.name === f.name))
      .map(f => ({ name: f.name, size: f.size, status: 'indexing', progress: 0 }));
    const updated = [...files, ...newFiles];
    setFiles(updated);
    // Simulate parse progress
    newFiles.forEach(f => {
      let p = 0;
      const iv = setInterval(() => {
        p = Math.min(p + Math.random() * 30, 100);
        setFiles(prev => prev.map(e => e.name === f.name ? { ...e, progress: Math.round(p), status: p >= 100 ? 'indexed' : 'indexing' } : e));
        if (p >= 100) clearInterval(iv);
      }, 350);
    });
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    addFiles([...e.dataTransfer.files]);
  }

  function generateModules() {
    setGen(true);
    setTimeout(() => { setGen(false); setGenerated(true); setTab('modules'); }, 2000);
  }

  const statusBadge = (done) => {
    if (done === 10) return <span className={`${styles.badge} ${styles.badgeDone}`}>Completed</span>;
    if (done > 0)    return <span className={`${styles.badge} ${styles.badgeProg}`}>In Progress</span>;
    return               <span className={`${styles.badge} ${styles.badgePend}`}>Not Started</span>;
  };

  return (
    <div className={styles.app}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navLeft}><HartnellLogo size={30} dark /></div>
        <div className={styles.navTabs}>
          {[['upload','📂 Content & Modules'],['applicants','📊 Applicants']].map(([key,label]) => (
            <button key={key} className={`${styles.navTab} ${tab===key||( key==='upload' && tab==='modules') ? styles.navTabActive:''}`}
              onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        <div className={styles.navRight}>
          <span className={styles.navUser}>{user?.name}</span>
          <span className={styles.adminBadge}>OWNER</span>
          <button className={styles.navBtn} onClick={logout}>Sign Out</button>
        </div>
      </nav>

      <div className={styles.page}>

        {/* ═══ UPLOAD TAB ═══ */}
        {(tab === 'upload' || tab === 'modules') && (
          <div className={styles.twoCol}>
            {/* LEFT */}
            <div className={styles.leftCol}>

              {/* Tab switcher */}
              <div className={styles.subTabs}>
                <button className={`${styles.subTab} ${tab==='upload'?styles.subTabActive:''}`} onClick={()=>setTab('upload')}>Upload Files</button>
                <button className={`${styles.subTab} ${tab==='modules'?styles.subTabActive:''}`} onClick={()=>setTab('modules')}>Generated Modules</button>
              </div>

              {tab === 'upload' && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}><h2>Upload Training Materials</h2><span className={styles.chip}>{files.length} files</span></div>
                  <div className={styles.cardBody}>
                    <div
                      className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''}`}
                      onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                      onDragLeave={()=>setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={()=>fileRef.current.click()}
                    >
                      <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.mp4,.mov,.pptx,.ppt"
                        style={{display:'none'}} onChange={e=>addFiles([...e.target.files])} />
                      <span className={styles.dzIcon}>☁️</span>
                      <h3>Drag & drop files here</h3>
                      <p>PDF · DOCX · TXT · PPTX · MP4</p>
                    </div>
                    {files.length > 0 && (
                      <div className={styles.fileList}>
                        {files.map(f => (
                          <div key={f.name} className={styles.fileItem}>
                            <span className={styles.fileIcon}>{fileIcon(f.name)}</span>
                            <div className={styles.fileInfo}>
                              <span className={styles.fileName}>{f.name}</span>
                              <span className={styles.fileMeta}>{formatSize(f.size)}</span>
                              {f.status === 'indexing' && <div className={styles.fileBar}><div className={styles.fileBarFill} style={{width:`${f.progress}%`}}/></div>}
                            </div>
                            <span className={f.status==='indexed' ? styles.chipGreen : styles.chipYellow}>
                              {f.status === 'indexed' ? 'Indexed ✓' : 'Parsing…'}
                            </span>
                            <button className={styles.removeBtn} onClick={()=>setFiles(prev=>prev.filter(e=>e.name!==f.name))}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button className={styles.btnGenerate} disabled={files.length===0||generating} onClick={generateModules}>
                      {generating ? <><span className={styles.spin}>⏳</span> AI is building modules…</> : '✨ Generate Modules from Content'}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'modules' && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}><h2>Generated Modules</h2><span className={styles.chip}>{MODULE_TEMPLATES.length} modules</span></div>
                  <div className={styles.cardBody}>
                    {!generated
                      ? <p className={styles.emptyNote}>Upload training files and click "Generate Modules" to see modules here.</p>
                      : MODULE_TEMPLATES.map((m,i) => (
                          <div key={i} className={`${styles.modItem} ${openMod===i?styles.modOpen:''}`}>
                            <button className={styles.modItemHeader} onClick={()=>setOpenMod(openMod===i?null:i)}>
                              <span className={styles.modItemNum}>{i+1}</span>
                              <span className={styles.modItemTitle}>{m.title}</span>
                              <span className={styles.modItemDur}>⏱ {m.duration}</span>
                              <span className={styles.chevron}>▶</span>
                            </button>
                            <AnimatePresence>
                              {openMod===i && (
                                <motion.div className={styles.modItemBody}
                                  initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}}>
                                  <ul>{m.topics.map(t=><li key={t}>{t}</li>)}</ul>
                                  <p className={styles.modSource}>📎 {m.source}</p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT sidebar */}
            <div className={styles.rightCol}>
              <div className={styles.card}>
                <div className={styles.cardHeader}><h2>📋 Overview</h2></div>
                <div className={styles.cardBody}>
                  <div className={styles.statGrid}>
                    <div className={styles.statBox}><span className={styles.statN}>{files.length}</span><span className={styles.statL}>Files Uploaded</span></div>
                    <div className={styles.statBox}><span className={styles.statN}>{generated?10:0}</span><span className={styles.statL}>Modules</span></div>
                    <div className={styles.statBox}><span className={styles.statN}>6</span><span className={styles.statL}>Faculty</span></div>
                    <div className={styles.statBox}><span className={styles.statN}>3</span><span className={styles.statL}>Completed</span></div>
                  </div>
                  <button className={styles.btnOutline} onClick={()=>setTab('applicants')}>View Applicant Dashboard →</button>
                </div>
                <div className={styles.publishRow}>
                  <span>Publish modules to faculty</span>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={published} onChange={e=>{
                      if(!generated){alert('Generate modules first.');return;}
                      setPublished(e.target.checked);
                    }}/>
                    <span className={styles.slider}/>
                  </label>
                </div>
              </div>
              <div className={styles.card} style={{marginTop:16}}>
                <div className={styles.cardHeader}><h2>💡 Tips</h2></div>
                <div className={styles.cardBody}>
                  <ul className={styles.tipList}>
                    <li>Upload Word/PDF guides for step-by-step modules.</li>
                    <li>MP4 transcripts are extracted automatically.</li>
                    <li>Toggle "Publish" to make modules live for faculty.</li>
                    <li>Use the S3 bucket path: <code>modules/&lt;id&gt;/</code></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ APPLICANTS TAB ═══ */}
        {tab === 'applicants' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}><h2>📊 Faculty Progress</h2><span className={styles.chip}>{APPLICANTS.length} faculty</span></div>
            <div className={styles.cardBody} style={{padding:0}}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Faculty Member</th><th>Status</th><th>Modules</th><th>%</th><th>Hours</th><th>Last Active</th></tr>
                </thead>
                <tbody>
                  {APPLICANTS.map((a,i) => {
                    const pct = Math.round((a.done/10)*100);
                    return (
                      <tr key={i}>
                        <td>
                          <div className={styles.nameCell}>
                            <div className={styles.avatar} style={{background: ['#860038','#48002e','#0770A3','#1a7a3c','#c07000','#5B3F9E'][i%6]}}>
                              {a.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                            </div>
                            <div><div className={styles.aName}>{a.name}</div><div className={styles.aEmail}>{a.email}</div></div>
                          </div>
                        </td>
                        <td>{statusBadge(a.done)}</td>
                        <td>
                          <div className={styles.progWrap}>
                            <div className={styles.progBar}><div className={styles.progFill} style={{width:`${pct}%`,background:pct===100?'var(--success)':pct>50?'var(--hc-gold)':'var(--hc-magenta)'}}/></div>
                            <span className={styles.progTxt}>{a.done}/10</span>
                          </div>
                        </td>
                        <td><strong>{pct}%</strong></td>
                        <td>{a.hours>0?a.hours+' hrs':'—'}</td>
                        <td className={styles.lastActive}>{a.last}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
