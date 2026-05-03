import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white safe-area-top safe-area-bottom">
      <header className="sticky top-0 bg-white/90 backdrop-blur-lg border-b border-border/40 z-50">
        <div className="flex items-center h-14 px-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-lg font-bold text-[#E8392A] tracking-tight">Versa</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 text-foreground">
        <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-6">Versa — Consumer Intelligence Platform · Last updated: May 2026</p>

        <Section title="1. Introduction">
          <p>Welcome to Versa ("we", "our", or "the app"). Versa is a consumer opinion platform that allows users to vote on binary polls, discover their personality type, and access collective insights backed by real votes.</p>
          <p className="mt-2">This Privacy Policy explains what personal data we collect, how we use it, who we share it with, and your rights as a user. By creating an account and using Versa, you agree to this policy.</p>
          <p className="mt-2">If you do not agree with any part of this policy, please do not use the app.</p>
        </Section>

        <Section title="2. Who We Are">
          <p>Versa is operated by Versa Technologies. For any questions about this policy or your data, contact us at:</p>
          <p className="mt-2"><strong>Email:</strong> <a href="mailto:privacy@getversa.app" className="text-primary underline">privacy@getversa.app</a></p>
          <p><strong>Website:</strong> <a href="https://getversa.app" className="text-primary underline">getversa.app</a></p>
        </Section>

        <Section title="3. What Data We Collect">
          <h3 className="font-semibold mt-2 mb-1">3.1 Account Information</h3>
          <p>When you create an account, we collect:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>Username</li>
            <li>Email address</li>
            <li>Password (stored in encrypted form — we never see your actual password)</li>
            <li>Profile photo (optional)</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">3.2 Profile Information</h3>
          <p>When you complete your profile, we collect:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>Age range (e.g. 18–24)</li>
            <li>Gender</li>
            <li>Country</li>
            <li>City of residence</li>
            <li>Nationality</li>
          </ul>
          <p className="mt-1">This information is used to generate demographic breakdowns of poll results.</p>

          <h3 className="font-semibold mt-4 mb-1">3.3 Vote and Interaction Data</h3>
          <p>When you use the app, we collect:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>Your votes on polls (which option you chose)</li>
            <li>Polls you viewed, skipped, or shared</li>
            <li>Time and frequency of app usage</li>
            <li>Credits earned and spent on Ask Versa</li>
            <li>Versa Arena duel results and scores</li>
            <li>Compatibility scores with friends</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">3.4 Device Information</h3>
          <p>We automatically collect:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>Device type and operating system</li>
            <li>App version</li>
            <li>IP address (used for geographic context, not stored long-term)</li>
            <li>Crash reports and error logs</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">3.5 Communications</h3>
          <p>If you contact our support team, we collect the content of your message and your contact details.</p>
        </Section>

        <Section title="4. How We Use Your Data">
          <h3 className="font-semibold mt-2 mb-1">4.1 To Run the App</h3>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Show you polls relevant to your demographics</li>
            <li>Calculate your personality type, taste profile, and decision dimensions</li>
            <li>Generate your compatibility score with friends</li>
            <li>Power Ask Versa insights</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">4.2 To Improve the Product</h3>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Understand how users interact with polls and features</li>
            <li>Fix bugs and improve performance</li>
            <li>Develop new features based on usage patterns</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">4.3 For Aggregated Insights (B2B)</h3>
          <p>We aggregate and anonymise vote data to produce consumer intelligence reports sold to brand clients (companies). These reports show demographic trends — for example, "61% of Egyptian women aged 18–24 prefer X over Y."</p>
          <p className="mt-2"><strong>Importantly:</strong> We never sell or share your individual personal data, your name, your email, or any data that could identify you personally. Only anonymised, aggregated statistics are shared with brand clients.</p>

          <h3 className="font-semibold mt-4 mb-1">4.4 For Safety and Legal Compliance</h3>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Detect and prevent fraud or abuse</li>
            <li>Respond to legal requests</li>
            <li>Enforce our Terms of Service</li>
          </ul>
        </Section>

        <Section title="5. How We Share Your Data">
          <h3 className="font-semibold mt-2 mb-1">5.1 With Friends You Add</h3>
          <p>Your username, profile photo, vote match percentage, and public stats are visible to users you connect with as friends.</p>

          <h3 className="font-semibold mt-4 mb-1">5.2 With Brand Clients (Anonymised Only)</h3>
          <p>Aggregated, anonymised demographic breakdowns are shared with brand clients as consumer intelligence reports. No personally identifying information is ever shared.</p>

          <h3 className="font-semibold mt-4 mb-1">5.3 With Service Providers</h3>
          <p>We use trusted third-party services to operate Versa, including:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li><strong>Supabase</strong> — database and authentication</li>
            <li><strong>AI providers</strong> — to power Ask Versa and image generation</li>
          </ul>
          <p className="mt-1">These providers process data only on our behalf and under strict confidentiality obligations.</p>

          <h3 className="font-semibold mt-4 mb-1">5.4 Legal Requirements</h3>
          <p>We may disclose your data if required by law, court order, or to protect the rights and safety of our users.</p>

          <h3 className="font-semibold mt-4 mb-1">5.5 Business Transfer</h3>
          <p>If Versa is acquired or merges with another company, your data may be transferred as part of that transaction. We will notify you in advance.</p>
          <p className="mt-2">We do not sell your personal data to any third party.</p>
        </Section>

        <Section title="6. Data Retention">
          <p>We keep your data for as long as your account is active. If you delete your account:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>Your personal data (name, email, profile) is deleted within 30 days</li>
            <li>Anonymised vote data may be retained for aggregate reporting purposes</li>
            <li>Ask Versa query history is deleted within 30 days</li>
          </ul>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your country, you may have the right to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-0.5">
            <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong>Correction</strong> — ask us to correct inaccurate information</li>
            <li><strong>Deletion</strong> — request that we delete your account and personal data</li>
            <li><strong>Portability</strong> — receive your data in a portable format</li>
            <li><strong>Objection</strong> — object to how we process your data</li>
          </ul>
          <p className="mt-2">To exercise any of these rights, contact us at <a href="mailto:privacy@getversa.app" className="text-primary underline">privacy@getversa.app</a>. We will respond within 30 days.</p>
        </Section>

        <Section title="8. Children and Age Requirements">
          <p>Versa is intended for users aged 13 and over. We do not knowingly collect personal data from children under 13. If you believe a child under 13 has created an account, please contact us at <a href="mailto:privacy@getversa.app" className="text-primary underline">privacy@getversa.app</a> and we will delete the account promptly.</p>
        </Section>

        <Section title="9. Security">
          <p>We take reasonable technical and organisational measures to protect your data, including:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>Encrypted data transmission (HTTPS)</li>
            <li>Encrypted password storage</li>
            <li>Access controls limiting who can access user data</li>
          </ul>
          <p className="mt-2">No method of transmission or storage is 100% secure. We cannot guarantee absolute security, but we are committed to protecting your data.</p>
        </Section>

        <Section title="10. Cookies and Tracking">
          <p>We use minimal tracking to keep you logged in and to understand how the app is used. We do not use advertising trackers or sell data to advertisers.</p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page. If changes are significant, we will notify you through the app or by email.</p>
          <p className="mt-2">Your continued use of Versa after changes are posted means you accept the updated policy.</p>
        </Section>

        <Section title="12. Contact Us">
          <p>For any questions, concerns, or requests related to your privacy:</p>
          <p className="mt-2"><strong>Email:</strong> <a href="mailto:privacy@getversa.app" className="text-primary underline">privacy@getversa.app</a></p>
          <p><strong>Website:</strong> <a href="https://getversa.app" className="text-primary underline">getversa.app</a></p>
        </Section>

        <div className="pt-8 border-t border-border/40 mt-8">
          <p className="text-xs text-muted-foreground text-center">© 2026 Versa Technologies. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-foreground mb-3">{title}</h2>
      <div className="text-muted-foreground leading-relaxed text-[15px]">{children}</div>
    </section>
  );
}
