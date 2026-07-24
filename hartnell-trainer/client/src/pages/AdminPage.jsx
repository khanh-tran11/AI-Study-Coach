import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { HartnellLogo } from '../HartnellLogo';
import api from '../api';
import styles from './AdminPage.module.css';

// ── Employee aggregation (unchanged) ─────────────────────────────────────────
function aggregateEmployees(records) {
  const byName = {};
  for (const r of records) {
    if (!byName[r.name]) byName[r.name] = { name: r.name, modules: [] };
    byName[r.name].modules.push(r);
  }
  return Object.values(byName).map(emp => {
    const totalModules = emp.modules.length;
    const completed    = emp.modules.filter(m => m.progress === 'completed').length;
    const totalMinutes = emp.modules.reduce((s, m) => s + (parseFloat(m.time_spent) || 0), 0);
    const worstAlert   = emp.modules.some(m => m.alert_status === 'cheating_reported')
      ? 'cheating_reported'
      : emp.modules.some(m => m.alert_status === 'warning') ? 'warning' : 'normal';
    const lastActive   = emp.modules.map(m => m.lastActiveAt || m.last_updated)
      .filter(Boolean).sort().pop();
    return { ...emp, totalModules, completed, totalMinutes, worstAlert, lastActive };
  });
}

// ── File helpers ──────────────────────────────────────────────────────────────
const ALLOWED_EXTS = ['.pdf','.docx','.doc','.txt','.pptx','.ppt','.md'];
function fileIcon(name) {
  const ext = name?.split('.').pop().toLowerCase();
  return { pdf:'📄', docx:'📝', doc:'📝', txt:'📃', md:'📃',
           mp4:'🎬', mov:'🎬', pptx:'📊', ppt:'📊' }[ext] || '📁';
}
function formatSize(b) {
  if (b < 1024)        return b + ' B';
  if (b < 1048576)     return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}
function extOf(name) { return '.' + name.split('.').pop().toLowerCase(); }


