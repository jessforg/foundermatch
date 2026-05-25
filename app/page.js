'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const SECTORS = ['Tous','FinTech','GreenTech','EdTech','E-commerce','HealthTech','CleanTech','SaaS','Blockchain']
const STAGES  = ['Tous','Idée','R&D','MVP','Pre-Seed','Seed']
const ACCENTS = ['#FF6B6B','#4ECDC4','#FFD93D','#C77DFF','#FF9F43','#A8FF78','#00D4FF','#F7B731']
const stageColors = { Idée:'#888','R&D':'#4ECDC4',MVP:'#FFD93D','Pre-Seed':'#FF9F43',Seed:'#4CAF50' }

export default function FounderMatch() {
  // Auth
  const [user, setUser]           = useState(null)
  const [authMode, setAuthMode]   = useState('login')   // 'login' | 'signup' | 'profile'
  const [authEmail, setAuthEmail] = useState('')
  const [authPwd, setAuthPwd]     = useState('')
  const [authName, setAuthName]   = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoad, setAuthLoad]   = useState(false)

  // App
  const [tab, setTab]               = useState('discover')
  const [profiles, setProfiles]     = useState([])
  const [cardIdx, setCardIdx]       = useState(0)
  const [matches, setMatches]       = useState([])
  const [openMatch, setOpenMatch]   = useState(null)
  const [messages, setMessages]     = useState([])
  const [msgInput, setMsgInput]     = useState('')
  const [sectorF, setSectorF]       = useState('Tous')
  const [stageF, setStageF]         = useState('Tous')
  const [showFilters, setShowFilters] = useState(false)
  const [popupMatch, setPopupMatch] = useState(null)
  const [action, setAction]         = useState(null)
  const [myProfile, setMyProfile]   = useState(null)
  const [editProfile, setEditProfile] = useState(false)
  const [dragX, setDragX]           = useState(0)
  const [dragging, setDragging]     = useState(false)
  const dragStart = useRef(null)
  const chatEnd   = useRef(null)

  // ── Init session ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setUser(data.session.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load data when user logs in ───────────────────────────
  useEffect(() => {
    if (!user) return
    loadMyProfile()
    loadProfiles()
    loadMatches()
  }, [user, sectorF, stageF])

  // ── Realtime messages ─────────────────────────────────────
  useEffect(() => {
    if (!openMatch) return
    loadMessages(openMatch.id)
    const channel = supabase
      .channel('messages:' + openMatch.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${openMatch.id}` },
        payload => setMessages(m => [...m, payload.new]))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [openMatch])

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── API helpers ───────────────────────────────────────────
  async function loadMyProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setMyProfile(data)
    else setEditProfile(true)
  }

  async function loadProfiles() {
    const params = new URLSearchParams({ userId: user.id, sector: sectorF, stage: stageF })
    const res = await fetch(`/api/profiles?${params}`)
    const json = await res.json()
    setProfiles(json.profiles || [])
    setCardIdx(0)
  }

  async function loadMatches() {
    const res = await fetch(`/api/matches?userId=${user.id}`)
    const json = await res.json()
    setMatches(json.matches || [])
  }

  async function loadMessages(matchId) {
    const res = await fetch(`/api/messages?matchId=${matchId}`)
    const json = await res.json()
    setMessages(json.messages || [])
  }

  // ── Auth ─────────────────────────────────────────────────
  async function handleAuth() {
    setAuthError(''); setAuthLoad(true)
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: authMode, email: authEmail, password: authPwd, name: authName })
    })
    const json = await res.json()
    setAuthLoad(false)
    if (json.error) { setAuthError(json.error); return }
    if (authMode === 'signup') {
      // After signup supabase sends email; in dev we auto-sign in
      const { data } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPwd })
      if (data.session) setUser(data.session.user)
    }
  }

  async function saveProfile(data) {
    await fetch('/api/profiles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, ...data })
    })
    setMyProfile(data)
    setEditProfile(false)
    loadProfiles()
  }

  // ── Swipe ────────────────────────────────────────────────
  async function handleSwipe(dir) {
    const current = profiles[cardIdx]
    if (!current) return
    setAction(dir)
    setTimeout(async () => {
      const res = await fetch('/api/swipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swiperId: user.id, swipedId: current.id, direction: dir })
      })
      const json = await res.json()
      if (json.matched) {
        setPopupMatch({ ...current, matchId: json.match.id })
        loadMatches()
      }
      setCardIdx(i => i + 1)
      setAction(null); setDragX(0)
    }, 350)
  }

  function onMouseDown(e) { dragStart.current = e.clientX; setDragging(true) }
  function onMouseMove(e) { if (!dragging) return; setDragX(e.clientX - dragStart.current) }
  function onMouseUp() {
    if (!dragging) return; setDragging(false)
    if (dragX > 80) handleSwipe('match')
    else if (dragX < -80) handleSwipe('pass')
    else setDragX(0)
    dragStart.current = null
  }
  function onTouchStart(e) { dragStart.current = e.touches[0].clientX; setDragging(true) }
  function onTouchMove(e) { if (!dragging) return; setDragX(e.touches[0].clientX - dragStart.current) }
  function onTouchEnd() {
    setDragging(false)
    if (dragX > 80) handleSwipe('match')
    else if (dragX < -80) handleSwipe('pass')
    else setDragX(0)
    dragStart.current = null
  }

  async function sendMessage() {
    if (!msgInput.trim() || !openMatch) return
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: openMatch.id, senderId: user.id, text: msgInput.trim() })
    })
    setMsgInput('')
  }

  // ── Computed ─────────────────────────────────────────────
  const current   = profiles[cardIdx]
  const done      = cardIdx >= profiles.length
  const rotation  = dragging ? dragX * 0.06 : 0
  const swipeDir  = dragX > 40 ? 'match' : dragX < -40 ? 'pass' : null

  // ════════════════════════════════════════
  // NOT LOGGED IN → Auth screens
  // ════════════════════════════════════════
  if (!user) return (
    <div style={S.root}>
      <div style={S.noise} />
      <div style={S.authBox}>
        <div style={S.logo}><span>⚡</span><span style={S.logoText}>FounderMatch</span>
        <p style={S.authSub}>Trouve ton co-fondateur idéal</p>

        <div style={S.authTabs}>
          <button style={{ ...S.authTab, ...(authMode==='login' ? S.authTabActive : {}) }} onClick={() => setAuthMode('login')}>Connexion</button>
          <button style={{ ...S.authTab, ...(authMode==='signup' ? S.authTabActive : {}) }} onClick={() => setAuthMode('signup')}>Inscription</button>
        </div>

        {authMode === 'signup' && (
          <input style={S.input} placeholder="Ton prénom & nom" value={authName} onChange={e => setAuthName(e.target.value)} />
        )}
        <input style={S.input} placeholder="Email" type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
        <input style={S.input} placeholder="Mot de passe" type="password" value={authPwd} onChange={e => setAuthPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAuth()} />

        {authError && <p style={S.authError}>{authError}</p>}

        <button style={{ ...S.authBtn, opacity: authLoad ? 0.6 : 1 }} onClick={handleAuth} disabled={authLoad}>
          {authLoad ? 'Chargement...' : authMode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
      </div>
    </div>
  )

  // ════════════════════════════════════════
  // EDIT PROFILE screen
  // ════════════════════════════════════════
  if (editProfile) return <ProfileEditor initial={myProfile} onSave={saveProfile} onCancel={() => setEditProfile(false)} userId={user.id} />

  // ════════════════════════════════════════
  // MAIN APP
  // ════════════════════════════════════════
  return (
    <div style={S.root}>
      <div style={S.noise} />

      {/* Header */}
      <header style={S.header}>
        <div style={S.logo} onClick={() => setEditProfile(true)} title="Modifier mon profil" role="button">
          <span>⚡</span><span style={S.logoText}>FounderMatch</span>
        </div>
        <nav style={S.nav}>
          {[
            { key:'discover', label:'Découvrir' },
            { key:'matches',  label:'Connexions', count: matches.length },
            { key:'messages', label:'Messages' },
          ].map(({ key, label, count }) => (
            <button key={key}
              style={{ ...S.navBtn, ...(tab===key ? S.navBtnActive : {}) }}
              onClick={() => { setTab(key); setOpenMatch(null) }}>
              {label}
              {count > 0 && <span style={S.badge}>{count}</span>}
            </button>
          ))}
        </nav>
      </header>

      {/* ── DISCOVER ── */}
      {tab === 'discover' && (
        <main style={S.main}>
          {/* Filter bar */}
          <div style={S.filterBar}>
            <button style={S.filterToggle} onClick={() => setShowFilters(f => !f)}>
              🎛 Filtres {(sectorF !== 'Tous' || stageF !== 'Tous') && <span style={S.filterDot} />}
            </button>
            {sectorF !== 'Tous' && <span style={S.activeF}>{sectorF} <span style={S.clearF} onClick={() => setSectorF('Tous')}>✕</span></span>}
            {stageF  !== 'Tous' && <span style={S.activeF}>{stageF}  <span style={S.clearF} onClick={() => setStageF('Tous')}>✕</span></span>}
          </div>
          {showFilters && (
            <div style={S.filterPanel}>
              <p style={S.filterLabel}>SECTEUR</p>
              <div style={S.filterChips}>{SECTORS.map(s => <button key={s} style={{ ...S.chip2, ...(sectorF===s ? S.chip2Active : {}) }} onClick={() => setSectorF(s)}>{s}</button>)}</div>
              <p style={{ ...S.filterLabel, marginTop: 10 }}>STADE</p>
              <div style={S.filterChips}>{STAGES.map(s => <button key={s} style={{ ...S.chip2, ...(stageF===s ? S.chip2Active : {}) }} onClick={() => setStageF(s)}>{s}</button>)}</div>
            </div>
          )}

          {/* Card */}
          <div style={S.cardArea}>
            {!done && profiles[cardIdx+1] && (
              <div style={{ ...S.card, ...S.cardBehind, background: '#0f0f1a' }} />
            )}
            {done ? (
              <div style={S.emptyState}>
                <span style={{ fontSize: 44 }}>🚀</span>
                <h2 style={S.emptyTitle}>Plus de profils !</h2>
                <p style={S.emptyText}>Essayez d'autres filtres.</p>
                <button style={S.resetBtn} onClick={() => { setSectorF('Tous'); setStageF('Tous') }}>Réinitialiser</button>
              </div>
            ) : current ? (
              <div
                style={{ ...S.card, background: current.bg || 'linear-gradient(135deg,#0f0f1a,#1a1a2e)',
                  border: `1.5px solid ${current.accent||'#4ECDC4'}22`,
                  transform: `rotate(${rotation}deg) translateX(${dragX}px)`,
                  opacity: action ? 0 : 1,
                  transition: action ? 'opacity 0.3s,transform 0.3s' : dragging ? 'none' : 'transform 0.3s',
                  cursor: dragging ? 'grabbing' : 'grab' }}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
              >
                {swipeDir === 'match' && <div style={{ ...S.swipeLabel, ...S.swipeMatch }}>CONNECTER ✓</div>}
                {swipeDir === 'pass'  && <div style={{ ...S.swipeLabel, ...S.swipePass  }}>PASSER ✗</div>}

                <div style={{ ...S.avatarCircle, background: (current.accent||'#4ECDC4')+'22', border: `2px solid ${current.accent||'#4ECDC4'}` }}>
                  <span style={{ ...S.avatarText, color: current.accent||'#4ECDC4' }}>{current.avatar || current.name?.slice(0,2).toUpperCase()}</span>
                </div>
                {current.stage && <div style={{ ...S.stageBadge, background: (stageColors[current.stage]||'#888')+'22', border: `1px solid ${stageColors[current.stage]||'#888'}`, color: stageColors[current.stage]||'#888' }}>{current.stage}</div>}

                <div style={S.cardContent}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                    <h2 style={S.name}>{current.name}</h2>
                    {current.age && <span style={{ fontSize:15, color:'#888' }}>{current.age} ans</span>}
                  </div>
                  {current.title && <p style={{ ...S.cardTitle, color: current.accent||'#4ECDC4' }}>{current.title}</p>}
                  <p style={S.location}>📍 {current.location||'—'} · <span style={{ color:(current.accent||'#4ECDC4')+'bb' }}>{current.sector||'—'}</span></p>
                  <div style={S.divider} />
                  {current.idea && <><p style={S.sectionLabel}>L'IDÉE</p><p style={S.idea}>"{current.idea}"</p><div style={S.divider} /></>}
                  {current.looking_for && <><p style={S.sectionLabel}>RECHERCHE</p>
                    <div style={{ ...S.chip, background:(current.accent||'#4ECDC4')+'22', borderColor:(current.accent||'#4ECDC4')+'55', color:current.accent||'#4ECDC4' }}>{current.looking_for}</div></>}
                  {current.skills?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:'auto' }}>
                      {current.skills.map(s => <span key={s} style={S.skill}>{s}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ) : <div style={S.emptyState}><span style={{ fontSize:36 }}>⏳</span><p style={S.emptyText}>Chargement...</p></div>}
          </div>

          {!done && current && (
            <div style={S.buttons}>
              <button style={{ ...S.btn, ...S.btnPass }} onClick={() => handleSwipe('pass')}><span style={{ fontSize:22 }}>✕</span><span style={{ fontSize:11 }}>Passer</span></button>
              <button style={{ ...S.btn, ...S.btnMatch }} onClick={() => handleSwipe('match')}><span style={{ fontSize:22 }}>⚡</span><span style={{ fontSize:11 }}>Connecter</span></button>
            </div>
          )}
          <p style={S.hint}>← Glissez ou utilisez les boutons →</p>
        </main>
      )}

      {/* ── MATCHES ── */}
      {tab === 'matches' && (
        <main style={{ ...S.main, alignItems:'stretch' }}>
          <h2 style={{ ...S.sectionTitle, padding:0 }}>Connexions ({matches.length})</h2>
          {matches.length === 0
            ? <div style={S.emptyState}><span style={{ fontSize:44 }}>🤝</span><p style={S.emptyText}>Aucune connexion encore.</p></div>
            : matches.map(m => <MatchRow key={m.id} match={m} userId={user.id} onClick={() => { setOpenMatch(m); setTab('messages') }} />)
          }
        </main>
      )}

      {/* ── MESSAGES ── */}
      {tab === 'messages' && (
        <main style={{ width:'100%', maxWidth:520, flex:1, display:'flex', flexDirection:'column', position:'relative', zIndex:2 }}>
          {!openMatch ? (
            <div style={{ padding:'0 16px' }}>
              <h2 style={S.sectionTitle}>Messages</h2>
              {matches.length === 0
                ? <div style={S.emptyState}><span style={{ fontSize:44 }}>💬</span><p style={S.emptyText}>Connectez-vous d'abord avec quelqu'un !</p></div>
                : matches.map(m => <MatchRow key={m.id} match={m} userId={user.id} onClick={() => setOpenMatch(m)} />)
              }
            </div>
          ) : (
            <ChatView
              match={openMatch} messages={messages} userId={user.id}
              msgInput={msgInput} setMsgInput={setMsgInput}
              sendMessage={sendMessage} onBack={() => setOpenMatch(null)}
              chatEnd={chatEnd}
            />
          )}
        </main>
      )}

      {/* Match popup */}
      {popupMatch && (
        <div style={S.overlay} onClick={() => setPopupMatch(null)}>
          <div style={S.popup} onClick={e => e.stopPropagation()}>
            <div style={{ ...S.popupGlow, background: `radial-gradient(circle,${popupMatch.accent||'#4ECDC4'}44,transparent 70%)` }} />
            <span style={{ fontSize:44 }}>⚡</span>
            <h2 style={S.popupTitle}>Nouvelle Connexion !</h2>
            <div style={{ ...S.avatarCircle, width:72, height:72, background:(popupMatch.accent||'#4ECDC4')+'22', border:`3px solid ${popupMatch.accent||'#4ECDC4'}`, margin:'4px 0' }}>
              <span style={{ ...S.avatarText, color:popupMatch.accent||'#4ECDC4', fontSize:26 }}>{popupMatch.avatar||popupMatch.name?.slice(0,2).toUpperCase()}</span>
            </div>
            <p style={{ fontSize:19, fontWeight:800, margin:0 }}>{popupMatch.name}</p>
            <p style={{ color:'#888', fontSize:13, margin:0, textAlign:'center' }}>Vous êtes prêts à collaborer !</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', marginTop:6 }}>
              <button style={{ ...S.popupBtn, background:popupMatch.accent||'#4ECDC4', color:'#000' }}
                onClick={() => {
                  const m = matches.find(x => x.id === popupMatch.matchId) || matches[matches.length-1]
                  setPopupMatch(null); setOpenMatch(m); setTab('messages')
                }}>💬 Envoyer un message</button>
              <button style={S.popupBtnSec} onClick={() => setPopupMatch(null)}>Continuer à explorer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────

function MatchRow({ match, userId, onClick }) {
  const p = match.profile
  if (!p) return null
  const last = match.lastMessage
  return (
    <div style={{ ...S.matchRow, border:`1px solid ${p.accent||'#4ECDC4'}22` }} onClick={onClick}>
      <div style={{ ...S.avatarCircle, width:48, height:48, flexShrink:0, background:(p.accent||'#4ECDC4')+'22', border:`2px solid ${p.accent||'#4ECDC4'}` }}>
        <span style={{ ...S.avatarText, color:p.accent||'#4ECDC4', fontSize:16 }}>{p.avatar||p.name?.slice(0,2).toUpperCase()}</span>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#f0f0ff' }}>{p.name}</span>
          {last && <span style={{ fontSize:10, color:'#555' }}>{new Date(last.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})}</span>}
        </div>
        <span style={{ fontSize:11, color:(p.accent||'#4ECDC4')+'cc', fontWeight:600 }}>{p.sector} · {p.location}</span>
        {last
          ? <p style={{ fontSize:12, margin:'2px 0 0', color:'#666', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {last.sender_id === userId ? 'Vous: ' : ''}{last.text.slice(0,50)}{last.text.length>50?'...':''}
            </p>
          : <p style={{ fontSize:12, margin:'2px 0 0', color:'#444', fontStyle:'italic' }}>Commencez la conversation…</p>
        }
      </div>
      <span style={{ fontSize:18, color:p.accent||'#4ECDC4', flexShrink:0 }}>💬</span>
    </div>
  )
}

function ChatView({ match, messages, userId, msgInput, setMsgInput, sendMessage, onBack, chatEnd }) {
  const p = match.profile
  if (!p) return null
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 120px)', width:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#0a0a12', borderBottom:`1px solid ${p.accent||'#4ECDC4'}22`, flexShrink:0 }}>
        <button style={{ background:'transparent', border:'none', color:'#888', cursor:'pointer', fontSize:13, fontWeight:600 }} onClick={onBack}>← Retour</button>
        <div style={{ ...S.avatarCircle, width:40, height:40, flexShrink:0, background:(p.accent||'#4ECDC4')+'22', border:`2px solid ${p.accent||'#4ECDC4'}` }}>
          <span style={{ ...S.avatarText, color:p.accent||'#4ECDC4', fontSize:14 }}>{p.avatar||p.name?.slice(0,2).toUpperCase()}</span>
        </div>
        <div>
          <p style={{ fontSize:15, fontWeight:700, margin:0, color:'#f0f0ff' }}>{p.name}</p>
          <p style={{ fontSize:11, fontWeight:600, margin:0, color:p.accent||'#4ECDC4' }}>{p.sector}</p>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:10 }}>
        {messages.length === 0 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, color:'#555' }}>
            <span style={{ fontSize:36 }}>👋</span>
            <p style={{ marginTop:8 }}>Dites bonjour à {p.name} !</p>
          </div>
        )}
        {messages.map((msg,i) => {
          const isMe = msg.sender_id === userId
          const t = new Date(msg.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})
          return (
            <div key={i} style={{ display:'flex', alignItems:'flex-end', gap:8, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              {!isMe && (
                <div style={{ ...S.avatarCircle, width:28, height:28, flexShrink:0, background:(p.accent||'#4ECDC4')+'22', border:`1.5px solid ${p.accent||'#4ECDC4'}` }}>
                  <span style={{ ...S.avatarText, color:p.accent||'#4ECDC4', fontSize:10 }}>{p.avatar||p.name?.slice(0,2).toUpperCase()}</span>
                </div>
              )}
              <div style={{ maxWidth:'72%', padding:'10px 14px', boxShadow:'0 2px 8px rgba(0,0,0,0.3)',
                background: isMe ? (p.accent||'#4ECDC4')+'dd' : '#1a1a2e',
                color: isMe ? '#000' : '#f0f0ff',
                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                border: !isMe ? `1px solid ${p.accent||'#4ECDC4'}22` : 'none'
              }}>
                <p style={{ fontSize:14, margin:0, lineHeight:1.4 }}>{msg.text}</p>
                <p style={{ fontSize:10, margin:'4px 0 0', textAlign:'right', color: isMe ? '#00000066' : '#ffffff33' }}>{t}</p>
              </div>
            </div>
          )
        })}
        <div ref={chatEnd} />
      </div>

      <div style={{ display:'flex', gap:10, padding:'12px 16px', background:'#0a0a12', borderTop:`1px solid ${p.accent||'#4ECDC4'}22`, flexShrink:0 }}>
        <input style={{ flex:1, background:'#1a1a2e', border:'1px solid #ffffff18', borderRadius:22, padding:'10px 16px', color:'#f0f0ff', fontSize:14, outline:'none' }}
          placeholder="Votre message..." value={msgInput}
          onChange={e => setMsgInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()} />
        <button style={{ width:42, height:42, borderRadius:'50%', border:'none', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700,
          background: p.accent||'#4ECDC4', color:'#000', opacity: msgInput.trim() ? 1 : 0.4, transition:'opacity 0.2s' }}
          onClick={sendMessage}>➤</button>
      </div>
    </div>
  )
}

function ProfileEditor({ initial, onSave, onCancel, userId }) {
  const ACCENTS = ['#FF6B6B','#4ECDC4','#FFD93D','#C77DFF','#FF9F43','#A8FF78','#00D4FF','#F7B731']
  const [form, setForm] = useState({
    name: initial?.name || '', age: initial?.age || '', title: initial?.title || '',
    sector: initial?.sector || '', idea: initial?.idea || '', looking_for: initial?.looking_for || '',
    skills: initial?.skills?.join(', ') || '', location: initial?.location || '',
    stage: initial?.stage || 'Idée', accent: initial?.accent || '#4ECDC4',
    avatar: initial?.avatar || '',
  })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function handleSave() {
    onSave({ ...form, age: parseInt(form.age) || null,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      avatar: form.avatar || form.name.slice(0,2).toUpperCase() })
  }
  return (
    <div style={{ ...S.root, overflowY:'auto' }}>
      <div style={S.noise} />
      <div style={{ ...S.authBox, maxWidth:460, gap:10, padding:'28px 24px' }}>
        <h2 style={{ fontSize:20, fontWeight:800, margin:'0 0 4px', color:'#f0f0ff' }}>Mon Profil</h2>
        <p style={{ fontSize:12, color:'#666', margin:'0 0 8px' }}>Ces infos seront visibles par les autres fondateurs</p>
        {[
          ['Prénom & Nom *', 'name', 'text'], ['Âge', 'age', 'number'],
          ['Titre (ex: Co-fondateur FinTech)', 'title', 'text'],
          ['Mon idée / projet', 'idea', 'text'],
          ['Ville', 'location', 'text'],
          ['Je recherche (ex: Développeur Full-Stack)', 'looking_for', 'text'],
          ['Compétences (séparées par virgule)', 'skills', 'text'],
        ].map(([label, key, type]) => (
          <div key={key}>
            <p style={{ fontSize:11, color:'#666', margin:'0 0 3px', fontWeight:600 }}>{label}</p>
            <input style={S.input} type={type} placeholder={label} value={form[key]} onChange={e => set(key, e.target.value)} />
          </div>
        ))}
        <div>
          <p style={{ fontSize:11, color:'#666', margin:'0 0 6px', fontWeight:600 }}>Secteur</p>
          <div style={S.filterChips}>{SECTORS.slice(1).map(s => <button key={s} style={{ ...S.chip2, ...(form.sector===s ? S.chip2Active : {}) }} onClick={() => set('sector', s)}>{s}</button>)}</div>
        </div>
        <div>
          <p style={{ fontSize:11, color:'#666', margin:'6px 0 6px', fontWeight:600 }}>Stade du projet</p>
          <div style={S.filterChips}>{STAGES.slice(1).map(s => <button key={s} style={{ ...S.chip2, ...(form.stage===s ? S.chip2Active : {}) }} onClick={() => set('stage', s)}>{s}</button>)}</div>
        </div>
        <div>
          <p style={{ fontSize:11, color:'#666', margin:'6px 0 6px', fontWeight:600 }}>Couleur de profil</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {ACCENTS.map(a => <div key={a} style={{ width:28, height:28, borderRadius:'50%', background:a, cursor:'pointer', border: form.accent===a ? '3px solid #fff' : '3px solid transparent', transition:'border 0.15s' }} onClick={() => set('accent', a)} />)}
          </div>
        </div>
        <button style={{ ...S.authBtn, marginTop:8 }} onClick={handleSave}>Sauvegarder</button>
        {onCancel && <button style={{ background:'transparent', border:'none', color:'#666', cursor:'pointer', fontSize:13 }} onClick={onCancel}>Annuler</button>}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────
const S = {
  root: { minHeight:'100vh', background:'#080810', color:'#f0f0ff', fontFamily:"'DM Sans','Segoe UI',sans-serif", display:'flex', flexDirection:'column', alignItems:'center', position:'relative', overflow:'hidden' },
  noise: { position:'fixed', inset:0, backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`, pointerEvents:'none', zIndex:0 },
  header: { width:'100%', maxWidth:520, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 20px 10px', position:'relative', zIndex:2, flexWrap:'wrap', gap:8 },
  logo: { display:'flex', alignItems:'center', gap:8, cursor:'pointer' },
  logoText: { fontSize:19, fontWeight:800, letterSpacing:'-0.5px' },
  nav: { display:'flex', gap:4 },
  navBtn: { background:'transparent', border:'1px solid #ffffff15', color:'#888', padding:'5px 12px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:600, position:'relative', transition:'all 0.2s' },
  navBtnActive: { background:'#ffffff12', borderColor:'#ffffff30', color:'#f0f0ff' },
  badge: { position:'absolute', top:-4, right:-4, background:'#FF6B6B', color:'#fff', borderRadius:'50%', width:16, height:16, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 },
  main: { display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:420, padding:'0 16px', position:'relative', zIndex:2, flex:1 },
  filterBar: { display:'flex', alignItems:'center', gap:8, width:'100%', flexWrap:'wrap', marginBottom:8, position:'relative', zIndex:2 },
  filterToggle: { background:'#ffffff0a', border:'1px solid #ffffff18', color:'#aaa', padding:'6px 14px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:6, position:'relative' },
  filterDot: { width:6, height:6, borderRadius:'50%', background:'#FF9F43', display:'inline-block' },
  activeF: { background:'#ffffff12', border:'1px solid #ffffff22', color:'#f0f0ff', padding:'4px 10px', borderRadius:12, fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:4 },
  clearF: { cursor:'pointer', color:'#888', fontWeight:800 },
  filterPanel: { width:'100%', background:'#0f0f1a', border:'1px solid #ffffff12', borderRadius:16, padding:'14px 16px', marginBottom:10, position:'relative', zIndex:2 },
  filterLabel: { fontSize:10, fontWeight:700, letterSpacing:2, color:'#555', margin:'0 0 6px' },
  filterChips: { display:'flex', flexWrap:'wrap', gap:6 },
  chip2: { background:'#ffffff08', border:'1px solid #ffffff15', color:'#777', padding:'4px 10px', borderRadius:12, cursor:'pointer', fontSize:11, fontWeight:600, transition:'all 0.15s' },
  chip2Active: { background:'#4ECDC422', borderColor:'#4ECDC4', color:'#4ECDC4' },
  cardArea: { position:'relative', width:'100%', height:490, marginTop:4 },
  card: { position:'absolute', inset:0, borderRadius:24, padding:'24px 22px 18px', boxShadow:'0 32px 64px rgba(0,0,0,0.6)', userSelect:'none', display:'flex', flexDirection:'column', willChange:'transform', overflow:'hidden' },
  cardBehind: { transform:'scale(0.95) translateY(12px)', opacity:0.45, borderRadius:24 },
  swipeLabel: { position:'absolute', top:24, padding:'5px 14px', borderRadius:8, fontWeight:800, fontSize:14, letterSpacing:1, zIndex:10, border:'2.5px solid' },
  swipeMatch: { right:18, color:'#4ECDC4', borderColor:'#4ECDC4', background:'#4ECDC422' },
  swipePass: { left:18, color:'#FF6B6B', borderColor:'#FF6B6B', background:'#FF6B6B22' },
  avatarCircle: { width:68, height:68, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:6 },
  avatarText: { fontSize:22, fontWeight:800, letterSpacing:-1 },
  stageBadge: { position:'absolute', top:22, right:18, padding:'3px 10px', borderRadius:12, fontSize:10, fontWeight:700, letterSpacing:0.5 },
  cardContent: { flex:1, display:'flex', flexDirection:'column' },
  name: { fontSize:24, fontWeight:800, margin:0, letterSpacing:'-0.5px', color:'#f0f0ff' },
  cardTitle: { fontSize:12, fontWeight:700, margin:'2px 0 3px', letterSpacing:1, textTransform:'uppercase' },
  location: { fontSize:12, color:'#888', margin:0 },
  divider: { height:1, background:'#ffffff10', margin:'10px 0' },
  sectionLabel: { fontSize:9, fontWeight:700, letterSpacing:2, color:'#555', marginBottom:3 },
  idea: { fontSize:13, color:'#ccc', fontStyle:'italic', margin:0, lineHeight:1.5 },
  chip: { display:'inline-block', padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700, border:'1px solid', marginBottom:8 },
  skill: { background:'#ffffff08', border:'1px solid #ffffff15', color:'#aaa', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:500 },
  buttons: { display:'flex', gap:20, marginTop:16 },
  btn: { display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'12px 30px', borderRadius:14, border:'none', cursor:'pointer', fontWeight:700, fontSize:13 },
  btnPass: { background:'#FF6B6B18', border:'1.5px solid #FF6B6B44', color:'#FF6B6B' },
  btnMatch: { background:'#4ECDC418', border:'1.5px solid #4ECDC444', color:'#4ECDC4' },
  hint: { fontSize:10, color:'#333', marginTop:8 },
  emptyState: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:8 },
  emptyTitle: { fontSize:20, fontWeight:800, margin:0 },
  emptyText: { color:'#666', margin:0, textAlign:'center', fontSize:14 },
  resetBtn: { marginTop:8, background:'#4ECDC422', border:'1px solid #4ECDC444', color:'#4ECDC4', padding:'8px 20px', borderRadius:12, cursor:'pointer', fontWeight:700, fontSize:13 },
  sectionTitle: { fontSize:18, fontWeight:800, margin:'0 0 14px' },
  matchRow: { display:'flex', alignItems:'center', gap:12, background:'#0f0f1a', borderRadius:16, padding:'12px 14px', cursor:'pointer', marginBottom:8 },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' },
  popup: { background:'#0f0f1a', border:'1px solid #ffffff15', borderRadius:28, padding:'36px 28px', maxWidth:320, width:'90%', display:'flex', flexDirection:'column', alignItems:'center', gap:8, position:'relative', overflow:'hidden' },
  popupGlow: { position:'absolute', top:-60, left:'50%', transform:'translateX(-50%)', width:200, height:200, borderRadius:'50%', pointerEvents:'none' },
  popupTitle: { fontSize:24, fontWeight:900, margin:0, color:'#f0f0ff' },
  popupBtn: { padding:12, borderRadius:14, border:'none', fontWeight:800, fontSize:14, cursor:'pointer', textAlign:'center' },
  popupBtnSec: { padding:10, borderRadius:14, background:'transparent', border:'1px solid #ffffff18', color:'#888', fontWeight:600, fontSize:13, cursor:'pointer' },
  // Auth
  authBox: { background:'#0f0f1a', border:'1px solid #ffffff12', borderRadius:24, padding:'36px 28px', width:'90%', maxWidth:380, display:'flex', flexDirection:'column', gap:14, position:'relative', zIndex:2, marginTop:40 },
  authSub: { color:'#666', margin:'0 0 4px', fontSize:13, textAlign:'center' },
  authTabs: { display:'flex', background:'#ffffff08', borderRadius:12, padding:3, gap:3 },
  authTab: { flex:1, padding:'8px 0', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, background:'transparent', color:'#888', transition:'all 0.2s' },
  authTabActive: { background:'#ffffff15', color:'#f0f0ff' },
  input: { width:'100%', background:'#1a1a2e', border:'1px solid #ffffff18', borderRadius:12, padding:'11px 14px', color:'#f0f0ff', fontSize:14, outline:'none', boxSizing:'border-box' },
  authError: { color:'#FF6B6B', fontSize:13, margin:0, textAlign:'center' },
  authBtn: { background:'#4ECDC4', color:'#000', border:'none', borderRadius:14, padding:'13px', fontWeight:800, fontSize:15, cursor:'pointer', transition:'opacity 0.2s' },
}
