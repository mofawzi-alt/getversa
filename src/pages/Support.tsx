import { ArrowLeft, Mail, MessageCircle, Shield, FileText, Trash2, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Support() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      <header className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border/40 z-50">
        <div className="flex items-center h-14 px-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Support</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-2">How can we help?</h2>
          <p className="text-muted-foreground">
            Versa is the place where Gen Z decides — vote on real polls, compare your taste, and discover trends across the region. If something isn't working, we want to hear from you.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Contact us</h3>
          </div>
          <p className="text-muted-foreground mb-4">
            Email us anytime — we usually reply within 24 hours.
          </p>
          <a
            href="mailto:support@getversa.app"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <Mail className="h-4 w-4" />
            support@getversa.app
          </a>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Frequently asked questions
          </h3>
          <div className="space-y-4">
            <FAQ
              q="How do I vote on a poll?"
              a="On the Home screen, tap the left or right image to cast your vote. You can also swipe left or right. Skip a poll by swiping up or tapping Skip."
            />
            <FAQ
              q="What is a Taste Profile?"
              a="The more you vote, the more Versa learns about your preferences. Your Taste Profile shows your personality archetype (e.g. The Dreamer, The Realist), your top categories, and how your taste compares to the rest of your generation."
            />
            <FAQ
              q="How do I add friends?"
              a="Go to the Friends tab, search by name, and tap Add. Once they accept, you can compare compatibility and challenge each other to poll duels."
            />
            <FAQ
              q="How do I reset my notifications?"
              a="Open Profile → Notifications to toggle which alerts you receive (daily polls, friend activity, weekly recap, and more)."
            />
            <FAQ
              q="Is my data private?"
              a="Your individual votes are never sold or shared. Only fully anonymized, aggregated insights are shared with brand partners. See our Privacy Policy for full details."
            />
            <FAQ
              q="How do I delete my account?"
              a="Go to Profile → Delete account. You'll be asked to type DELETE to confirm. This permanently removes your account, votes, and all linked data — it cannot be undone."
            />
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Resources</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/privacy-policy')}
              className="flex items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left"
            >
              <Shield className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground">Privacy Policy</span>
            </button>
            <button
              onClick={() => navigate('/terms')}
              className="flex items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left"
            >
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground">Terms of Service</span>
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left"
            >
              <Trash2 className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground">Delete account</span>
            </button>
          </div>
        </section>

        <section className="pb-8">
          <p className="text-xs text-muted-foreground text-center">
            Versa · Made in Cairo · © {new Date().getFullYear()}
          </p>
        </section>
      </main>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
        <span className="font-medium text-foreground text-sm">{q}</span>
        <span className="text-muted-foreground text-xl leading-none group-open:rotate-45 transition-transform">+</span>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{a}</p>
    </details>
  );
}
