import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      <header className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border/40 z-50">
        <div className="flex items-center h-14 px-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Terms of Service</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <p className="text-muted-foreground text-sm">Last updated: April 2026</p>

        <Section title="Acceptance of Terms">
          By accessing or using Versa you agree to these Terms of Service.
        </Section>

        <Section title="What Versa Is">
          Versa is an independent consumer preference platform. It is not affiliated with, endorsed by, or sponsored by any brand featured in its polls.
        </Section>

        <Section title="Brand Disclaimer">
          All brand names, logos, and trademarks featured on Versa are the property of their respective owners. Their appearance does not imply affiliation or endorsement. Versa uses brand names for consumer preference comparison which constitutes fair commentary and editorial use.
        </Section>

        <Section title="Your Account">
          You must be 18 or older, provide accurate profile information, and maintain confidentiality of your credentials.
        </Section>

        <Section title="Acceptable Use">
          You agree not to use Versa for unlawful purposes, manipulate poll results, reverse engineer the platform, or attempt to access unauthorized data.
        </Section>

        <Section title="Intellectual Property">
          All content, design, code, and data on Versa is owned by Versa and protected by applicable intellectual property laws.
        </Section>

        <Section title="Sponsored Content">
          Sponsored polls will be clearly labeled as "Sponsored."
        </Section>

        <Section title="Data and Insights">
          By using Versa you consent to your votes being included in aggregated anonymous insights. Your personal identity is never included. See our <a href="/privacy-policy" className="text-primary underline">Privacy Policy</a> for full details.
        </Section>

        <Section title="Disclaimer">
          Versa is provided "as is" without warranty. We are not responsible for any loss or damage arising from use of the platform.
        </Section>

        <Section title="Governing Law">
          These terms are governed by the laws of the Arab Republic of Egypt.
        </Section>

        <Section title="Contact">
          <a href="mailto:legal@getversa.app" className="text-primary underline">legal@getversa.app</a> — <a href="https://getversa.app" className="text-primary underline" target="_blank" rel="noopener noreferrer">getversa.app</a>
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
