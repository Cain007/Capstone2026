import { useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import { Input } from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { UserRole } from '../../../types/auth';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import { guide, matchesHelp, type HelpItem, type HelpTopicId } from './guide';
import './styles.css';

type HelpPageProps = {
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
  helpTopic?: HelpTopicId;
};

function Disclosure({ item, defaultOpen }: { item: HelpItem; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `help-${item.id}`;
  return <article className="help-disclosure" id={id}>
    <h3><button type="button" id={`${id}-trigger`} aria-expanded={open} aria-controls={`${id}-content`} onClick={() => setOpen(!open)}>
      <span>{item.title}</span><ChevronDown size={18} aria-hidden="true" />
    </button></h3>
    <div id={`${id}-content`} hidden={!open} className="help-answer">
      {item.paragraphs.map(text => <p key={text}>{text}</p>)}
      {item.steps && <ol>{item.steps.map(text => <li key={text}>{text}</li>)}</ol>}
      {item.facts && <dl>{item.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.text}</dd></div>)}</dl>}
      {item.formula && <pre><code>{item.formula}</code></pre>}
    </div>
  </article>;
}

export default function HelpPage({ userEmail, userRole = 'Staff', onLogout, onNavigate, helpTopic = 'getting-started' }: HelpPageProps) {
  const categories = guide.filter(category => !category.adminOnly || userRole === 'Admin');
  const [selected, setSelected] = useState<HelpTopicId>(helpTopic);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const active = categories.find(category => category.id === selected) ?? categories[0];
  const searching = Boolean(query.trim());
  const results = searching
    ? categories.map(category => ({ ...category, items: category.items.filter(item => matchesHelp(category, item, query)) })).filter(category => category.items.length)
    : [active];
  const count = results.reduce((total, category) => total + category.items.length, 0);
  const selectTopic = (id: HelpTopicId) => { setSelected(id); setQuery(''); };

  return <AppShell activePage="Help & System Guide" userEmail={userEmail} userRole={userRole} onLogout={onLogout} onNavigate={onNavigate} className="dashboard-page help-page">
    <section className="dashboard-page-content" aria-label="Help workspace">
      <PageHeader title="Help & System Guide" description="Learn how to use the system, understand statuses, and interpret forecasting and reporting information." />
      <div className="help-search" ref={searchRef}>
        <Input id="help-search" label="Search help" placeholder="Search topics, questions, or terms" value={query} onChange={event => setQuery(event.target.value)} />
        <Search className="help-search-icon" size={18} aria-hidden="true" />
        {query && <button type="button" className="help-clear" aria-label="Clear search" title="Clear search" onClick={() => { setQuery(''); searchRef.current?.querySelector('input')?.focus(); }}><X size={18} aria-hidden="true" /></button>}
      </div>
      <div className="help-layout">
        <nav className="help-topics" aria-label="Help topics">
          <h2>Topics</h2>
          {categories.map(category => <button type="button" key={category.id} aria-current={!searching && active.id === category.id ? 'true' : undefined} onClick={() => selectTopic(category.id)}>{category.title}</button>)}
        </nav>
        <div className="help-mobile-topics ui-field">
          <label className="ui-field__label" htmlFor="help-topic">Topic</label>
          <select id="help-topic" className="ui-select" value={searching ? '' : active.id} onChange={event => selectTopic(event.target.value as HelpTopicId)}>
            {searching && <option value="" disabled>Search results</option>}
            {categories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}
          </select>
        </div>
        <div className="help-content">
          <p className="help-result-count" role="status">{searching ? `${count} matching ${count === 1 ? 'question' : 'questions'}` : `${active.items.length} questions`}</p>
          {!count && <div className="help-empty"><Search size={24} aria-hidden="true" /><h2>No help topics match your search.</h2></div>}
          {results.map(category => <section key={`${category.id}-${query.trim()}`} aria-labelledby={`help-topic-${category.id}`}>
            <header className="help-topic-heading"><div><h2 id={`help-topic-${category.id}`}>{category.title}</h2><p>{category.summary}</p></div>{category.adminOnly && <span>Admin only</span>}</header>
            {category.items.map((item, index) => <Disclosure key={item.id} item={item} defaultOpen={searching || index === 0} />)}
          </section>)}
        </div>
      </div>
    </section>
  </AppShell>;
}
