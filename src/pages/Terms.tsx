import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Terms() {
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
        <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-6">Versa — Consumer Intelligence Platform · Last updated: May 2026</p>

        <Section title="1. Acceptance of Terms">
          <p>By downloading, accessing, or using the Versa app ("Versa", "the app", "the platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use Versa.</p>
          <p className="mt-2">These Terms form a legal agreement between you and Versa Technologies ("we", "us", "our"). We reserve the right to update these Terms at any time. Continued use of Versa after changes are posted means you accept the updated Terms.</p>
        </Section>

        <Section title="2. Who Can Use Versa">
          <p>You must be at least 13 years old to use Versa. By creating an account, you confirm that you meet this age requirement.</p>
          <p className="mt-2">If you are between 13 and 18 years old, you confirm that you have your parent or guardian's permission to use Versa.</p>
          <p className="mt-2">You may only create one account per person. You may not create an account on behalf of someone else.</p>
        </Section>

        <Section title="3. Your Account">
          <h3 className="font-semibold mt-2 mb-1">3.1 Account Registration</h3>
          <p>To use Versa, you must create an account with a valid email address and username. You are responsible for keeping your login credentials secure. Do not share your password with anyone.</p>

          <h3 className="font-semibold mt-4 mb-1">3.2 Accurate Information</h3>
          <p>You agree to provide accurate, current, and complete information when creating your account, including your age range, gender, and location. Providing false demographic information affects the quality of Versa's data and violates these Terms.</p>

          <h3 className="font-semibold mt-4 mb-1">3.3 Account Security</h3>
          <p>You are responsible for all activity that occurs under your account. If you believe your account has been compromised, contact us immediately at <a href="mailto:privacy@getversa.app" className="text-primary underline">privacy@getversa.app</a>.</p>

          <h3 className="font-semibold mt-4 mb-1">3.4 Account Termination</h3>
          <p>We reserve the right to suspend or permanently delete your account at any time if you violate these Terms, engage in abusive behaviour, or if we determine your account is being used fraudulently.</p>
        </Section>

        <Section title="4. Using Versa">
          <h3 className="font-semibold mt-2 mb-1">4.1 What You Can Do</h3>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Vote on polls and view results</li>
            <li>Build your personality profile and discover your dimensions</li>
            <li>Add friends and compare vote compatibility</li>
            <li>Use Ask Versa credits to get insights</li>
            <li>Challenge friends to Versa Arena duels</li>
            <li>Share your Versa profile and compatibility link</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">4.2 What You Cannot Do</h3>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>Create fake accounts or use bots to generate votes</li>
            <li>Attempt to manipulate poll results</li>
            <li>Harass, threaten, or abuse other users</li>
            <li>Use Versa to spread misinformation or harmful content</li>
            <li>Attempt to reverse engineer, hack, or disrupt the platform</li>
            <li>Scrape, copy, or redistribute Versa's data, poll results, or content without permission</li>
            <li>Use Versa for any illegal purpose</li>
            <li>Impersonate another person or organisation</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">4.3 Poll Participation</h3>
          <p>Votes on Versa represent your genuine opinion. You agree to vote honestly and not to systematically vote in a way designed to manipulate aggregate results.</p>
        </Section>

        <Section title="5. Credits and Ask Versa">
          <h3 className="font-semibold mt-2 mb-1">5.1 Earning Credits</h3>
          <p>Credits are earned by voting on polls. The credit earning rate may change at any time.</p>

          <h3 className="font-semibold mt-4 mb-1">5.2 Spending Credits</h3>
          <p>Credits can be spent on Ask Versa insights. Credits have no monetary value and cannot be withdrawn, transferred, or exchanged for cash.</p>

          <h3 className="font-semibold mt-4 mb-1">5.3 Credit Expiry</h3>
          <p>Credits do not expire while your account is active. If your account is deleted, your credits are forfeited.</p>
        </Section>

        <Section title="6. Intellectual Property">
          <h3 className="font-semibold mt-2 mb-1">6.1 Versa's Content</h3>
          <p>All content on Versa — including poll questions, images, personality types, dimensions, insights, the Ask Versa feature, the Versa Arena feature, and all associated data — is owned by Versa Technologies. You may not copy, reproduce, distribute, or create derivative works from Versa's content without our written permission.</p>

          <h3 className="font-semibold mt-4 mb-1">6.2 Poll Data and Insights</h3>
          <p>All vote data collected through Versa, including aggregated results and demographic breakdowns, is the exclusive property of Versa Technologies. This data may be used to create consumer intelligence reports sold to third-party brand clients.</p>

          <h3 className="font-semibold mt-4 mb-1">6.3 Your Content</h3>
          <p>If you submit any content to Versa (such as a profile photo or username), you grant Versa a non-exclusive, worldwide, royalty-free licence to use, display, and store that content for the purpose of operating the platform.</p>
        </Section>

        <Section title="7. Privacy">
          <p>Your use of Versa is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please read it carefully at <a href="/privacy" className="text-primary underline">getversa.app/privacy</a>.</p>
          <p className="mt-2">The key points:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>We collect your demographic data to provide personalised poll targeting</li>
            <li>We aggregate and anonymise vote data for B2B consumer intelligence reports</li>
            <li>We never sell your personal data or share individually identifiable information with third parties</li>
            <li>You can request deletion of your data at any time</li>
          </ul>
        </Section>

        <Section title="8. Disclaimers">
          <h3 className="font-semibold mt-2 mb-1">8.1 As-Is Service</h3>
          <p>Versa is provided "as is" and "as available" without warranties of any kind. We do not guarantee that the app will be available at all times, error-free, or free from bugs.</p>

          <h3 className="font-semibold mt-4 mb-1">8.2 Poll Results</h3>
          <p>Poll results on Versa reflect the opinions of Versa users who voted on a given poll. They are not scientifically representative surveys of the general population. Results should not be used as the sole basis for significant business, medical, financial, or personal decisions.</p>

          <h3 className="font-semibold mt-4 mb-1">8.3 Ask Versa</h3>
          <p>Ask Versa provides insights based on available poll data. We do not guarantee the accuracy, completeness, or timeliness of Ask Versa responses.</p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>To the maximum extent permitted by applicable law, Versa Technologies shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform, including but not limited to loss of data, loss of profits, or reputational damage.</p>
          <p className="mt-2">Our total liability to you for any claim arising from your use of Versa shall not exceed the amount you paid us in the 12 months preceding the claim (if any).</p>
        </Section>

        <Section title="10. Indemnification">
          <p>You agree to defend, indemnify, and hold harmless Versa Technologies and its team from any claims, damages, or expenses arising from your violation of these Terms or your misuse of the platform.</p>
        </Section>

        <Section title="11. Governing Law">
          <p>These Terms are governed by the laws of the Arab Republic of Egypt. Any disputes arising from these Terms shall be subject to the jurisdiction of the courts of Cairo, Egypt.</p>
        </Section>

        <Section title="12. Changes to These Terms">
          <p>We may update these Terms from time to time. When we do, we will update the "Last updated" date at the top of this page. If changes are significant, we will notify you through the app or by email. Continued use of Versa after changes are posted constitutes acceptance of the updated Terms.</p>
        </Section>

        <Section title="13. Contact Us">
          <p>If you have any questions about these Terms, contact us at:</p>
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
