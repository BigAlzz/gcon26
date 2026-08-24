import React, { useEffect, useState } from 'react';
import { getApiApplicantChat, getApiApplication, getApiNotifications, sendApiApplicantChat } from './api.js?placement=1';

function DocumentState({ label, ready }) {
  return <div className="document-status"><span className={ready ? 'doc-ready' : 'doc-missing'}>{ready ? '✓' : '!'}</span><span>{label}</span><strong>{ready ? 'Ready' : 'Missing'}</strong></div>;
}

export function CompleteReviewApplicationMinimal({ application: initialApplication, qualificationResult, profile = {}, pathway = 'NSC / Grade 12', preferences, documents, references, previousTraining, experience, additionalSubjects = [], trainingHistory = [], submitted, submittedReference, submitApplication, setStep }) {
  const [application, setApplication] = useState(initialApplication || null);
  const [notifications, setNotifications] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getApiApplication(), getApiNotifications(), getApiApplicantChat()]).then(([remote, notificationResult, chatResult]) => {
      if (!active) return;
      setApplication(remote?.application || null);
      setNotifications(notificationResult?.notifications || []);
      setChatMessages(chatResult?.messages || []);
    });
    return () => { active = false; };
  }, [submitted]);

  const correction = application?.status === 'Correction requested';
  const hasReceipt = submitted || Boolean(application?.submittedAt || (application?.ref && application?.status !== 'Draft'));
  const finalOutcome = ['Declined', 'Shortlisted', 'Placement ready', 'Placed', 'Withdrawn'].includes(application?.status);
  const firstName = profile.firstName || 'Lerato';
  const surname = profile.surname || 'Mokoena';
  const fullName = `${firstName} ${surname}`.trim();
  const scoreLabel = pathway === 'Senior Certificate' ? 'Calculated M score' : pathway === 'NSC / Grade 12' ? 'Academic score' : 'Reported NC(V) result';

  async function submit() {
    if (busy) return;
    setBusy(true);
    try { await submitApplication(); } finally { setBusy(false); }
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    const message = chatText.trim();
    if (!message || chatBusy) return;
    setChatBusy(true);
    setChatError('');
    const result = await sendApiApplicantChat(message);
    if (result?.messages) {
      setChatMessages(result.messages);
      setChatText('');
    } else {
      setChatError('Your message could not be sent. Please try again.');
    }
    setChatBusy(false);
  }

  if (hasReceipt) {
    const title = correction ? 'A correction is needed.' : application?.status === 'Declined' ? 'Your application outcome is available.' : finalOutcome ? 'Your application has moved to the next stage.' : 'Your application has been submitted.';
    return <div className="confirmation">
      <div className="confirmation-mark">{correction ? '!' : '✓'}</div>
      <p className="eyebrow">{correction ? 'ACTION REQUIRED' : finalOutcome ? 'APPLICATION OUTCOME' : 'APPLICATION RECEIVED'}</p>
      <h1>{title}</h1>
      <p>{correction ? 'Review the staff message, update only what is requested, and resubmit your application.' : 'Keep your reference number. You will only see correction requests and final outcomes here.'}</p>
      <div className="reference-card"><span>Reference number</span><strong>{submittedReference || application?.ref || 'Pending'}</strong><small>Submission receipt - saved by the intake service</small></div>
      {correction && <div className="correction-request"><strong>Correction requested</strong><span>{application.correctionRequest?.reason || 'Please review the requested correction and resubmit.'}</span><button className="text-button" onClick={() => setStep('profile')}>Return to profile -&gt;</button></div>}
      {application?.status === 'Declined' && <div className="correction-request"><strong>Final outcome</strong><span>{application.declineReason || 'Your application was not approved for the next stage.'}</span></div>}
      {application?.status === 'Placed' && <div className="decision-banner approved"><span>✓</span><div><strong>Placement accepted</strong><small>{application.placementCampus ? `Campus: ${application.placementCampus}` : 'Your placement response has been recorded.'}</small></div></div>}
      <section className="applicant-communications" aria-label="Notifications and support">
        <div className="section-line applicant-communications-heading"><div><p className="eyebrow">APPLICATION SUPPORT</p><h2>Notifications and chat</h2></div><span className="saved-label">Private to you</span></div>
        <div className="applicant-communications-grid">
          <section className="in-app-notifications" aria-label="In-app notifications"><div className="section-line"><h2>Notifications</h2><span className="saved-label">{notifications.length ? `${notifications.length} in app` : 'No new updates'}</span></div>{notifications.length ? notifications.slice(0, 5).map((notification) => <article className="in-app-notification" key={notification.id}><div><strong>{notification.subject || 'Application update'}</strong><p>{notification.message || 'An update is available in your application portal.'}</p></div><small>{notification.status === 'sent' ? 'Available now' : notification.status}</small></article>) : <div className="notification-empty"><strong>Nothing new right now.</strong><span>Correction requests and final outcomes will appear here.</span></div>}</section>
          <section className="applicant-chat" aria-label="Chat with admissions">
            <div className="chat-heading"><div><h2>Chat to admissions</h2><p>Ask a question about your application. Replies and official updates stay in this portal.</p></div><span className="chat-channel">In-app</span></div>
            <div className="chat-thread" aria-live="polite">
              <article className="chat-message incoming"><strong>Admissions support</strong><p>Hello {firstName}. Send us a question about your application and we will add the response here.</p><small>Support desk</small></article>
              {chatMessages.map((message) => <article className={`chat-message ${message.direction === 'inbound' ? 'incoming' : 'outgoing'}`} key={message.id}><strong>{message.sender || (message.direction === 'inbound' ? 'Admissions support' : 'You')}</strong><p>{message.message}</p><small>{message.status === 'sent' ? 'Sent' : message.status || 'In-app message'}</small></article>)}
            </div>
            <form className="chat-compose" onSubmit={sendChatMessage}><label className="field"><span>Message admissions</span><textarea value={chatText} onChange={(event) => setChatText(event.target.value)} maxLength={1000} rows={3} placeholder="Type your question..." /></label><div className="chat-compose-footer"><small>{chatText.length}/1000</small><button className="primary-button" type="submit" disabled={chatBusy || !chatText.trim()}>{chatBusy ? 'Sending...' : 'Send message'}</button></div>{chatError && <p className="chat-error" role="alert">{chatError}</p>}</form>
          </section>
        </div>
      </section>
      <div className="minimal-status"><strong>Current status</strong><span>{application?.status || 'Under review'}</span><span>Staff review your original pathway results and uploaded evidence.</span></div>
      <button className="primary-button" onClick={() => setStep('landing')}>Return to home -&gt;</button>
    </div>;
  }

  return <div className="form-page">
    <div className="step-header"><div><p className="eyebrow">APPLICATION JOURNEY</p><h1>Review</h1></div></div>
    {correction && <div className="correction-request"><strong>Correction requested</strong><span>{application.correctionRequest?.reason || 'Please update the requested information before resubmitting.'}</span><button className="text-button" onClick={() => setStep('profile')}>Edit profile -&gt;</button></div>}
    <section className="application-sheet"><div className="sheet-head"><div><p className="eyebrow">APPLICATION PREVIEW</p><h2>GCON 2027 - Diploma in Nursing</h2><p>Review your details before submitting. Your submitted application becomes a fixed snapshot.</p></div><div className="draft-tag">Draft - values preserved</div></div>
      <div className="cv-grid"><div className="cv-main">
        <section className="cv-section"><h3>Applicant</h3><div className="cv-fields"><div><span>Full name</span><strong>{fullName}</strong></div><div><span>ID number</span><strong>{profile.idNumber ? `${profile.idNumber.slice(0, 6)}•••••${profile.idNumber.slice(-3)}` : 'Not supplied'}</strong></div><div><span>Email</span><strong>{profile.email || 'Not supplied'}</strong></div><div><span>Telephone</span><strong>{profile.mobile || 'Not supplied'}</strong></div><div><span>Address</span><strong>{[profile.streetAddress, profile.suburb, profile.province].filter(Boolean).join(', ') || 'Not supplied'}</strong></div></div></section>
        <section className="cv-section"><h3>Education and pathway</h3><div className="cv-fields"><div><span>Pathway</span><strong>{pathway}</strong></div><div><span>School</span><strong>{profile.school || 'Not supplied'}</strong></div><div><span>Result year</span><strong>{profile.resultYear || 'Not supplied'}</strong></div><div><span>{scoreLabel}</span><strong className="score-text">{application?.score || qualificationResult?.score || qualificationResult?.values?.aps || 'Preserved in pathway values'}</strong></div></div></section>
        <section className="cv-section"><h3>College preferences</h3>{preferences.filter(Boolean).map((preference, index) => <div className="preference-row" key={preference}><span>{index + 1}</span><strong>{preference}</strong><small>Ranked preference - capacity count recorded</small></div>)}</section>
        <section className="cv-section"><h3>Remaining subjects</h3>{additionalSubjects.length ? additionalSubjects.filter((subject) => subject.name?.trim()).map((subject, index) => <div className="preference-row" key={`subject-${index}`}><span>•</span><strong>{subject.name}</strong><small>{subject.result || 'Result not supplied'}</small></div>) : <p className="section-copy">No additional subjects supplied.</p>}</section>
        <section className="cv-section"><h3>Training and experience</h3><div className="cv-fields"><div><span>Previous nursing training</span><strong>{previousTraining}</strong></div><div><span>Training records</span><strong>{trainingHistory.length || 'None'}</strong></div><div><span>Work experience</span><strong>{experience.length ? `${experience.length} entries` : 'None supplied'}</strong></div><div><span>References</span><strong>{references.filter((reference) => reference.name?.trim()).length} recorded</strong></div></div></section>
      </div><aside className="cv-side"><div className="cv-profile"><span className="large-avatar">{`${firstName[0] || 'L'}${surname[0] || 'M'}`}</span><strong>{fullName}</strong><span>{profile.province || 'Gauteng'} - Ready for submission</span></div><div className="cv-block"><h3>Evidence</h3><DocumentState label="Certified copy of ID" ready={documents.id} /><DocumentState label="Statement of results / certificate" ready={documents.results} /></div><div className="cv-block"><h3>Profile completeness</h3><div className="progress"><span /></div><strong>100%</strong><small>Required documents and at least one reference are present.</small></div></aside></div>
      <div className="sheet-footer"><button className="quiet-button" onClick={() => setStep('profile')}>Back to profile</button><button className="primary-button" disabled={busy} onClick={submit}>{busy ? 'Submitting...' : 'Submit application ->'}</button></div>
    </section>
  </div>;
}
