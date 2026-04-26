import { Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ConnectionBadge({ connected, size = 'sm' }) {
  const { t } = useTranslation();
  const labelSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 14 : 16;
  const dotClass = connected ? 'bg-success' : 'bg-error';
  const pulseClass = connected ? 'animate-pulse' : '';

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-base-300/60 ${labelSize} font-medium`}
    >
      <span className="relative inline-flex w-2 h-2">
        <span className={`absolute inset-0 rounded-full ${dotClass} ${pulseClass} opacity-75`} />
        <span className={`relative inline-flex w-2 h-2 rounded-full ${dotClass}`} />
      </span>
      {connected
        ? <Wifi size={iconSize} className="opacity-80" />
        : <WifiOff size={iconSize} className="opacity-80" />}
      <span className="opacity-90">{connected ? t('common.connected') : t('common.disconnected')}</span>
    </div>
  );
}
