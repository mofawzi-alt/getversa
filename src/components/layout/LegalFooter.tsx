import { Link } from 'react-router-dom';

export default function LegalFooter() {
  return (
    <footer className="py-4 text-center">
      <p className="text-[10px] text-muted-foreground/50">
        © 2026 Versa · <Link to="/privacy-policy" className="hover:text-muted-foreground transition-colors">Privacy Policy</Link> · <Link to="/terms" className="hover:text-muted-foreground transition-colors">Terms of Service</Link> · <Link to="/support" className="hover:text-muted-foreground transition-colors">Support</Link>
      </p>
    </footer>
  );
}
