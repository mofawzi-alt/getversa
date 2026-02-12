import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      <header className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border/40 z-50">
        <div className="flex items-center h-14 px-4 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section>
          <p className="text-muted-foreground text-sm mb-4">
            Last updated: January 2026
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
          <p className="text-muted-foreground leading-relaxed">
            Welcome to Versa ("we," "our," or "us"). We are committed to protecting your privacy and ensuring
            transparency about how we collect, use, and share your information. This Privacy Policy explains
            our practices regarding the data we collect when you use our mobile application and services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
          <p className="text-muted-foreground leading-relaxed">
            We collect information you provide directly to us, including:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
            <li><strong className="text-foreground">Account Information:</strong> Email address, username, and password when you create an account.</li>
            <li><strong className="text-foreground">Profile Information:</strong> Age range, gender, country, city, and category interests you choose to provide during onboarding.</li>
            <li><strong className="text-foreground">Usage Data:</strong> Your votes on polls, voting streaks, points earned, and interaction patterns within the app.</li>
            <li><strong className="text-foreground">Device Information:</strong> Device type, operating system, and push notification tokens if you enable notifications.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use the information we collect to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
            <li>Provide, maintain, and improve our services</li>
            <li>Personalize your experience and show relevant polls</li>
            <li>Display aggregated, anonymized demographic insights to poll creators</li>
            <li>Send you notifications about new polls, achievements, and updates (if enabled)</li>
            <li>Detect and prevent fraud, abuse, and security issues</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">4. Data Sharing and Disclosure</h2>
          <p className="text-muted-foreground leading-relaxed">
            We do not sell your personal information. We may share information in the following circumstances:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
            <li><strong className="text-foreground">Aggregated Analytics:</strong> Poll creators see anonymized, aggregated demographic breakdowns of votes (e.g., "60% of voters aged 18-24 chose Option A"). Individual votes are never attributed to specific users.</li>
            <li><strong className="text-foreground">Service Providers:</strong> We may share data with third-party vendors who help us operate our services (e.g., cloud hosting, analytics).</li>
            <li><strong className="text-foreground">Legal Requirements:</strong> We may disclose information if required by law or to protect our rights and safety.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">5. Data Security</h2>
          <p className="text-muted-foreground leading-relaxed">
            We implement industry-standard security measures to protect your data, including encryption
            in transit and at rest, secure authentication, and regular security audits. However, no
            method of transmission over the internet is 100% secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">6. Your Rights and Choices</h2>
          <p className="text-muted-foreground leading-relaxed">
            You have the right to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
            <li>Access, update, or delete your profile information through the app settings</li>
            <li>Opt out of push notifications at any time</li>
            <li>Request a copy of your data or account deletion by contacting us</li>
            <li>Withdraw consent for optional data collection (e.g., demographic information)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
          <p className="text-muted-foreground leading-relaxed">
            We retain your data for as long as your account is active or as needed to provide you services.
            If you delete your account, we will delete or anonymize your personal information within 30 days,
            except where retention is required by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">8. Children's Privacy</h2>
          <p className="text-muted-foreground leading-relaxed">
            Versa is intended for users aged 13 and older. We do not knowingly collect personal information
            from children under 13. If we become aware that we have collected data from a child under 13,
            we will take steps to delete such information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">9. Changes to This Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any material changes
            by posting the new policy in the app and updating the "Last updated" date.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">10. Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have any questions about this Privacy Policy or our data practices, please contact us at:
          </p>
          <p className="text-primary font-medium">
            privacy@versaapp.com
          </p>
        </section>

        <div className="pt-6 border-t border-border/40">
          <p className="text-xs text-muted-foreground text-center">
            © 2026 Versa. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}
