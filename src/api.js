const SESSION_KEY = 'gcon-session-v2';

function readSession() {
  if (typeof window === 'undefined') return null;
  try {
    const session = JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
    if (session?.expiresAt && new Date(session.expiresAt) <= new Date()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch { return null; }
}

function writeSession(session) {
  if (typeof window !== 'undefined') window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export const getStoredSession = readSession;

let apiToken = readSession()?.token || '';

export const setApiActor = (session, persist = true) => {
  if (!session?.token) return;
  apiToken = session.token;
  if (persist) writeSession(session);
};

export async function loginApi(email, password) {
  const result = await apiRequest('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (result?.token && result.user && result.expiresAt) {
    apiToken = result.token;
    writeSession(result);
  }
  return result;
}

export async function registerLearnerApi(payload) {
  const result = await apiRequest('/v1/auth/learner/register', { method: 'POST', body: JSON.stringify(payload) });
  if (result?.token && result.user && result.expiresAt) {
    apiToken = result.token;
    writeSession(result);
  }
  return result;
}

export async function demoLoginApi(role) {
  const result = await apiRequest('/v1/auth/demo-login', { method: 'POST', body: JSON.stringify({ role }) });
  if (result?.token && result.user) {
    apiToken = result.token;
    writeSession(result);
  }
  return result;
}

export async function acceptInvitationApi(payload) {
  const result = await apiRequest('/v1/auth/invitations/accept', { method: 'POST', body: JSON.stringify(payload) });
  if (result?.token && result.user && result.expiresAt) {
    apiToken = result.token;
    writeSession(result);
  }
  return result;
}

export function logoutApi() {
  if (apiToken) void apiRequest('/v1/auth/logout', { method: 'POST' });
  apiToken = '';
  if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_KEY);
}

const apiRequest = async (path, options = {}) => {
  try {
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(apiToken ? { authorization: `Bearer ${apiToken}` } : {}), ...(options.headers || {}) },
    });
    if (response.status === 401) {
      apiToken = '';
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SESSION_KEY);
        window.dispatchEvent(new Event('gcon-session-expired'));
      }
    }
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return await response.json();
  } catch {
    return null;
  }
};

const refreshState = async (result) => result ? apiRequest('/v1/state') : null;

export const getApiState = () => apiRequest('/v1/state');
export const getApiSession = () => apiRequest('/v1/auth/session');
export const getApiApplication = () => apiRequest('/v1/applications/me');
export const getIntakeConfig = () => apiRequest('/v1/intake/current');
export const getApiNotifications = () => apiRequest('/v1/notifications');
export const getApiApplicantChat = () => apiRequest('/v1/applicant/chat');
export const evaluateQualificationApi = (pathway, values) => apiRequest('/v1/qualification/evaluate', { method: 'POST', body: JSON.stringify({ pathway, values }) });
export const sendApiApplicantChat = (message) => apiRequest('/v1/applicant/chat', { method: 'POST', body: JSON.stringify({ message }) });
export const recordApiNonQualifier = (contact) => apiRequest('/v1/applications/non-qualifier', { method: 'POST', body: JSON.stringify(contact) });
export const saveApiDraft = (application) => apiRequest('/v1/applications/me', { method: 'PATCH', body: JSON.stringify(application) });
export const submitApiApplication = (application) => apiRequest('/v1/applications/submit', { method: 'POST', headers: { 'x-idempotency-key': `submit-${Date.now()}` }, body: JSON.stringify(application) });

export const createApiApplication = async (application) => {
  const result = await submitApiApplication(application);
  return result ? { ...result, state: await refreshState(result) } : null;
};
export const updateApiDecision = async (ref, decision, reason) => refreshState(await apiRequest(`/v1/reviews/${encodeURIComponent(ref)}/decision`, { method: 'POST', body: JSON.stringify({ decision: decision === 'approved' ? 'approve' : decision === 'declined' ? 'decline' : decision === 'correction' ? 'correction' : 'undo', reason }) }));
export const massDeclineApi = async (refs, reason) => {
  const result = await apiRequest('/v1/reviews/mass-decline', { method: 'POST', body: JSON.stringify({ refs, reason }) });
  if (!result) return null;
  return { ...result, state: await refreshState(result) };
};
export const reviewApiDocument = async (documentId, decision, reason = '') => refreshState(await apiRequest(`/v1/documents/${encodeURIComponent(documentId)}/review`, { method: 'POST', body: JSON.stringify({ decision, reason }) }));
export const updateApiShortlist = async (ref, action = 'add', reason = '') => refreshState(await apiRequest('/v1/shortlists', { method: 'POST', body: JSON.stringify({ ref, action, reason }) }));
export const inviteApiInterview = async (ref, scheduledAt = null) => refreshState(await apiRequest('/v1/interviews', { method: 'POST', body: JSON.stringify({ ref, scheduledAt }) }));
export const recordApiInterviewOutcome = async (ref, payload) => refreshState(await apiRequest(`/v1/interviews/${encodeURIComponent(ref)}/outcome`, { method: 'PATCH', body: JSON.stringify(payload) }));
export const issueApiLetters = async (audience, template, message = '') => refreshState(await apiRequest('/v1/communications/issue', { method: 'POST', body: JSON.stringify({ audience, template, message }) }));
export const updateApiCycle = async (payload) => refreshState(await apiRequest('/v1/intake/current', { method: 'PATCH', body: JSON.stringify(payload) }));
export const updateApiAdvert = async (status) => updateApiCycle({ status });
export const updateApiPlacement = async (ref, campus) => refreshState(await apiRequest(`/v1/placements/${encodeURIComponent(ref)}/prepare`, { method: 'POST', body: JSON.stringify({ campus }) }));
export const respondApiPlacement = (ref, response, campus) => apiRequest(`/v1/placements/${encodeURIComponent(ref)}/response`, { method: 'POST', body: JSON.stringify({ response, campus }) });
export const updateApiWithdrawal = async (ref, reason) => refreshState(await apiRequest(`/v1/applications/${encodeURIComponent(ref)}/withdrawal`, { method: 'PATCH', body: JSON.stringify({ reason }) }));
export const recordApiTerminationLetter = async (ref, payload = {}) => refreshState(await apiRequest(`/v1/placements/${encodeURIComponent(ref)}/termination-letter`, { method: 'POST', body: JSON.stringify(payload) }));
export const getEmployerDashboard = () => apiRequest('/v1/employer/dashboard');
export const getReviewQueue = () => apiRequest('/v1/reviews/queue');

export async function uploadApiDocument({ type, label, file, ref, pathway, pathwayValues }) {
  const intent = await apiRequest('/v1/documents/upload-intent', { method: 'POST', body: JSON.stringify({ type, label, filename: file.name, contentType: file.type, size: file.size, ref, pathway, pathwayValues }) });
  if (!intent?.document?.id) return null;
  const uploadResponse = await fetch(intent.document.uploadUrl, { method: 'PUT', headers: { authorization: `Bearer ${apiToken}`, 'content-type': file.type || 'application/octet-stream' }, body: file });
  if (!uploadResponse.ok) return null;
  const uploaded = await uploadResponse.json();
  return apiRequest(intent.document.completeUrl, { method: 'POST', body: JSON.stringify({ checksum: uploaded?.document?.checksum || null }) });
}