export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  // ── Tab state ───────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('upload'); // 'upload' | 'modules' | 'applicants'

  // ── Upload state ────────────────────────────────────────────────────────────
  const [files,       setFiles]       = useState([]); // { name, size, ext, status, progress, key, localPath? }
  const [uploading,   setUploading]   = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [dragOver,    setDragOver]    = useState(false);
  const fileRef = useRef();

  // ── Generated modules state ─────────────────────────────────────────────────
  const [genModules,      setGenModules]      = useState([]);
  const [modulesLoading,  setModulesLoading]  = useState(false);
  const [openMod,         setOpenMod]         = useState(null);
  const [published,       setPublished]       = useState(false);

  // ── Applicants state ────────────────────────────────────────────────────────
  const [employees,       setEmployees]       = useState([]);
  const [empLoading,      setEmpLoading]      = useState(true);
  const [empError,        setEmpError]        = useState(null);

  // ── Load employees ──────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/api/manager/employees')
      .then(r => setEmployees(aggregateEmployees(r.data)))
      .catch(() => setEmpError('Could not load tracking data. Is manager-side/app.py running on :5001?'))
      .finally(() => setEmpLoading(false));
  }, []);

  // ── Load generated modules on mount & when switching to modules tab ─────────
  const loadGenModules = useCallback(() => {
    setModulesLoading(true);
    api.get('/api/upload/modules')
      .then(r => setGenModules(r.data.modules || []))
      .catch(() => setGenModules([]))
      .finally(() => setModulesLoading(false));
  }, []);

  useEffect(() => { loadGenModules(); }, [loadGenModules]);


  // ── File selection ──────────────────────────────────────────────────────────
  function addFiles(incoming) {
    const valid = [...incoming].filter(f => ALLOWED_EXTS.includes(extOf(f.name)));
    const deduped = valid.filter(f => !files.find(e => e.name === f.name));
    if (!deduped.length) return;
    setFiles(prev => [
      ...prev,
      ...deduped.map(f => ({
        name: f.name, size: f.size, ext: extOf(f.name),
        status: 'ready', progress: 0, key: null, _file: f,
      })),
    ]);
  }

  function removeFile(name) {
    setFiles(prev => prev.filter(f => f.name !== name));
  }

  // ── Step 1: Upload files to S3 (or local server) ────────────────────────────
  async function uploadAllFiles() {
    const pending = files.filter(f => f.status === 'ready');
    if (!pending.length) return;
    setUploading(true);
    setGenError(null);

    const updated = [...files];

    for (const f of pending) {
      const idx = updated.findIndex(u => u.name === f.name);
      updated[idx] = { ...updated[idx], status: 'uploading', progress: 10 };
      setFiles([...updated]);

      try {
        // Get presigned URL (or local key)
        const { data: presign } = await api.post('/api/upload/presign', { filename: f.name });

        if (presign.uploadUrl) {
          // AWS mode: PUT directly to S3 presigned URL
          await fetch(presign.uploadUrl, {
            method: 'PUT',
            body: f._file,
            headers: { 'Content-Type': f._file.type || 'application/octet-stream' },
          });
          updated[idx] = { ...updated[idx], key: presign.key, status: 'uploaded', progress: 100 };
        } else {
          // Local-dev mode: POST to /api/upload/local
          const form = new FormData();
          form.append('file', f._file);
          const { data: local } = await api.post('/api/upload/local', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: e => {
              const pct = Math.round((e.loaded / e.total) * 90);
              updated[idx] = { ...updated[idx], progress: pct };
              setFiles([...updated]);
            },
          });
          updated[idx] = {
            ...updated[idx],
            key: local.key, localPath: local.localPath,
            status: 'uploaded', progress: 100,
          };
        }
      } catch (err) {
        updated[idx] = { ...updated[idx], status: 'error', error: err.message };
      }

      setFiles([...updated]);
    }

    setUploading(false);
  }


  // ── Step 2: Generate modules via AI ─────────────────────────────────────────
  async function generateModules() {
    const uploaded = files.filter(f => f.status === 'uploaded' && f.key);
    if (!uploaded.length) {
      // If files haven't been uploaded yet, do it now
      await uploadAllFiles();
      // Re-read state after upload
      return;
    }

    setGenerating(true);
    setGenError(null);

    try {
      const payload = {
        files: uploaded.map(f => ({
          key:          f.key,
          originalName: f.name,
          localPath:    f.localPath || null,
        })),
        moduleTitle: moduleTitle.trim() || null,
      };

      const { data } = await api.post('/api/upload/generate', payload);

      if (data.errors?.length) {
        setGenError(`${data.errors.length} file(s) failed: ${data.errors.map(e => e.file).join(', ')}`);
      }

      // Mark files as generated in the list
      setFiles(prev => prev.map(f =>
        uploaded.find(u => u.key === f.key)
          ? { ...f, status: 'generated' }
          : f
      ));

      await loadGenModules();
      setTab('modules');
    } catch (err) {
      setGenError(err.response?.data?.error || err.message);
    } finally {
      setGenerating(false);
    }
  }

  // ── Combined upload + generate trigger ──────────────────────────────────────
  async function handleGenerate() {
    const hasUploaded = files.some(f => f.status === 'uploaded');
    if (!hasUploaded) {
      await uploadAllFiles();
    }
    await generateModules();
  }

  // ── Delete a generated module ────────────────────────────────────────────────
  async function deleteModule(id) {
    if (!window.confirm('Remove this module?')) return;
    await api.delete(`/api/upload/modules/${id}`).catch(() => {});
    setGenModules(prev => prev.filter(m => m.id !== id));
  }

  // ── Publish toggle placeholder ───────────────────────────────────────────────
  function handlePublish(checked) {
    if (!genModules.length) { alert('Generate at least one module first.'); return; }
    setPublished(checked);
    // TODO: call a publish API once deployment is ready
  }

  // ── Status badge ─────────────────────────────────────────────────────────────
  function statusBadge(emp) {
    if (emp.worstAlert === 'cheating_reported') return <span className={`${styles.badge} ${styles.badgeAlert}`}>⚠️ Flagged</span>;
    if (emp.worstAlert === 'warning')           return <span className={`${styles.badge} ${styles.badgeProg}`}>⚠️ Warning</span>;
    if (emp.completed === emp.totalModules && emp.totalModules > 0) return <span className={`${styles.badge} ${styles.badgeDone}`}>Completed</span>;
    if (emp.completed > 0)                      return <span className={`${styles.badge} ${styles.badgeProg}`}>In Progress</span>;
    return <span className={`${styles.badge} ${styles.badgePend}`}>Not Started</span>;
  }


  // ── File status chip ─────────────────────────────────────────────────────────
  function fileStatusChip(f) {
    if (f.status === 'ready')     return <span className={styles.chipYellow}>Ready</span>;
    if (f.status === 'uploading') return <span className={styles.chipYellow}>Uploading {f.progress}%</span>;
    if (f.status === 'uploaded')  return <span className={styles.chipBlue}>Uploaded ✓</span>;
    if (f.status === 'generated') return <span className={styles.chipGreen}>Generated ✓</span>;
    if (f.status === 'error')     return <span className={styles.chipRed} title={f.error}>Error ✕</span>;
    return null;
  }

  const canGenerate    = files.some(f => ['ready','uploaded'].includes(f.status));
  const allUploaded    = files.length > 0 && files.every(f => ['uploaded','generated'].includes(f.status));
  const anyGenerating  = generating || uploading;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.app}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navLeft}><HartnellLogo size={30} dark /></div>
        <div className={styles.navTabs}>
          {[['upload','📂 Content & Modules'],['applicants','📊 Applicants']].map(([key, label]) => (
            <button key={key}
              className={`${styles.navTab} ${(tab === key || (key === 'upload' && tab === 'modules')) ? styles.navTabActive : ''}`}
              onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className={styles.navRight}>
          <span className={styles.navUser}>{user?.name}</span>
          <span className={styles.adminBadge}>OWNER</span>
          <button className={styles.navBtn} onClick={logout}>Sign Out</button>
        </div>
      </nav>

      <div className={styles.page}>

        {/* ═══ UPLOAD / MODULES TABS ═══ */}
        {(tab === 'upload' || tab === 'modules') && (
          <div className={styles.twoCol}>

            {/* LEFT */}
            <div className={styles.leftCol}>
              <div className={styles.subTabs}>
                <button className={`${styles.subTab} ${tab==='upload'?styles.subTabActive:''}`}  onClick={()=>setTab('upload')}>Upload Files</button>
                <button className={`${styles.subTab} ${tab==='modules'?styles.subTabActive:''}`} onClick={()=>{ setTab('modules'); loadGenModules(); }}>
                  Generated Modules {genModules.length > 0 && <span className={styles.badge}>{genModules.length}</span>}
                </button>
              </div>


              {/* ── UPLOAD TAB ── */}
              {tab === 'upload' && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2>Upload Training Materials</h2>
                    <span className={styles.chip}>{files.length} file{files.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.cardBody}>

                    {/* Optional title override */}
                    <div style={{marginBottom:12}}>
                      <label style={{fontSize:13,color:'#666',display:'block',marginBottom:4}}>
                        Module title (optional — AI will generate one from content if blank)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Canvas Gradebook Deep Dive"
                        value={moduleTitle}
                        onChange={e => setModuleTitle(e.target.value)}
                        style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #ddd',fontSize:14}}
                      />
                    </div>

                    {/* Drop zone */}
                    <div
                      className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                      onClick={() => fileRef.current.click()}
                    >
                      <input ref={fileRef} type="file" multiple
                        accept=".pdf,.docx,.doc,.txt,.pptx,.ppt,.md"
                        style={{ display: 'none' }}
                        onChange={e => addFiles(e.target.files)} />
                      <span className={styles.dzIcon}>☁️</span>
                      <h3>Drag &amp; drop files here</h3>
                      <p>PDF · DOCX · TXT · PPTX · MD</p>
                    </div>

                    {/* File list */}
                    {files.length > 0 && (
                      <div className={styles.fileList}>
                        {files.map(f => (
                          <div key={f.name} className={styles.fileItem}>
                            <span className={styles.fileIcon}>{fileIcon(f.name)}</span>
                            <div className={styles.fileInfo}>
                              <span className={styles.fileName}>{f.name}</span>
                              <span className={styles.fileMeta}>{formatSize(f.size)}</span>
                              {f.status === 'uploading' && (
                                <div className={styles.fileBar}>
                                  <div className={styles.fileBarFill} style={{ width: `${f.progress}%` }} />
                                </div>
                              )}
                            </div>
                            {fileStatusChip(f)}
                            <button className={styles.removeBtn}
                              onClick={() => removeFile(f.name)}
                              disabled={anyGenerating}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error banner */}
                    {genError && (
                      <div style={{marginTop:12,padding:'10px 14px',background:'#fff0f0',border:'1px solid #ffcccc',borderRadius:8,fontSize:13,color:'#c00'}}>
                        ⚠️ {genError}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}}>
                      {!allUploaded && (
                        <button className={styles.btnOutline}
                          disabled={!files.some(f=>f.status==='ready') || anyGenerating}
                          onClick={uploadAllFiles}>
                          {uploading ? '⏳ Uploading…' : '⬆️ Upload to S3'}
                        </button>
                      )}
                      <button className={styles.btnGenerate}
                        disabled={!canGenerate || anyGenerating}
                        onClick={handleGenerate}>
                        {generating
                          ? <><span className={styles.spin}>⏳</span> AI is building modules…</>
                          : uploading
                            ? '⏳ Uploading first…'
                            : '✨ Generate Modules from Content'}
                      </button>
                    </div>

                  </div>
                </div>
              )}


              {/* ── MODULES TAB ── */}
              {tab === 'modules' && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2>Generated Modules</h2>
                    <span className={styles.chip}>{genModules.length} module{genModules.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.cardBody}>
                    {modulesLoading && <p className={styles.emptyNote}>Loading modules…</p>}
                    {!modulesLoading && genModules.length === 0 && (
                      <p className={styles.emptyNote}>
                        No modules yet. Upload training files and click "Generate Modules from Content".
                      </p>
                    )}
                    {!modulesLoading && genModules.map((m, i) => (
                      <div key={m.id ?? i} className={`${styles.modItem} ${openMod===i ? styles.modOpen : ''}`}>
                        <button className={styles.modItemHeader} onClick={() => setOpenMod(openMod === i ? null : i)}>
                          <span className={styles.modItemNum}>{m.id ?? i + 1}</span>
                          <span className={styles.modItemTitle}>{m.title}</span>
                          <span className={styles.modItemDur}>⏱ {m.estimatedMinutes ?? 45} min</span>
                          <span className={styles.chipGreen} style={{fontSize:11}}>AI ✓</span>
                          <span className={styles.chevron}>▶</span>
                        </button>
                        <AnimatePresence>
                          {openMod === i && (
                            <motion.div className={styles.modItemBody}
                              initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}}
                              exit={{height:0,opacity:0}} transition={{duration:0.2}}>
                              <p style={{fontSize:13,color:'#555',marginBottom:8}}>{m.description}</p>
                              {m.steps?.map((step, si) => (
                                <div key={si} style={{marginBottom:6,paddingLeft:12,borderLeft:'3px solid #e0e0e0'}}>
                                  <span style={{fontSize:12,fontWeight:600,textTransform:'uppercase',color:'#888'}}>{step.type}</span>
                                  {' · '}
                                  <span style={{fontSize:13}}>{step.title}</span>
                                </div>
                              ))}
                              {m.source_file && (
                                <p className={styles.modSource}>📎 Source: {m.source_file}</p>
                              )}
                              {m.generated_at && (
                                <p style={{fontSize:11,color:'#aaa',marginTop:4}}>
                                  Generated {new Date(m.generated_at).toLocaleString()}
                                </p>
                              )}
                              <button className={styles.btnDanger || styles.btnOutline}
                                style={{marginTop:10,fontSize:12,padding:'4px 12px',color:'#c00',border:'1px solid #c00',background:'none',borderRadius:6,cursor:'pointer'}}
                                onClick={() => deleteModule(m.id)}>
                                🗑 Remove module
                              </button>
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
                    <div className={styles.statBox}>
                      <span className={styles.statN}>{files.length}</span>
                      <span className={styles.statL}>Files Selected</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statN}>{files.filter(f=>f.status==='uploaded'||f.status==='generated').length}</span>
                      <span className={styles.statL}>Uploaded</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statN}>{genModules.length}</span>
                      <span className={styles.statL}>AI Modules</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statN}>{employees.length}</span>
                      <span className={styles.statL}>Employees</span>
                    </div>
                  </div>
                  <button className={styles.btnOutline} onClick={() => setTab('applicants')} style={{marginTop:8}}>
                    View Applicant Dashboard →
                  </button>
                </div>
                <div className={styles.publishRow}>
                  <span>Publish modules to faculty</span>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={published} onChange={e => handlePublish(e.target.checked)} />
                    <span className={styles.slider} />
                  </label>
                </div>
              </div>

              <div className={styles.card} style={{marginTop:16}}>
                <div className={styles.cardHeader}><h2>💡 How it works</h2></div>
                <div className={styles.cardBody}>
                  <ol className={styles.tipList} style={{paddingLeft:18}}>
                    <li>Drop PDF, DOCX, PPTX, or TXT files above.</li>
                    <li>Click <strong>Generate Modules</strong> — files upload to S3 and Claude AI builds interactive lessons.</li>
                    <li>Review the generated modules in the <strong>Generated Modules</strong> tab.</li>
                    <li>Toggle <strong>Publish</strong> to make them live for faculty.</li>
                  </ol>
                </div>
              </div>
            </div>

          </div>
        )}


        {/* ═══ APPLICANTS TAB ═══ */}
        {tab === 'applicants' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>📊 Employee Training Progress</h2>
              <span className={styles.chip}>{employees.length} employee{employees.length !== 1 ? 's' : ''}</span>
            </div>
            <div className={styles.cardBody} style={{padding:0}}>
              {empLoading && <p className={styles.emptyNote}>Loading tracking data…</p>}
              {empError   && <p className={styles.emptyNote}>{empError}</p>}
              {!empLoading && !empError && employees.length === 0 && (
                <p className={styles.emptyNote}>No employee data yet. Employees appear here once they log in and start training.</p>
              )}
              {!empLoading && !empError && employees.length > 0 && (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Employee</th><th>Status</th><th>Modules</th>
                      <th>%</th><th>Time Spent</th><th>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp, i) => {
                      const pct   = emp.totalModules > 0 ? Math.round((emp.completed / emp.totalModules) * 100) : 0;
                      const hours = +(emp.totalMinutes / 60).toFixed(1);
                      const colors = ['#860038','#48002e','#0770A3','#1a7a3c','#c07000','#5B3F9E'];
                      return (
                        <tr key={emp.name}>
                          <td>
                            <div className={styles.nameCell}>
                              <div className={styles.avatar} style={{background: colors[i % colors.length]}}>
                                {emp.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className={styles.aName}>{emp.name}</div>
                                {emp.modules[0]?.email && (
                                  <div style={{fontSize:11,color:'#888'}}>{emp.modules[0].email}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>{statusBadge(emp)}</td>
                          <td>
                            <div className={styles.progWrap}>
                              <div className={styles.progBar}>
                                <div className={styles.progFill} style={{
                                  width: `${pct}%`,
                                  background: pct === 100 ? 'var(--success)' : pct > 50 ? 'var(--hc-gold)' : 'var(--hc-magenta)',
                                }}/>
                              </div>
                              <span className={styles.progTxt}>{emp.completed}/{emp.totalModules}</span>
                            </div>
                          </td>
                          <td><strong>{pct}%</strong></td>
                          <td>{hours > 0 ? `${hours} hrs` : '—'}</td>
                          <td className={styles.lastActive}>
                            {emp.lastActive ? new Date(emp.lastActive).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
