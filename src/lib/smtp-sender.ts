import * as tls from 'tls';
import * as net from 'net';

interface SmtpConfig {
  host: string;
  port: number;
  email: string;
  password: string;
}

interface SendEmailOptions {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  resumeUrl?: string; // URL to PDF attachment
}

interface SmtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Generate a unique message ID
 */
function generateMessageId(domain: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `<${timestamp}.${random}@${domain}>`;
}

/**
 * Encode a string to base64
 */
function toBase64(str: string): string {
  return Buffer.from(str).toString('base64');
}

/**
 * Read a line from socket, resolving when \r\n received
 */
function readLine(socket: tls.TLSSocket | net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    const timeout = setTimeout(() => {
      reject(new Error('SMTP read timeout (30s)'));
    }, 30000);

    const onData = (chunk: Buffer) => {
      data += chunk.toString();
      // SMTP responses can be multi-line (xxx-text\r\n) or single (xxx text\r\n)
      const lines = data.split('\r\n');
      // Check if we have a final response line (code followed by space, not dash)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^\d{3} /) || (lines[i] === '' && i > 0)) {
          clearTimeout(timeout);
          socket.removeListener('data', onData);
          socket.removeListener('error', onError);
          resolve(data.trim());
          return;
        }
      }
    };

    const onError = (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    };

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

/**
 * Send a command and read the response
 */
async function sendCommand(
  socket: tls.TLSSocket | net.Socket,
  command: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.write(command + '\r\n', (err) => {
      if (err) return reject(err);
      readLine(socket).then(resolve).catch(reject);
    });
  });
}

/**
 * Download a file from URL and return as base64
 */
async function downloadAsBase64(url: string): Promise<{ data: string; filename: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const data = Buffer.from(buffer).toString('base64');

    // Extract filename from URL or Content-Disposition
    const disposition = response.headers.get('content-disposition');
    let filename = 'resume.pdf';
    if (disposition) {
      const match = disposition.match(/filename[*]?=["']?([^"';\r\n]+)/);
      if (match) filename = match[1];
    } else {
      const urlPath = new URL(url).pathname;
      const urlFilename = urlPath.split('/').pop();
      if (urlFilename && urlFilename.includes('.')) filename = urlFilename;
    }

    return { data, filename };
  } catch (error) {
    console.error('[SMTP] Failed to download attachment:', error);
    return null;
  }
}

/**
 * Build MIME message with optional PDF attachment
 */
function buildMimeMessage(options: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  messageId: string;
  attachment?: { data: string; filename: string } | null;
}): string {
  const { from, to, replyTo, subject, html, text, messageId, attachment } = options;
  const boundary = `----=_Part_${Date.now().toString(36)}`;
  const mixedBoundary = `----=_Mixed_${Date.now().toString(36)}`;

  let headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${toBase64(subject)}?=`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
  ];

  if (replyTo) {
    headers.push(`Reply-To: ${replyTo}`);
  }

  if (attachment) {
    // Multipart/mixed with attachment
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

    const alternativeBody = [
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      toBase64(text),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      toBase64(html),
      ``,
      `--${boundary}--`,
    ].join('\r\n');

    // Split base64 attachment into 76-char lines
    const attachmentLines = attachment.data.match(/.{1,76}/g) || [];

    const body = [
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      alternativeBody,
      ``,
      `--${mixedBoundary}`,
      `Content-Type: application/pdf; name="${attachment.filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      ``,
      attachmentLines.join('\r\n'),
      ``,
      `--${mixedBoundary}--`,
    ].join('\r\n');

    return headers.join('\r\n') + '\r\n\r\n' + body;
  } else {
    // Multipart/alternative without attachment
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

    const body = [
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      toBase64(text),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      toBase64(html),
      ``,
      `--${boundary}--`,
    ].join('\r\n');

    return headers.join('\r\n') + '\r\n\r\n' + body;
  }
}

/**
 * Send email via user's SMTP server (e.g., Gmail with app password)
 *
 * Supports STARTTLS (port 587) and direct TLS (port 465).
 * Uses raw net/tls sockets — no external dependencies.
 */
