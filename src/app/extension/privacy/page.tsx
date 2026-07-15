import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Freelanly Autofill — Privacy Policy',
  robots: { index: true, follow: false },
};

// Privacy policy for the Chrome extension — required by the Chrome Web Store (the extension
// handles personal data). Linked from the store listing.
export default function ExtensionPrivacyPage() {
  const h2 = { fontSize: '18px', fontWeight: 700 as const, margin: '28px 0 8px' };
  const p = { fontSize: '15px', lineHeight: 1.65, color: '#333', margin: '0 0 12px' };
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px 80px' }}>
      <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 4px' }}>Freelanly Autofill — Privacy Policy</h1>
      <p style={{ ...p, color: '#888' }}>Last updated: July 15, 2026</p>

      <p style={p}>
        Freelanly Autofill is a browser extension that fills job application forms on company career
        sites (currently Lever) using the profile you created at freelanly.com. This policy explains
        exactly what data the extension touches and where it goes.
      </p>

      <h2 style={h2}>What the extension accesses</h2>
      <p style={p}>
        <b>Your Freelanly profile.</b> When you click “Autofill”, the extension fetches your own
        profile (name, email, phone/messenger, location, links, work history summary, skills, salary
        expectation, availability, and your résumé file) from freelanly.com, authenticated by a
        personal token you paste in once. It uses this data solely to fill the form in front of you.
      </p>
      <p style={p}>
        <b>Screening questions.</b> To draft an answer to a form’s custom question, the extension
        sends that question’s text (and the job title of the page) to freelanly.com, which generates
        an answer from your profile. Questions and answers are not used for anything else.
      </p>
      <p style={p}>
        <b>Demographic answers (optional).</b> If you set optional EEO answers (gender, race/ethnicity,
        disability, veteran status) in the extension popup — or the extension learns them from a
        choice you make manually in a form — they are stored <b>only in your browser</b> via Chrome’s
        extension storage. They are <b>never transmitted to Freelanly servers</b>. Consent and legal
        declaration fields are never auto-filled.
      </p>

      <h2 style={h2}>What the extension does NOT do</h2>
      <p style={p}>
        It does not read pages other than the job application form you invoke it on. It does not
        collect browsing history, does not track you across sites, does not submit applications by
        itself (you always click Submit), and does not sell or share any data with third parties.
      </p>

      <h2 style={h2}>Data retention & deletion</h2>
      <p style={p}>
        The extension stores only your access token and optional demographic answers, locally in your
        browser; removing the extension deletes them. Your Freelanly profile is governed by the
        Freelanly account terms — you can delete your account and data at freelanly.com. You can
        revoke the extension’s token at any time from your dashboard.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        Questions: <a href="mailto:info@freelanly.com" style={{ color: '#2563eb' }}>info@freelanly.com</a>
      </p>
    </div>
  );
}
