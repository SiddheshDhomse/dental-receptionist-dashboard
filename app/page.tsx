'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Appointment {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  is_new_patient: boolean;
  status: string;
  notes: string;
  booked_via: string;
  created_at: string;
}
interface Lead {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  reason: string;
  callback_requested: boolean;
  contacted: boolean;
  created_at: string;
}

const light = {
  bg: '#f8f9fb', card: '#ffffff', sidebar: '#0f0f1a',
  text: '#111827', muted: '#6b7280', border: '#f0f0f0',
  tableHead: '#fafafa', tableAlt: '#fafafa', inputBg: '#f9fafb',
  inputBorder: '#e5e7eb',
};
const dark = {
  bg: '#0f0f1a', card: '#1a1a2e', sidebar: '#070710',
  text: '#f3f4f6', muted: '#9ca3af', border: '#2a2a3e',
  tableHead: '#16162a', tableAlt: '#16162a', inputBg: '#1e1e32',
  inputBorder: '#2a2a3e',
};

const TYPES = ['Checkup','Cleaning','Filling','Root canal','Whitening','Implant','Consultation','X-Ray','Other'];
const STATUSES = ['confirmed','completed','cancelled','no_show'];

export default function Dashboard() {
  const [theme, setTheme] = useState<'light'|'dark'>('light');
  const [tab, setTab] = useState('overview');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [editAppt, setEditAppt] = useState<Appointment|null>(null);
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [newAppt, setNewAppt] = useState({
    patient_name:'', patient_phone:'', patient_email:'',
    appointment_date:'', appointment_time:'',
    appointment_type:'Checkup', is_new_patient:true,
    notes:'', status:'confirmed'
  });

  const c = theme === 'light' ? light : dark;

  useEffect(() => {
    fetchAll();
    const sub = supabase.channel('realtime-all')
      .on('postgres_changes',{event:'*',schema:'public',table:'appointments'},fetchAll)
      .on('postgres_changes',{event:'*',schema:'public',table:'leads'},fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: a },{ data: l }] = await Promise.all([
      supabase.from('appointments').select('*').order('appointment_date',{ascending:true}),
      supabase.from('leads').select('*').order('created_at',{ascending:false})
    ]);
    setAppointments(a||[]);
    setLeads(l||[]);
    setLoading(false);
  }

  function showToast(msg:string) {
    setToast(msg);
    setTimeout(()=>setToast(''),3000);
  }

  const today = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a=>a.appointment_date===today);
  const confirmedToday = todayAppts.filter(a=>a.status==='confirmed').length;
  const completedTotal = appointments.filter(a=>a.status==='completed').length;
  const cancelledTotal = appointments.filter(a=>a.status==='cancelled').length;
  const newPatients = appointments.filter(a=>a.is_new_patient).length;
  const convRate = appointments.length>0 ? Math.round((completedTotal/appointments.length)*100) : 0;
  const pendingCallbacks = leads.filter(l=>l.callback_requested&&!l.contacted).length;

  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const daysInMonth = new Date(calYear,calMonth+1,0).getDate();
  const firstDay = new Date(calYear,calMonth,1).getDay();
  const monthName = calendarDate.toLocaleString('default',{month:'long',year:'numeric'});

  function getDayAppts(day:number) {
    const d = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return appointments.filter(a=>a.appointment_date===d);
  }

  async function saveEditAppt() {
    if(!editAppt) return;
    setSaving(true);
    const {error} = await supabase.from('appointments').update({
      patient_name:editAppt.patient_name, patient_phone:editAppt.patient_phone,
      patient_email:editAppt.patient_email, appointment_date:editAppt.appointment_date,
      appointment_time:editAppt.appointment_time, appointment_type:editAppt.appointment_type,
      status:editAppt.status, notes:editAppt.notes,
    }).eq('id',editAppt.id);
    setSaving(false);
    if(!error){setEditAppt(null);fetchAll();showToast('Appointment updated');}
  }

  async function addAppointment() {
    if(!newAppt.patient_name||!newAppt.patient_phone||!newAppt.appointment_date||!newAppt.appointment_time){
      showToast('Please fill in all required fields');return;
    }
    setSaving(true);
    const {error} = await supabase.from('appointments').insert({
      ...newAppt, appointment_time:newAppt.appointment_time+':00', booked_via:'manual'
    });
    setSaving(false);
    if(!error){
      setShowAddAppt(false);
      setNewAppt({patient_name:'',patient_phone:'',patient_email:'',appointment_date:'',appointment_time:'',appointment_type:'Checkup',is_new_patient:true,notes:'',status:'confirmed'});
      fetchAll();showToast('Appointment added');
    }
  }

  async function markLeadContacted(id:string,contacted:boolean){
    await supabase.from('leads').update({contacted}).eq('id',id);
    fetchAll();
    showToast(contacted?'Marked as contacted':'Marked as pending');
  }

  const card = {background:c.card,border:`1px solid ${c.border}`,borderRadius:14,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'};
  const inputStyle = {width:'100%',padding:'8px 12px',borderRadius:8,border:`1px solid ${c.inputBorder}`,background:c.inputBg,color:c.text,fontSize:13,boxSizing:'border-box' as const};
  const labelStyle = {fontSize:12,color:c.muted,fontWeight:500,display:'block' as const,marginBottom:4};

  return (
    <div style={{fontFamily:'system-ui,sans-serif',background:c.bg,minHeight:'100vh',color:c.text}}>

      {toast&&<div style={{position:'fixed',top:20,right:20,zIndex:1000,background:'#22c55e',color:'#fff',padding:'10px 20px',borderRadius:10,fontSize:13,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>{toast}</div>}

      <div style={{position:'fixed',left:0,top:0,bottom:0,width:220,background:c.sidebar,color:'#fff',display:'flex',flexDirection:'column',padding:'24px 0',zIndex:10}}>
        <div style={{padding:'0 20px 24px',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:15,fontWeight:700}}>ReceptionistAI</div>
          <div style={{fontSize:10,color:'#6366f1',fontWeight:600,marginTop:2,letterSpacing:0.5}}>DENTAL DASHBOARD</div>
        </div>
        <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:10,color:'#6b7280',marginBottom:4,textTransform:'uppercase' as const,letterSpacing:0.5}}>Active clinic</div>
          <div style={{fontSize:13,fontWeight:600}}>Bright Smile Dental</div>
          <div style={{marginTop:8,display:'inline-flex',alignItems:'center',gap:5,background:'rgba(99,102,241,0.15)',color:'#818cf8',padding:'3px 8px',borderRadius:6,fontSize:10,fontWeight:600}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'#22c55e',display:'inline-block'}}/>AI LIVE
          </div>
        </div>
        <nav style={{flex:1,padding:'12px 10px'}}>
          {[{id:'overview',label:'Overview'},{id:'appointments',label:'Appointments'},{id:'calendar',label:'Calendar'},{id:'leads',label:'Leads'}].map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)} style={{width:'100%',display:'flex',alignItems:'center',padding:'10px 12px',borderRadius:8,border:'none',background:tab===item.id?'rgba(99,102,241,0.2)':'transparent',color:tab===item.id?'#a5b4fc':'#6b7280',cursor:'pointer',fontSize:13,fontWeight:tab===item.id?600:400,textAlign:'left',marginBottom:2}}>
              {item.label}
              {item.id==='leads'&&pendingCallbacks>0&&<span style={{marginLeft:'auto',background:'#ef4444',color:'#fff',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700}}>{pendingCallbacks}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:'16px 20px',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
          <button onClick={()=>setTheme(t=>t==='light'?'dark':'light')} style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'#9ca3af',cursor:'pointer',fontSize:12,textAlign:'left' as const}}>
            {theme==='light'?'Switch to Dark':'Switch to Light'} mode
          </button>
        </div>
      </div>

      <div style={{marginLeft:220,padding:'32px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:700,margin:0,color:c.text}}>{tab==='overview'?'Overview':tab==='appointments'?'Appointments':tab==='calendar'?'Calendar':'Leads'}</h1>
            <p style={{color:c.muted,fontSize:13,margin:'4px 0 0'}}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</p>
          </div>
          {tab==='appointments'&&<button onClick={()=>setShowAddAppt(true)} style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:10,padding:'10px 18px',fontSize:13,fontWeight:600,cursor:'pointer'}}>+ Add Appointment</button>}
        </div>

        {loading&&<div style={{textAlign:'center',padding:60,color:c.muted}}>Loading...</div>}

        {!loading&&tab==='overview'&&(
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
              {[{label:'Total Appointments',value:appointments.length,accent:'#6366f1'},{label:'Today',value:confirmedToday,accent:'#059669'},{label:'New Patients',value:newPatients,accent:'#d97706'},{label:'Pending Callbacks',value:pendingCallbacks,accent:'#ef4444'}].map(s=>(
                <div key={s.label} style={{...card,padding:'20px 22px'}}>
                  <div style={{fontSize:12,color:c.muted,fontWeight:500}}>{s.label}</div>
                  <div style={{fontSize:32,fontWeight:700,color:s.accent,marginTop:4}}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
              {[{label:'Completed',value:completedTotal},{label:'Cancelled',value:cancelledTotal},{label:'Completion Rate',value:`${convRate}%`}].map(s=>(
                <div key={s.label} style={{...card,padding:'20px 22px'}}>
                  <div style={{fontSize:12,color:c.muted,fontWeight:500}}>{s.label}</div>
                  <div style={{fontSize:28,fontWeight:700,color:c.text,marginTop:4}}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{...card,overflow:'hidden'}}>
              <div style={{padding:'16px 22px',borderBottom:`1px solid ${c.border}`}}><span style={{fontWeight:600,fontSize:14,color:c.text}}>Today's appointments — {todayAppts.length} total</span></div>
              {todayAppts.length===0?<div style={{padding:32,textAlign:'center',color:c.muted,fontSize:13}}>No appointments today</div>:(
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:c.tableHead}}>{['Patient','Time','Type','Status'].map(h=><th key={h} style={{padding:'10px 20px',textAlign:'left',fontSize:11,color:c.muted,fontWeight:600,letterSpacing:0.4,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
                  <tbody>{todayAppts.map((a,i)=><tr key={a.id} style={{borderTop:`1px solid ${c.border}`,background:i%2===0?c.card:c.tableAlt}}><td style={{padding:'12px 20px',fontSize:13,fontWeight:500,color:c.text}}>{a.patient_name}</td><td style={{padding:'12px 20px',fontSize:13,color:c.muted}}>{String(a.appointment_time).slice(0,5)}</td><td style={{padding:'12px 20px',fontSize:13,color:c.text}}>{a.appointment_type}</td><td style={{padding:'12px 20px'}}><StatusBadge status={a.status}/></td></tr>)}</tbody>
                </table>
              )}
            </div>
            <div style={{...card,padding:22}}>
              <div style={{fontWeight:600,fontSize:14,color:c.text,marginBottom:16}}>Appointments by type</div>
              {TYPES.map(type=>{
                const count=appointments.filter(a=>a.appointment_type===type).length;
                if(count===0)return null;
                const pct=Math.round((count/appointments.length)*100);
                return(<div key={type} style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}><span style={{color:c.muted}}>{type}</span><span style={{fontWeight:600,color:c.text}}>{count}</span></div><div style={{height:6,background:c.border,borderRadius:99}}><div style={{height:'100%',borderRadius:99,background:'#6366f1',width:`${pct}%`}}/></div></div>);
              })}
            </div>
          </div>
        )}

        {!loading&&tab==='appointments'&&(
          <div style={{...card,overflow:'hidden'}}>
            <div style={{padding:'16px 22px',borderBottom:`1px solid ${c.border}`}}><span style={{fontWeight:600,fontSize:14,color:c.text}}>All appointments — {appointments.length} total</span></div>
            {appointments.length===0?<div style={{padding:40,textAlign:'center',color:c.muted}}>No appointments yet.</div>:(
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:c.tableHead}}>{['Patient','Phone','Type','Date','Time','New?','Status','Source','Actions'].map(h=><th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:c.muted,fontWeight:600,letterSpacing:0.4,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                <tbody>{appointments.map((a,i)=>(
                  <tr key={a.id} style={{borderTop:`1px solid ${c.border}`,background:i%2===0?c.card:c.tableAlt}}>
                    <td style={{padding:'12px 16px',fontSize:13,fontWeight:500,color:c.text,whiteSpace:'nowrap'}}>{a.patient_name}</td>
                    <td style={{padding:'12px 16px',fontSize:12,color:c.muted,fontFamily:'monospace',whiteSpace:'nowrap'}}>{a.patient_phone}</td>
                    <td style={{padding:'12px 16px',fontSize:13,color:c.text}}>{a.appointment_type}</td>
                    <td style={{padding:'12px 16px',fontSize:13,color:c.text,whiteSpace:'nowrap'}}>{a.appointment_date}</td>
                    <td style={{padding:'12px 16px',fontSize:13,color:c.text}}>{String(a.appointment_time).slice(0,5)}</td>
                    <td style={{padding:'12px 16px'}}>{a.is_new_patient?<span style={{background:'#ede9fe',color:'#5b21b6',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>New</span>:<span style={{fontSize:12,color:c.muted}}>Returning</span>}</td>
                    <td style={{padding:'12px 16px'}}><StatusBadge status={a.status}/></td>
                    <td style={{padding:'12px 16px'}}><span style={{fontSize:11,color:c.muted,background:c.border,padding:'2px 7px',borderRadius:6}}>{a.booked_via==='manual'?'Manual':'AI'}</span></td>
                    <td style={{padding:'12px 16px'}}><button onClick={()=>setEditAppt({...a})} style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:6,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>Edit</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}

        {!loading&&tab==='calendar'&&(
          <div style={{...card,padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <button onClick={()=>setCalendarDate(new Date(calYear,calMonth-1,1))} style={{background:'none',border:`1px solid ${c.border}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',color:c.text,fontSize:13}}>← Prev</button>
              <span style={{fontWeight:700,fontSize:16,color:c.text}}>{monthName}</span>
              <button onClick={()=>setCalendarDate(new Date(calYear,calMonth+1,1))} style={{background:'none',border:`1px solid ${c.border}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',color:c.text,fontSize:13}}>Next →</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:4}}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} style={{textAlign:'center',fontSize:11,fontWeight:600,color:c.muted,padding:'6px 0',textTransform:'uppercase',letterSpacing:0.4}}>{d}</div>)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
              {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
              {Array.from({length:daysInMonth}).map((_,i)=>{
                const day=i+1;
                const dayAppts=getDayAppts(day);
                const isToday=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`===today;
                return(
                  <div key={day} style={{minHeight:72,padding:8,borderRadius:8,border:`1px solid ${isToday?'#6366f1':c.border}`,background:isToday?'rgba(99,102,241,0.08)':c.card}}>
                    <div style={{fontSize:12,fontWeight:isToday?700:500,color:isToday?'#6366f1':c.text,marginBottom:4}}>{day}</div>
                    {dayAppts.slice(0,3).map(a=><div key={a.id} onClick={()=>setEditAppt({...a})} style={{fontSize:10,background:'#6366f1',color:'#fff',borderRadius:4,padding:'2px 5px',marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',cursor:'pointer'}}>{a.patient_name.split(' ')[0]} · {String(a.appointment_time).slice(0,5)}</div>)}
                    {dayAppts.length>3&&<div style={{fontSize:10,color:c.muted}}>+{dayAppts.length-3} more</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading&&tab==='leads'&&(
          <div style={{...card,overflow:'hidden'}}>
            <div style={{padding:'16px 22px',borderBottom:`1px solid ${c.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:14,color:c.text}}>All leads — {leads.length} total</span>
              <span style={{fontSize:12,color:'#ef4444',fontWeight:600}}>{pendingCallbacks} pending callback{pendingCallbacks!==1?'s':''}</span>
            </div>
            {leads.length===0?<div style={{padding:40,textAlign:'center',color:c.muted}}>No leads yet.</div>:(
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:c.tableHead}}>{['Patient','Phone','Reason','Callback?','Status','Time','Action'].map(h=><th key={h} style={{padding:'10px 20px',textAlign:'left',fontSize:11,color:c.muted,fontWeight:600,letterSpacing:0.4,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
                <tbody>{leads.map((l,i)=>(
                  <tr key={l.id} style={{borderTop:`1px solid ${c.border}`,background:i%2===0?c.card:c.tableAlt,opacity:l.contacted?0.6:1}}>
                    <td style={{padding:'13px 20px',fontSize:13,fontWeight:500,color:c.text}}>{l.patient_name}</td>
                    <td style={{padding:'13px 20px',fontSize:12,color:c.muted,fontFamily:'monospace'}}>{l.patient_phone}</td>
                    <td style={{padding:'13px 20px',fontSize:13,color:c.text,maxWidth:200}}>{l.reason}</td>
                    <td style={{padding:'13px 20px'}}>{l.callback_requested?<span style={{background:'#fee2e2',color:'#b91c1c',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>Yes</span>:<span style={{fontSize:12,color:c.muted}}>No</span>}</td>
                    <td style={{padding:'13px 20px'}}><span style={{background:l.contacted?'#dcfce7':'#fef9c3',color:l.contacted?'#15803d':'#a16207',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>{l.contacted?'Contacted':'Pending'}</span></td>
                    <td style={{padding:'13px 20px',fontSize:12,color:c.muted,whiteSpace:'nowrap'}}>{new Date(l.created_at).toLocaleDateString()}</td>
                    <td style={{padding:'13px 20px'}}><button onClick={()=>markLeadContacted(l.id,!l.contacted)} style={{background:l.contacted?c.border:'#6366f1',color:l.contacted?c.text:'#fff',border:'none',borderRadius:6,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{l.contacted?'Mark pending':'Mark contacted'}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {editAppt&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <div style={{background:c.card,borderRadius:16,padding:28,width:480,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{margin:0,fontSize:17,fontWeight:700,color:c.text}}>Edit Appointment</h2>
              <button onClick={()=>setEditAppt(null)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:c.muted}}>✕</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {[{label:'Patient name *',key:'patient_name',type:'text'},{label:'Phone *',key:'patient_phone',type:'text'},{label:'Email',key:'patient_email',type:'email'},{label:'Date *',key:'appointment_date',type:'date'},{label:'Time *',key:'appointment_time',type:'time'},{label:'Notes',key:'notes',type:'text'}].map(field=>(
                <div key={field.key}>
                  <label style={labelStyle}>{field.label}</label>
                  <input type={field.type} value={(editAppt as any)[field.key]||''} onChange={e=>setEditAppt({...editAppt,[field.key]:e.target.value})} style={inputStyle}/>
                </div>
              ))}
              <div><label style={labelStyle}>Appointment type *</label><select value={editAppt.appointment_type} onChange={e=>setEditAppt({...editAppt,appointment_type:e.target.value})} style={inputStyle}>{TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div><label style={labelStyle}>Status</label><select value={editAppt.status} onChange={e=>setEditAppt({...editAppt,status:e.target.value})} style={inputStyle}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:22}}>
              <button onClick={()=>setEditAppt(null)} style={{flex:1,padding:'10px',borderRadius:8,border:`1px solid ${c.border}`,background:'none',color:c.text,cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={saveEditAppt} disabled={saving} style={{flex:2,padding:'10px',borderRadius:8,border:'none',background:'#6366f1',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving...':'Save changes'}</button>
            </div>
          </div>
        </div>
      )}

      {showAddAppt&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <div style={{background:c.card,borderRadius:16,padding:28,width:480,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{margin:0,fontSize:17,fontWeight:700,color:c.text}}>Add Appointment</h2>
              <button onClick={()=>setShowAddAppt(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:c.muted}}>✕</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {[{label:'Patient name *',key:'patient_name',type:'text'},{label:'Phone *',key:'patient_phone',type:'text'},{label:'Email',key:'patient_email',type:'email'},{label:'Date *',key:'appointment_date',type:'date'},{label:'Time *',key:'appointment_time',type:'time'},{label:'Notes',key:'notes',type:'text'}].map(field=>(
                <div key={field.key}>
                  <label style={labelStyle}>{field.label}</label>
                  <input type={field.type} value={(newAppt as any)[field.key]||''} onChange={e=>setNewAppt({...newAppt,[field.key]:e.target.value})} style={inputStyle}/>
                </div>
              ))}
              <div><label style={labelStyle}>Appointment type *</label><select value={newAppt.appointment_type} onChange={e=>setNewAppt({...newAppt,appointment_type:e.target.value})} style={inputStyle}>{TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" id="new_patient" checked={newAppt.is_new_patient} onChange={e=>setNewAppt({...newAppt,is_new_patient:e.target.checked})}/>
                <label htmlFor="new_patient" style={{fontSize:13,color:c.text,cursor:'pointer'}}>New patient</label>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:22}}>
              <button onClick={()=>setShowAddAppt(false)} style={{flex:1,padding:'10px',borderRadius:8,border:`1px solid ${c.border}`,background:'none',color:c.text,cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={addAppointment} disabled={saving} style={{flex:2,padding:'10px',borderRadius:8,border:'none',background:'#6366f1',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Adding...':'Add appointment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({status}:{status:string}){
  const map:Record<string,{bg:string;color:string}>={
    confirmed:{bg:'#dcfce7',color:'#15803d'},
    completed:{bg:'#dbeafe',color:'#1d4ed8'},
    cancelled:{bg:'#fee2e2',color:'#b91c1c'},
    no_show:{bg:'#fef9c3',color:'#a16207'},
  };
  const s=map[status]||{bg:'#f3f4f6',color:'#374151'};
  return <span style={{background:s.bg,color:s.color,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600}}>{status.replace('_',' ')}</span>;
}