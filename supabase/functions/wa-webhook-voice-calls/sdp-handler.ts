/**
 * SDP (Session Description Protocol) Handler for WhatsApp Voice Calls
 * Generates proper SDP answers from WhatsApp's SDP offers
 */

interface SDPMedia {
  type: string;
  port: string;
  proto: string;
  fmt: string[];
}

/**
 * Parse SDP offer and generate a valid SDP answer
 * Based on WhatsApp's requirements and RFC 8866
 */
export function generateSDPAnswer(offer: string): string {
  const lines = offer.split('\r\n');
  
  // Extract key information from offer
  const sessionId = Date.now().toString();
  const sessionVersion = Date.now().toString();
  
  // Parse media line (m=)
  const mediaLine = lines.find(l => l.startsWith('m=audio'));
  if (!mediaLine) {
    throw new Error('No audio media line found in SDP offer');
  }
  
  const mediaMatch = mediaLine.match(/m=audio (\d+) ([A-Z\/]+) (.+)/);
  if (!mediaMatch) {
    throw new Error('Invalid audio media line format');
  }
  
  const [_, port, proto, fmts] = mediaMatch;
  const formatList = fmts.split(' ');
  
  // Extract connection info (c=)
  const connectionLine = lines.find(l => l.startsWith('c='));
  const connection = connectionLine || 'c=IN IP4 0.0.0.0';
  
  // Extract rtpmap lines for codec info
  const rtpmaps = lines.filter(l => l.startsWith('a=rtpmap:'));
  
  // Build SDP answer
  const answer = [
    'v=0',
    `o=- ${sessionId} ${sessionVersion} IN IP4 0.0.0.0`,
    's=EasyMO WhatsApp Call',
    't=0 0',
    connection,
    `m=audio 9 ${proto} ${formatList.join(' ')}`,
  ];
  
  // Add rtpmap lines from offer
  for (const rtpmap of rtpmaps) {
    answer.push(rtpmap);
  }
  
  // Add required attributes
  answer.push('a=sendrecv');
  answer.push('a=rtcp-mux');
  
  // Add ICE attributes if present in offer
  const iceUfrag = lines.find(l => l.startsWith('a=ice-ufrag:'));
  const icePwd = lines.find(l => l.startsWith('a=ice-pwd:'));
  
  if (iceUfrag && icePwd) {
    answer.push(iceUfrag);
    answer.push(icePwd);
  }
  
  // Add fingerprint if present
  const fingerprint = lines.find(l => l.startsWith('a=fingerprint:'));
  if (fingerprint) {
    answer.push(fingerprint);
  }
  
  // Add setup attribute
  const setup = lines.find(l => l.startsWith('a=setup:'));
  if (setup) {
    // If offer has setup:actpass, we respond with setup:active
    if (setup.includes('actpass')) {
      answer.push('a=setup:active');
    } else {
      answer.push(setup);
    }
  }
  
  return answer.join('\r\n') + '\r\n';
}

/**
 * Validate that an SDP string is well-formed
 */
export function validateSDP(sdp: string): boolean {
  if (!sdp || typeof sdp !== 'string') {
    return false;
  }
  
  const lines = sdp.split('\r\n');
  
  // Must have version
  if (!lines.some(l => l.startsWith('v='))) {
    return false;
  }
  
  // Must have origin
  if (!lines.some(l => l.startsWith('o='))) {
    return false;
  }
  
  // Must have session name
  if (!lines.some(l => l.startsWith('s='))) {
    return false;
  }
  
  // Must have time
  if (!lines.some(l => l.startsWith('t='))) {
    return false;
  }
  
  // Must have media line
  if (!lines.some(l => l.startsWith('m='))) {
    return false;
  }
  
  return true;
}
