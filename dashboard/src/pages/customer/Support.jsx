import { useOutletContext } from 'react-router-dom';
import { Headphones } from 'lucide-react';
import Chat from '../../components/Chat';

export default function Support() {
  const { reloadNotes } = useOutletContext();
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-green-500/10 text-green-400">
          <Headphones className="h-5 w-5" />
        </span>
        <div>
          <div className="flex items-center gap-2 font-semibold text-white">
            Investor Support <span className="live-dot" />
          </div>
          <div className="text-xs text-zinc-500">Our team typically replies within a few hours on business days. Never share your password.</div>
        </div>
      </header>
      <Chat path="/support" mineIsStaff={false} onActivity={reloadNotes} />
    </section>
  );
}
