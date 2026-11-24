import { useState, type ComponentProps } from 'react';
import type { Show } from '../lib/tv';

export function Icon({ name }: { name: string }) {
  return <img src={'/artwork/icons/' + name + '.svg'} alt="" />;
}

export function Button({ className = '', ...props }: ComponentProps<'button'>) {
  return <button type="button" className={'button ' + className} {...props} />;
}

export function Artwork({ show, className, source = show.artwork?.[0] }: {
  show: Show; className: string; source?: string;
}) {
  const [failed, setFailed] = useState<string>();
  return source && source !== failed
    ? <img className={className} src={source} alt="" draggable={false} onError={() => setFailed(source)} />
    : <div className={className + ' title-tile'} aria-hidden="true">{show.title}</div>;
}

export function ShowMeta({ show }: { show: Show }) {
  return [show.kind === 'channel' ? 'Saved channel' : show.firstAirYear,
    show.service ? show.service + ' (sample)' : 'Availability unknown'].filter(Boolean).join(' · ');
}

export function CheckChoice({ children, ...props }: ComponentProps<'input'>) {
  return <label className="choice"><input type="checkbox" {...props} />{children}</label>;
}
