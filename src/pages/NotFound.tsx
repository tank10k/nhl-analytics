import { Link } from 'react-router';
import { usePageTitle } from '../lib/title';

export function NotFound() {
  usePageTitle('Page not found');
  return (
    <div className="soon-page">
      <header className="page-head">
        <h1 className="page-title">Page not found</h1>
        <p className="page-lede">That address doesn't match any page in the app.</p>
      </header>
      <Link className="btn" to="/">Go to league overview</Link>
    </div>
  );
}
