import { useEffect, useState } from 'react';
import { api } from './lib/api';
import Ticker from './sections/Ticker';
import Navbar from './sections/Navbar';
import Hero from './sections/Hero';
import About from './sections/About';
import HowItWorks from './sections/HowItWorks';
import TaskTiers from './sections/TaskTiers';
import Features from './sections/Features';
import Funds from './sections/Funds';
import Contact from './sections/Contact';
import AppDownload from './sections/AppDownload';
import { Cta, Footer } from './sections/Footer';
import InstallAppModal from './components/InstallAppModal';

export default function App() {
  const [funds, setFunds] = useState([]);
  const [stats, setStats] = useState({ members: 0, aum: 0, funds: 0 });
  const [settings, setSettings] = useState({});
  const [market, setMarket] = useState([]);
  const [installModal, setInstallModal] = useState({ open: false, platform: 'android' });

  useEffect(() => {
    api('/public/funds').then((d) => setFunds(d.funds || [])).catch(() => {});
    api('/public/stats').then(setStats).catch(() => {});
    api('/public/settings').then((d) => setSettings(d.settings || {})).catch(() => {});
    const loadMarket = () => api('/public/market').then((d) => setMarket(d.market || [])).catch(() => {});
    loadMarket();
    const t = setInterval(loadMarket, 60_000);
    return () => clearInterval(t);
  }, []);

  const handleOpenInstall = (platform = 'android') => {
    setInstallModal({ open: true, platform });
  };

  return (
    <div className="relative overflow-x-clip">
      <Ticker funds={funds} market={market} />
      <Navbar onOpenInstall={handleOpenInstall} />
      <main>
        <Hero funds={funds} stats={stats} />
        <About stats={stats} />
        <HowItWorks />
        <TaskTiers />
        <Features />
        <Funds funds={funds} />
        <Contact settings={settings} />
        <AppDownload onOpenInstall={handleOpenInstall} />
        <Cta />
      </main>
      <Footer settings={settings} />

      <InstallAppModal
        open={installModal.open}
        defaultPlatform={installModal.platform}
        onClose={() => setInstallModal((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
