import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      <header className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border/40 z-50">
        <div className="flex items-center h-14 px-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <p className="text-muted-foreground text-sm">Last updated: April 2026</p>

        <Section title="Who We Are">
          Versa is a consumer preference platform accessible at getversa.app, based in Cairo, Egypt, serving users across MENA.
        </Section>

        <Section title="What Data We Collect">
          <p className="mb-2"><strong className="text-foreground">Information you provide:</strong> name, email, age range, gender, city, votes and choices on polls.</p>
          <p><strong className="text-foreground">Information collected automatically:</strong> device type, browser, app interactions, notification preferences, time and date of activity.</p>
        </Section>

        <Section title="Why We Collect This Data">
          To provide a personalized experience, show relevant polls, send notifications, generate your Taste Profile, and produce aggregated anonymous consumer insights for business clients.
        </Section>

        <Section title="How We Use Your Data">
          Your individual data is never sold. We use fully anonymized aggregated data to produce consumer preference insights for brands. For example: "67% of Cairo users aged 18–24 prefer Careem over Uber." Your name, email, or any personally identifying information is never included.
        </Section>

        <Section title="Data Sharing">
          We do not sell personal data. We share anonymized aggregated insights with brand partners, research firms, media companies, and investors under strict confidentiality. We may share data when required by law.
        </Section>

        <Section title="Your Rights">
          You have the right to access, correct, or delete your personal data, opt out of marketing communications, and withdraw consent. Contact: <a href="mailto:privacy@getversa.app" className="text-primary underline">privacy@getversa.app</a>
        </Section>

        <Section title="Data Security">
          We take reasonable technical and organizational measures to protect your personal data.
        </Section>

        <Section title="Cookies">
          Versa uses essential cookies only to keep you logged in and remember preferences. We do not use advertising cookies or sell cookie data.
        </Section>

        <Section title="Age Requirement">
          Versa is for users aged 18 and over. By creating an account you confirm you are 18 or older.
        </Section>

        <Section title="Changes To This Policy">
          We may update this policy and will notify you of significant changes via email or in-app notification.
        </Section>

        <Section title="Contact">
          <a href="mailto:privacy@getversa.app" className="text-primary underline">privacy@getversa.app</a> — <a href="https://getversa.app" className="text-primary underline" target="_blank" rel="noopener noreferrer">getversa.app</a>
        </Section>

        <div className="pt-6 border-t border-border/40">
          <p className="text-xs text-muted-foreground text-center">© 2026 Versa. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}