export async function sendEmailViaSMTP(
  config: SmtpConfig,
  options: SendEmailOptions
): Promise<SmtpResult> {
  const { host, port, email, password } = config;
  const domain = email.split('@')[1] || 'localhost';
  const messageId = generateMessageId(domain);

  // Download attachment if provided
  let attachment: { data: string; filename: string } | null = null;
  if (options.resumeUrl) {
    attachment = await downloadAsBase64(options.resumeUrl);
    if (!attachment) {
      console.warn('[SMTP] Could not download resume, sending without attachment');
    }
  }

  const mimeMessage = buildMimeMessage({
    from: options.from,
    to: options.to,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    messageId,
    attachment,
  });

  return new Promise((resolve) => {
    const connectionTimeout = setTimeout(() => {
      resolve({ success: false, error: 'SMTP connection timeout (30s)' });
    }, 30000);

    const cleanup = (socket: tls.TLSSocket | net.Socket) => {
      clearTimeout(connectionTimeout);
      try {
        socket.end();
      } catch {
        // ignore cleanup errors
      }
    };

    const handleSmtp = async (socket: tls.TLSSocket | net.Socket) => {
      try {
        // Read greeting
        const greeting = await readLine(socket);
        if (!greeting.startsWith('220')) {
          cleanup(socket);
          return resolve({ success: false, error: `SMTP greeting failed: ${greeting}` });
        }

        // EHLO
        const ehlo = await sendCommand(socket, `EHLO ${domain}`);
        if (!ehlo.startsWith('250')) {
          cleanup(socket);
          return resolve({ success: false, error: `EHLO failed: ${ehlo}` });
        }

        // STARTTLS for port 587
        let activeSocket = socket;
        if (port === 587) {
          const starttls = await sendCommand(socket, 'STARTTLS');
          if (!starttls.startsWith('220')) {
            cleanup(socket);
            return resolve({ success: false, error: `STARTTLS failed: ${starttls}` });
          }

          // Upgrade to TLS
          const tlsSocket = tls.connect(
            { socket: socket as net.Socket, host, servername: host },
            () => {}
          );

          await new Promise<void>((res, rej) => {
            tlsSocket.once('secureConnect', res);
            tlsSocket.once('error', rej);
            setTimeout(() => rej(new Error('TLS upgrade timeout')), 10000);
          });

          activeSocket = tlsSocket;

          // EHLO again after STARTTLS
          const ehlo2 = await sendCommand(activeSocket, `EHLO ${domain}`);
          if (!ehlo2.startsWith('250')) {
            cleanup(activeSocket);
            return resolve({ success: false, error: `EHLO after STARTTLS failed: ${ehlo2}` });
          }
        }

        // AUTH LOGIN
        const authCmd = await sendCommand(activeSocket, 'AUTH LOGIN');
        if (!authCmd.startsWith('334')) {
          cleanup(activeSocket);
          return resolve({ success: false, error: `AUTH LOGIN failed: ${authCmd}` });
        }

        const userResp = await sendCommand(activeSocket, toBase64(email));
        if (!userResp.startsWith('334')) {
          cleanup(activeSocket);
          return resolve({ success: false, error: `AUTH username failed: ${userResp}` });
        }

        const passResp = await sendCommand(activeSocket, toBase64(password));
        if (!passResp.startsWith('235')) {
          cleanup(activeSocket);
          return resolve({ success: false, error: `AUTH password failed: ${passResp}` });
        }

        // MAIL FROM
        const mailFrom = await sendCommand(activeSocket, `MAIL FROM:<${email}>`);
        if (!mailFrom.startsWith('250')) {
          cleanup(activeSocket);
          return resolve({ success: false, error: `MAIL FROM failed: ${mailFrom}` });
        }

        // RCPT TO
        const rcptTo = await sendCommand(activeSocket, `RCPT TO:<${options.to}>`);
        if (!rcptTo.startsWith('250')) {
          cleanup(activeSocket);
          return resolve({ success: false, error: `RCPT TO failed: ${rcptTo}` });
        }

        // DATA
        const dataCmd = await sendCommand(activeSocket, 'DATA');
        if (!dataCmd.startsWith('354')) {
          cleanup(activeSocket);
          return resolve({ success: false, error: `DATA failed: ${dataCmd}` });
        }

        // Send message body (dot-stuffing: lines starting with . get extra .)
        const stuffedMessage = mimeMessage
          .split('\r\n')
          .map((line) => (line.startsWith('.') ? '.' + line : line))
          .join('\r\n');

        const dataResp = await sendCommand(activeSocket, stuffedMessage + '\r\n.');
        if (!dataResp.startsWith('250')) {
          cleanup(activeSocket);
          return resolve({ success: false, error: `Message send failed: ${dataResp}` });
        }

        // QUIT
        await sendCommand(activeSocket, 'QUIT').catch(() => {});
        cleanup(activeSocket);

        resolve({ success: true, messageId });
      } catch (error) {
        cleanup(socket);
        resolve({ success: false, error: `SMTP error: ${String(error)}` });
      }
    };

    try {
      if (port === 465) {
        // Direct TLS connection
        const socket = tls.connect({ host, port, servername: host }, () => {
          handleSmtp(socket);
        });
        socket.on('error', (err) => {
          clearTimeout(connectionTimeout);
          resolve({ success: false, error: `TLS connection error: ${err.message}` });
        });
      } else {
        // Plain connection (will upgrade via STARTTLS)
        const socket = net.createConnection({ host, port }, () => {
          handleSmtp(socket);
        });
        socket.on('error', (err) => {
          clearTimeout(connectionTimeout);
          resolve({ success: false, error: `Connection error: ${err.message}` });
        });
      }
    } catch (error) {
      clearTimeout(connectionTimeout);
      resolve({ success: false, error: `SMTP setup error: ${String(error)}` });
    }
  });
}

/**
 * Test SMTP connection by sending a test email
 */
export async function testSmtpConnection(config: SmtpConfig): Promise<SmtpResult> {
  return sendEmailViaSMTP(config, {
    from: `${config.email}`,
    to: config.email,
    subject: 'Freelanly Auto-Apply — SMTP Test',
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>SMTP Connection Successful</h2>
        <p>Your SMTP settings are configured correctly. Freelanly Auto-Apply can now send applications on your behalf.</p>
        <p style="color: #666; font-size: 12px;">This is an automated test email from Freelanly.</p>
      </div>
    `,
    text: 'SMTP Connection Successful. Your SMTP settings are configured correctly. Freelanly Auto-Apply can now send applications on your behalf.',
  });
}
